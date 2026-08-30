// The ghost roster and the wave budget, printed from the real constants.
const anyObj = new Proxy({ width: 10 }, { get: (t, k) => (k in t ? t[k] : () => anyObj) });
const ctx = new Proxy({ canvas: { style: {} } }, { get: (t, k) => (k in t ? t[k] : () => anyObj), set: () => true });
globalThis.document = { getElementById: () => ({ getContext: () => ctx, style: {} }) };
globalThis.devicePixelRatio = 1; globalThis.innerWidth = 900; globalThis.innerHeight = 500;
globalThis.addEventListener = () => {}; globalThis.requestAnimationFrame = () => {};
const { C } = await import('../src/main.js');

const NAMES = ['Drifter', 'Darter', 'Hulk', 'Splitter', 'Warden'];
const SPECIAL = ['-', '-', '-', 'dies into two Drifters', 'immune to the bind'];
const P = (x, n) => String(x).padEnd(n);
const R = (x, n) => String(x).padStart(n);

console.log('');
console.log('=== THE GHOSTS ===================================================');
console.log('');
console.log('  ' + P('type', 10) + R('hp', 4) + R('speed', 7) + R('dmg', 5) + R('cost', 6) +
            R('wave', 6) + R('radius', 8) + R('teeth', 7) + '  special');
for (let k = 0; k < C._TYPES.length; k++) {
  const t = C._TYPES[k];
  console.log('  ' + P(NAMES[k], 10) + R(t[0], 4) + R(t[1].toFixed(1) + 'x', 7) + R(t[2], 5) +
    R(t[3], 6) + R(t[4], 6) + R(t[5] + 'm', 8) + R(t[8], 7) + '  ' + SPECIAL[k]);
}

console.log('');
console.log('  derived --------------------------------------------------------');
console.log('  ' + P('type', 10) + R('hp/cost', 9) + R('m/s', 7) + R('walk-in', 9) +
            R('shots @lv1', 12) + R('dmg/cost', 10));
for (let k = 0; k < C._TYPES.length; k++) {
  const t = C._TYPES[k];
  const hp = k === C._SPLIT ? t[0] + 2 * C._TYPES[0][0] : t[0];   // a Splitter is really 6+3+3
  const walk = (C._ARENA - C._GCONTACT) / (C._GSPEED * t[1]);
  console.log('  ' + P(NAMES[k], 10) + R((hp / t[3]).toFixed(2), 9) +
    R((C._GSPEED * t[1]).toFixed(2), 7) + R(walk.toFixed(1) + 's', 9) +
    R(hp, 12) + R((t[2] / t[3]).toFixed(2), 10));
}
console.log('');
console.log('  hp/cost counts a Splitter as all 12 hp it really costs you to clear.');
console.log('  walk-in is spawn ring to contact: ' + C._ARENA + 'm to ' + C._GCONTACT + 'm.');

// --- the budget ------------------------------------------------------------------
console.log('');
console.log('=== THE THREAT BUDGET, WAVES 1-36 ================================');
console.log('');
console.log('  budget = ' + C._BUD0 + ' x ' + C._BUDR + ' per wave after the first');
console.log('  spawner buys at random from what is unlocked, every ' + C._SPAWN +
            's x ' + C._SPAWNR + ' a wave');
console.log('');
console.log('  ' + P('wave', 6) + R('budget', 8) + P('  unlocked', 34) +
            R('ghosts', 8) + R('total hp', 10) + R('lasts', 8) + R('hp/s', 7));

let seed = 991;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const sample = (w) => {                     // 400 rolls of the real buy loop
  let n = 0, hp = 0;
  const runs = 400;
  for (let r = 0; r < runs; r++) {
    let b = Math.round(C._BUD0 * C._BUDR ** (w - 1));
    for (;;) {
      const list = [];
      for (let k = 0; k < C._TYPES.length; k++)
        if (C._TYPES[k][4] <= w && C._TYPES[k][3] <= b) list.push(k);
      if (!list.length) break;
      const k = list[rnd() * list.length | 0];
      b -= C._TYPES[k][3];
      n++;
      hp += C._TYPES[k][0] + (k === C._SPLIT ? 2 * C._TYPES[0][0] : 0);
    }
  }
  return { n: n / runs, hp: hp / runs };
};

for (let w = 1; w <= 36; w++) {
  const budget = Math.round(C._BUD0 * C._BUDR ** (w - 1));
  const un = [];
  for (let k = 0; k < C._TYPES.length; k++) if (C._TYPES[k][4] <= w) un.push(NAMES[k].slice(0, 4));
  const { n, hp } = sample(w);
  const lasts = n * C._SPAWN * C._SPAWNR ** (w - 1);
  const mark = C._TYPES.some((t) => t[4] === w) ? ' <- new type' : '';
  console.log('  ' + P(w, 6) + R(budget, 8) + '  ' + P(un.join(' '), 32) +
    R(n.toFixed(1), 8) + R(hp.toFixed(0), 10) + R(lasts.toFixed(0) + 's', 8) +
    R((hp / lasts).toFixed(2), 7) + mark);
}

console.log('');
console.log('  hp/s is what you must out-damage. Both the budget and the spawn rate');
console.log('  are geometric now, so it keeps climbing rather than settling.');
