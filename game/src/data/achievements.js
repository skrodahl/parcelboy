// M15a.13: data-driven achievements. Each is a cheap test over the career
// ledger (run only when a career counter changes, never per frame). `test`
// may also read `env` — { suburbCount } — so a "visit every suburb" check
// stays correct as suburbs are added (Lakeside M16, Old Town M17).

export const ACHIEVEMENTS = [
  { id: 'first-drop',        name: 'First Drop',               icon: '📦', description: 'Make your first delivery.',              test: (c) => c.delivered >= 1 },
  { id: 'porch-pirate',      name: "Porch Pirate's Nightmare", icon: '🏠', description: '25 Perfect deliveries.',                test: (c) => c.outcomes.perfect >= 25 },
  { id: 'streak-freak',      name: 'Streak Freak',             icon: '🔥', description: 'Reach a ×5 delivery streak.',           test: (c) => c.bestStreak >= 5 },
  { id: 'signed-sealed',     name: 'Signed, Sealed, Delivered',icon: '📬', description: 'Finish a shift with every parcel in.', test: (c) => c.cleanMissions >= 1 },
  { id: 'bee-whisperer',     name: 'Bee Whisperer',            icon: '🐝', description: 'Get stung 10 times.',                   test: (c) => c.knockdowns.bees >= 10 },
  { id: 'good-boy',          name: 'Good Boy',                 icon: '🐕', description: 'Get a stolen parcel back from a dog.',  test: (c) => c.recovered >= 1 },
  { id: 'strike',            name: 'Strike!',                  icon: '🎳', description: 'Bowl a whole pedestrian over (1 STRIKE).', test: (c) => c.strikes >= 1 },
  { id: 'ten-pin',           name: 'Ten-Pin Wizard',           icon: '🎳', description: '10 STRIKEs in your career.',            test: (c) => c.strikes >= 10 },
  { id: 'most-wanted',       name: 'Most Wanted',              icon: '🚨', description: 'Reach three whistles of heat.',         test: (c) => c.maxHeat >= 3 },
  { id: 'ticket-collector',  name: 'Ticket Collector',         icon: '🎟️', description: 'Get BUSTED 5 times.',                   test: (c) => c.busted >= 5 },
  { id: 'air-mail',          name: 'Air Mail',                 icon: '✉️', description: 'Make an Air Mail delivery.',            test: (c) => c.airMail >= 1 },
  { id: 'cake-boss',         name: 'Cake Boss',                icon: '🎂', description: 'Deliver 5 cakes without a single SPLAT.', test: (c) => c.cakesClean >= 5 },
  { id: 'golden-boy',        name: 'Golden Boy',               icon: '✨', description: "Find all of Maple Hollow's golden parcels.", test: (c) => (c.golden['maple-hollow'] || 0) >= 12 },
  { id: 'commuter',          name: 'Commuter',                 icon: '🚌', description: 'Visit every suburb.',                    test: (c, env) => c.suburbs.length >= (env && env.suburbCount || 3) },
  { id: 'holiday-spirit',    name: 'Holiday Spirit',           icon: '🎁', description: 'Finish a shift on Holiday Rush!',        test: (c) => c.holidayMissions >= 1 },
];

export function getAchievement(id) {
  for (const a of ACHIEVEMENTS) if (a.id === id) return a;
  return null;
}
