// A proposed roster and curve, measured. Nothing here touches the game yet.
const anyObj = new Proxy({ width: 10 }, { get: (t, k) => (k in t ? t[k] : () => anyObj) });
const ctx = new Proxy({ canvas: { style: {} } }, { get: (t, k) => (k in t ? t[k] : () => anyObj), set: () => true });
globalThis.document = { getElementById: () => ({ getContext: () => ctx, style: {} }) };
globalThis.devicePixelRatio = 1; globalThis.innerWidth = 900; globalThis.innerHeight = 500;
globalThis.addEventListener = () => {}; globalThis.requestAnimationFrame = () => {};
const { C } = await import('../src/main.js');

const NAMES = ['Drifter', 'Darter', 'Hulk', 'Splitter', 'Warden'];
// hp, speed, damage, cost, unlock wave
const T = [
  [3, 1.15, 1, 1, 1],
  [4, 2.40, 1, 2, 5],
  [18, 0.70, 3, 5, 10],
  [10, 1.00, 1, 5, 20],
  [16, 0.90, 2, 7, 30],
];
const SPLIT = 3, WARDEN = 4;
const BUD0 = 6, BUDG = 3;
const SPAWN = 1.5, SPAWNG = 0.05;          // interval shrinks: SPAWN / (1 + SPAWNG*(w-1))
const ARENA = C._ARENA, CONTACT = C._GCONTACT;

const realHp = (k) => T[k][0] + (k === SPLIT ? 2 * T[0][0] : 0);
const interval = (w) => SPAWN / (1 + SPAWNG * (w - 1));
const budget = (w) => BUD0 + BUDG * (w - 1);

const P = (x, n) => String(x).padEnd(n);
const R = (x, n) => String(x).padStart(n);

console.log('');
console.log('=== PROPOSED ROSTER ==============================================');
console.log('  ' + P('type', 10) + R('hp', 5) + R('was', 5) + R('speed', 7) + R('was', 6) +
  R('dmg', 5) + R('cost', 6) + R('was', 5) + R('wave', 6) + R('walk-in', 9) + R('hp/cost', 9));
for (let k = 0; k < 5; k++) {
  const o = C._TYPES[k];
  console.log('  ' + P(NAMES[k], 10) + R(T[k][0], 5) + R(o[0], 5) + R(T[k][1].toFixed(2), 7) +
    R(o[1].toFixed(1), 6) + R(T[k][2], 5) + R(T[k][3], 6) + R(o[3], 5) + R(T[k][4], 6) +
    R(((ARENA - CONTACT) / T[k][1]).toFixed(1) + 's', 9) + R((realHp(k) / T[k][3]).toFixed(2), 9));
}
console.log('');
console.log('  hp/cost spread is now ' +
  Math.min(...T.map((t, k) => realHp(k) / t[3])).toFixed(2) + '-' +
  Math.max(...T.map((t, k) => realHp(k) / t[3])).toFixed(2) +
  ', against 1.00-3.00 today: cost tracks work much more closely.');

// --- the curve --------------------------------------------------------------------
let seed = 4242;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const sample = (w) => {
  let n = 0, hp = 0, dmg = 0;
  const runs = 500;
  for (let r = 0; r < runs; r++) {
    let b = budget(w);
    for (;;) {
      const list = [];
      for (let k = 0; k < 5; k++) if (T[k][4] <= w && T[k][3] <= b) list.push(k);
      if (!list.length) break;
      const k = list[rnd() * list.length | 0];
      b -= T[k][3]; n++; hp += realHp(k); dmg += T[k][2];
    }
  }
  return { n: n / runs, hp: hp / runs, dmg: dmg / runs };
};

// what the player can have by wave w: one card a wave, spent on fire rate then damage
const dpsAt = (w) => {
  const picks = w - 1;
  const f = Math.min(8, Math.ceil(picks / 2)), d = Math.min(8, Math.floor(picks / 2));
  return (1.25 ** d) / (C._FIRE / (1.2 ** f));
};

console.log('');
console.log('=== THE CURVE, WAVES 1-36 ========================================');
console.log('  budget ' + BUD0 + ' + ' + BUDG + '/wave;  spawn every ' + SPAWN +
  's / (1 + ' + SPAWNG + ' x waves)');
console.log('');
console.log('  ' + P('wave', 6) + R('budget', 7) + R('every', 7) + R('ghosts', 7) +
  R('hp', 6) + R('lasts', 7) + R('hp/s', 7) + R('dps you', 8) + R('margin', 8));
let prev = 0;
for (let w = 1; w <= 36; w++) {
  const iv = interval(w), s = sample(w);
  const lasts = s.n * iv, rate = s.hp / lasts, you = dpsAt(w);
  const jump = prev ? (rate / prev - 1) * 100 : 0;
  const mark = T.some((t) => t[4] === w) ? '  <- ' + NAMES[T.findIndex((t) => t[4] === w)]
    : (jump > 12 ? '  <- +' + jump.toFixed(0) + '%' : '');
  console.log('  ' + P(w, 6) + R(budget(w), 7) + R(iv.toFixed(2) + 's', 7) + R(s.n.toFixed(1), 7) +
    R(s.hp.toFixed(0), 6) + R(lasts.toFixed(0) + 's', 7) + R(rate.toFixed(2), 7) +
    R(you.toFixed(2), 8) + R((you - rate >= 0 ? '+' : '') + (you - rate).toFixed(2), 8) + mark);
  prev = rate;
}
console.log('');
console.log('  "dps you" assumes one card a wave, alternated fire rate / damage - the');
console.log('  strongest line there is. Margin going negative is where it stops being');
console.log('  survivable by shooting alone and the bind has to carry it.');
