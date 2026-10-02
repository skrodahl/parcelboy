// Usage (inside container): node /tools/shoot.cjs [nameFilter]
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE_URL || 'http://web';
const filter = process.argv[2] || '';
const list = JSON.parse(fs.readFileSync('/tools/shots.json', 'utf8')).filter(s => s.name.includes(filter));

(async () => {
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  let failed = 0;
  for (const shot of list) {
    const page = await browser.newPage({ viewport: { width: shot.width || 1280, height: shot.height || 720 } });
    const errors = [], warnings = [];
    page.on('console', m => {
      if (m.type() === 'error') errors.push(m.text());
      if (m.type() === 'warning') warnings.push(m.text());
    });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    try {
      await page.goto(BASE + shot.url, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__pb && window.__pb.ready === true, null, { timeout: 30000 });
      for (const js of shot.eval || []) await page.evaluate(js);
      // M15a: optional hard reload (tests save round-trip through localStorage);
      // re-wait for boot, then run any post-reload evals before the screenshot.
      if (shot.reload) {
        await page.reload({ waitUntil: 'load' });
        await page.waitForFunction(() => window.__pb && window.__pb.ready === true, null, { timeout: 30000 });
        for (const js of shot.evalAfter || []) await page.evaluate(js);
      }
      await page.waitForTimeout(shot.waitMs ?? 1500);
      await page.screenshot({ path: `/shots/${shot.name}.png` });
      const stats = await page.evaluate(() => window.__pb.stats());
      fs.writeFileSync(`/shots/${shot.name}.json`, JSON.stringify({ url: shot.url, stats, errors, warnings }, null, 2));
      console.log(`${errors.length ? 'FAIL' : 'ok  '} ${shot.name}  calls=${stats.drawCalls} tris=${stats.triangles} geos=${stats.geometries} tex=${stats.textures}`);
      if (errors.length) { failed++; errors.forEach(e => console.log('   error: ' + e)); }
    } catch (e) {
      failed++;
      console.log(`FAIL ${shot.name}: ${e.message}`);
      errors.forEach(x => console.log('   error: ' + x));
    }
    await page.close();
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
