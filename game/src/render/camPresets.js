// Menu / screenshot camera presets (§7.9). Extracted from main.js (M12a.5).
// Every path records the look target in camLook so the distance-scaled fog
// (§7.3 plan change) can run each frame. `ctx` is { world, camLook, scene };
// the world is read at call time (null until the neighborhood is built).
export function applyCamPreset(cam, name, ctx) {
  const t = ctx.world ? ctx.world.tilemap : null;
  if (t) {
    const cx = (t.width / 2) * t.tileSize, cz = (t.height / 2) * t.tileSize;
    const p = {
      // High, south of the map: frames the entire 48x40 grid, including the
      // south strip (park + Distribution Center). Look target sits just north
      // of center so the map is vertically centered.
      overview: { pos: [cx, 170, cz + 130], look: [cx, 0, cz - 4] },
      street: { pos: [16, 3, (17 + 1) * 4], look: [96, 2, (17 + 1) * 4] },
      park: { pos: [40, 16, 118], look: [40, 0, 142] },
      bulb: { pos: [142, 10, 92], look: [138, 0.5, 110] },
      // Willow Court's north-end corner (the sign now sits on the west sidewalk here).
      willow: { pos: [118, 11, 62], look: [135, 0.5, 82] },
      depot: { pos: [158, 8, 128], look: [158, 2, 148] },
      hub: { pos: [150, 13, 116], look: [170, 1, 145] },
      // M4 lineup: elevated look at the courier row; high enough to see
      // over the parked vans (2.8u tall), far enough for all 5, with the
      // depot + lit QUICKBOX sign as backdrop.
      showroom: { pos: [158, 6, 124], look: [158, 1.4, 140] },
    };
    if (name.startsWith('porchClose:') || name.startsWith('porch:')) {
      const close = name.startsWith('porchClose:');
      const id = close ? name.slice(11) : name.slice(6);
      const h = t.def.houses.find((x) => x.id === id);
      const mat = ctx.world.doormatPoints[id];
      if (h && mat) {
        const f = { N: [0, 0, -1], S: [0, 0, 1], E: [1, 0, 0], W: [-1, 0, 0] }[h.facing];
        const dist = close ? 3.4 : 6.5, up = close ? 2.0 : 2.8, lookY = close ? 1.8 : 1.4;
        cam.position.set(mat.x + f[0] * dist, up, mat.z + f[2] * dist);
        cam.lookAt(mat.x, lookY, mat.z);
        ctx.camLook.set(mat.x, lookY, mat.z);
        const dd = cam.position.distanceTo(ctx.camLook);
        if (ctx.scene.fog) { ctx.scene.fog.near = dd + 45; ctx.scene.fog.far = dd + 150; }
        return;
      }
    }
    // M10: frame one of the hidden Golden Parcels (a close-up for the shots).
    if (name.startsWith('golden:')) {
      const i = parseInt(name.slice(7), 10);
      const gp = (t.def.goldenParcels || [])[i];
      if (gp) {
        const T = t.tileSize, gx = gp[0] * T + T / 2, gz = gp[1] * T + T / 2;
        // A close, slightly top-down close-up so the spinning golden box is the subject.
        cam.position.set(gx + 1.2, 3.6, gz + 2.4);
        cam.lookAt(gx, 1.3, gz);
        ctx.camLook.set(gx, 1.3, gz);
        const dd = cam.position.distanceTo(ctx.camLook);
        if (ctx.scene.fog) { ctx.scene.fog.near = dd + 45; ctx.scene.fog.far = dd + 150; }
        return;
      }
    }
    // M11: frame one of the trampolines (a low shot so the 5u launch is in-frame).
    if (name.startsWith('trampoline:')) {
      const i = parseInt(name.slice(11), 10);
      const tp = ((t.def.gagSpots || {}).trampoline || [])[i];
      if (tp) {
        const T = t.tileSize, tx = tp[0] * T + T / 2, tz = tp[1] * T + T / 2;
        cam.position.set(tx + 5, 6, tz + 5);
        cam.lookAt(tx, 2.5, tz);
        ctx.camLook.set(tx, 2.5, tz);
        const dd = cam.position.distanceTo(ctx.camLook);
        if (ctx.scene.fog) { ctx.scene.fog.near = dd + 45; ctx.scene.fog.far = dd + 150; }
        return;
      }
    }
    // M11: frame the courier mid-flight over the handlebars (a street shot).
    if (name === 'handlebars') {
      const hx = 46, hz = 70; // a clear spot on Maple Avenue
      cam.position.set(hx + 5, 4.5, hz + 4);
      cam.lookAt(hx, 1.5, hz);
      ctx.camLook.set(hx, 1.5, hz);
      const dd = cam.position.distanceTo(ctx.camLook);
      if (ctx.scene.fog) { ctx.scene.fog.near = dd + 45; ctx.scene.fog.far = dd + 150; }
      return;
    }
    if (p[name]) {
      cam.position.set(...p[name].pos);
      cam.lookAt(...p[name].look);
      ctx.camLook.set(...p[name].look);
      return;
    }
  }
  cam.position.set(0, 8, 14);
  cam.lookAt(0, 2, 0);
  ctx.camLook.set(0, 2, 0);
}
