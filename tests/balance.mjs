// A headless run, played optimally, to see how far the card numbers carry you.
// Reads the real constants out of main.js so it cannot drift from the game.
const anyObj = new Proxy({ width: 10 }, { get: (t, k) => (k in t ? t[k] : () => anyObj) });
const ctx = new Proxy({ canvas: { style: {} } }, {
  get: (t, k) => (k in t ? t[k] : () => anyObj), set: (t, k, v) => { t[k] = v; return true; },
});
globalThis.document = { getElementById: () => ({ getContext: () => ctx, style: {} }) };
globalThis.devicePixelRatio = 1; globalThis.innerWidth = 900; globalThis.innerHeight = 500;
globalThis.addEventListener = () => {}; globalThis.requestAnimationFrame = () => {};
const { C } = await import('../src/main.js');

// --- the card table, exactly as specified --------------------------------------
// name, levels ABOVE the one you start on, and what each one does
const CARDS = [
  ['fire rate',     8, 'x1.20 shots a second'],
  ['horn damage',   8, 'x1.25 damage a horn'],
  ['bind radius',   4, '+20% radius'],
  ['bind cooldown', 4, '-1s of cooldown'],
  ['bind duration', 4, '+0.5s held'],
  ['extra heart',   2, '+1 max heart'],
  ['regen',         2, '+1 heart between waves'],
];

const BASE = {
  fire: C._FIRE,          // seconds between shots at level 1
  dmg: 1,
  radius: 6.25,          // level 1. The 9 in the game today is level 3 of this.
  cd: C._BINDCD,
  dur: C._BINDDUR,
  maxhp: C._HEARTS,
  regen: 1,
};
const statsFor = (lv) => ({
  fire: BASE.fire / 1.2 ** lv['fire rate'],
  dmg: BASE.dmg * 1.25 ** lv['horn damage'],
  radius: BASE.radius * 1.2 ** lv['bind radius'],
  cd: BASE.cd - lv['bind cooldown'],
  dur: BASE.dur + 0.5 * lv['bind duration'],
  maxhp: BASE.maxhp + lv['extra heart'],
  regen: BASE.regen + lv.regen,
});

// --- the run --------------------------------------------------------------------
const budgetFor = (w) => C._BUD0 + C.BUDG * (w - 1);
const DT = 1 / 30;

const run = (policy, seed0) => {
  let seed = seed0;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const lv = Object.fromEntries(CARDS.map(([n]) => [n, 0]));
  let hp = BASE.maxhp, wave = 1, log = [];

  for (; wave <= 200; wave++) {
    const s = statsFor(lv);
    let budget = budgetFor(wave), spawnT = 0.6, fireT = 0, bindT = 0, chargeT = -1;
    const gs = [];
    let t = 0, lost = 0, inv = 0, totalHp = 0;

    while ((budget > 0 || gs.length) && t < 400) {
      t += DT;
      inv = Math.max(0, inv - DT);
      // spawn
      spawnT -= DT;
      if (spawnT <= 0) {
        const list = [];
        for (let k = 0; k < C._TYPES.length; k++)
          if (C._TYPES[k][4] <= wave && C._TYPES[k][3] <= budget) list.push(k);
        if (list.length) {
          const k = list[rnd() * list.length | 0];
          budget -= C._TYPES[k][3];
          spawnT = C._SPAWN;
          gs.push({ k, hp: C._TYPES[k][0], d: C._ARENA, held: 0 });
          totalHp += C._TYPES[k][0];
        }
      }
      // the bind, used the moment it is up: charge, then catch everything inside
      bindT = Math.max(0, bindT - DT);
      if (chargeT < 0 && bindT <= 0) chargeT = 0;
      else if (chargeT >= 0 && (chargeT += DT) >= C._ARM + C._BINDCHG) {
        chargeT = -1; bindT = s.cd;
        for (const g of gs) if (g.d <= s.radius && g.k !== C._WARDEN) g.held = s.dur;
      }
      // shooting: always the nearest, which is the one about to hurt you
      fireT = Math.max(0, fireT - DT);
      if (fireT <= 0 && gs.length) {
        let best = 0;
        for (let i = 1; i < gs.length; i++) if (gs[i].d < gs[best].d) best = i;
        gs[best].hp -= s.dmg;
        fireT = s.fire;
        if (gs[best].hp <= 0) {
          const dead = gs.splice(best, 1)[0];
          if (dead.k === C._SPLIT) for (let i = 0; i < 2; i++) {
            gs.push({ k: 0, hp: C._TYPES[0][0], d: dead.d, held: 0 });
            totalHp += C._TYPES[0][0];
          }
        }
      }
      // ghosts close, and arrive
      for (let i = gs.length; i--;) {
        const g = gs[i];
        if (g.held > 0) { g.held -= DT; continue; }
        g.d -= C._GSPEED * C._TYPES[g.k][1] * DT;
        if (g.d <= C._GCONTACT) {
          gs.splice(i, 1);
          if (!inv) { hp -= Math.min(C._DMGCAP, C._TYPES[g.k][2]); lost++; inv = C._IFRAME; }
        }
      }
      if (hp <= 0) break;
    }
    log.push({ wave, lost, hp, totalHp, t: Math.round(t) });
    if (hp <= 0) break;
    hp = Math.min(s.maxhp, hp + s.regen);          // regen between waves
    // take a card
    const open = CARDS.filter(([n, cap]) => lv[n] < cap);
    if (open.length) {
      const pick = policy(open, lv, rnd);
      lv[pick]++;
    }
  }
  return { wave: Math.min(wave, 200), lv, log };
};

const POLICIES = {
  random: (open, lv, rnd) => open[rnd() * open.length | 0][0],
  'fire rate first': (open) => (open.find(([n]) => n === 'fire rate')
    || open.find(([n]) => n === 'horn damage') || open[0])[0],
  'regen first': (open) => (open.find(([n]) => n === 'regen')
    || open.find(([n]) => n === 'extra heart') || open.find(([n]) => n === 'fire rate') || open[0])[0],
};

const P = (x, n = 16) => String(x).padEnd(n);
console.log('');
console.log('--- the card table ------------------------------------------------');
console.log('  ' + P('card', 16) + P('levels', 22) + 'each');
for (const [n, cap, each] of CARDS)
  console.log('  ' + P(n, 16) + P(n === 'extra heart' ? '1..2 (2 cards)'
    : n === 'regen' ? '2..3 (2 cards)' : '2..' + (cap + 1) + ' (' + cap + ' cards)', 22) + each);
const total = CARDS.reduce((a, [, c]) => a + c, 0);
console.log('  ' + P('', 16) + P('', 22) + total + ' picks to max everything, one a wave');

console.log('');
console.log('--- what a maxed player looks like --------------------------------');
const maxLv = Object.fromEntries(CARDS.map(([n, c]) => [n, c]));
const m = statsFor(maxLv), b = statsFor(Object.fromEntries(CARDS.map(([n]) => [n, 0])));
const row = (label, a, z, f = (x) => x) =>
  console.log('  ' + P(label, 18) + P(f(a), 16) + '->  ' + P(f(z), 16) +
    '(x' + (typeof a === 'number' ? (z / a).toFixed(2) : '?') + ')');
row('shots a second', 1 / b.fire, 1 / m.fire, (x) => x.toFixed(2));
row('damage a horn', b.dmg, m.dmg, (x) => x.toFixed(2));
row('damage a second', b.dmg / b.fire, m.dmg / m.fire, (x) => x.toFixed(2));
row('bind radius', b.radius, m.radius, (x) => x.toFixed(2) + 'm');
row('bind cooldown', b.cd, m.cd, (x) => x.toFixed(1) + 's');
row('bind held', b.dur, m.dur, (x) => x.toFixed(1) + 's');
row('max hearts', b.maxhp, m.maxhp);
row('regen a wave', b.regen, m.regen);
console.log('  ' + P('arena is', 18) + C._ARENA + 'm, so a maxed bind covers ' +
  (100 * (m.radius / C._ARENA) ** 2).toFixed(0) + '% of its area');

console.log('');
console.log('--- how far a run gets, played well -------------------------------');
for (const [name, pol] of Object.entries(POLICIES)) {
  const rs = [];
  for (let s = 1; s <= 40; s++) rs.push(run(pol, s * 7919));
  const waves = rs.map((r) => r.wave).sort((a, b) => a - b);
  const med = waves[waves.length >> 1];
  console.log('  ' + P(name, 18) + 'died on wave ' + P(med + ' (median)', 16) +
    'best ' + waves[waves.length - 1] + ', worst ' + waves[0]);
}

console.log('');
console.log('--- where it goes wrong, one run, card by card --------------------');
const r = run(POLICIES.random, 12345);
console.log('  ' + P('wave', 7) + P('hp to kill', 13) + P('took', 9) + P('hearts lost', 13) + 'left');
for (const l of r.log)
  console.log('  ' + P(l.wave, 7) + P(l.totalHp, 13) + P(l.t + 's', 9) + P(l.lost, 13) + l.hp);

console.log('');
console.log('--- what is one pick actually worth? ------------------------------');
console.log('  a run that takes ONE card and nothing else, against taking nothing');
const only = (name) => (open) => (open.find(([n]) => n === name) || [null])[0];
const median = (pol) => {
  const w = [];
  for (let s = 1; s <= 40; s++) w.push(run(pol, s * 7919).wave);
  w.sort((a, b) => a - b);
  return w[w.length >> 1];
};
const none = median(() => null);
console.log('  ' + P('no cards at all', 20) + 'wave ' + none);
for (const [n] of CARDS) {
  const m2 = median(only(n));
  console.log('  ' + P(n, 20) + 'wave ' + P(m2, 6) + (m2 > none ? '+' + (m2 - none) : '' + (m2 - none)) +
    ' waves for ' + CARDS.find(([q]) => q === n)[1] + ' picks');
}
console.log('');
console.log('--- and the two damage cards together -----------------------------');
const dmgOnly = (open) => (open.find(([n]) => n === 'fire rate') || open.find(([n]) => n === 'horn damage') || [null])[0];
console.log('  ' + P('fire rate + damage', 20) + 'wave ' + median(dmgOnly) + ' on 16 picks');
console.log('  ' + P('the other 16 picks', 20) + 'wave ' + median((open) => {
  const rest = open.filter(([n]) => n !== 'fire rate' && n !== 'horn damage');
  return rest.length ? rest[0][0] : null;
}) + ' on 16 picks');
