// How far does a run actually get?
//
// This DRIVES THE GAME rather than modelling it. The old version re-implemented
// the spawner, the roster and the cards in its own arithmetic, and then the real
// ones were tuned underneath it - so it kept answering confidently about numbers
// that had not existed for weeks. Nothing here knows a rule; it presses keys,
// points the camera and reads the same dbg() the tests read.
//
// Math.random is DESTRUCTURED at the top of main.js, so it has to be replaced
// before the import and cannot be swapped afterwards. The generator below closes
// over a mutable seed instead, which is what lets each run differ.
let seed = 1;
Math.random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

const anyObj = new Proxy({ width: 10 }, { get: (t, k) => (k in t ? t[k] : () => anyObj) });
const ctx = new Proxy({ canvas: { style: {} } }, {
  get: (t, k) => (k in t ? t[k] : () => anyObj), set: () => true,
});
globalThis.document = { getElementById: () => ({ getContext: () => ctx, style: {} }) };
globalThis.devicePixelRatio = 1; globalThis.innerWidth = 900; globalThis.innerHeight = 500;
let rafCb = null;
const L = Object.create(null);
globalThis.addEventListener = (t, f) => { (L[t] ||= []).push(f); };
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; };

// A press builds an AudioContext, and there is not one here. Silence rather than
// a recorder: this probe is about survival, and the sound tests already cover the
// sound.
const noop = () => {};
const param = { value: 0, setValueAtTime: noop, linearRampToValueAtTime: noop,
                exponentialRampToValueAtTime: noop };
const node = { frequency: param, gain: param, pan: param, Q: param, type: '', buffer: null,
               connect: () => node, start: noop, stop: noop,
               threshold: param, knee: param, ratio: param, attack: param, release: param };
globalThis.AudioContext = function () {
  return {
    currentTime: 0, sampleRate: 44100, state: 'running', destination: node, resume: noop,
    createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }),
    createGain: () => node, createStereoPanner: () => node, createOscillator: () => node,
    createBufferSource: () => node, createBiquadFilter: () => node,
    createDynamicsCompressor: () => node,
  };
};

const M = await import('../src/main.js');
const C = M.C;

let clock = 0;
const tick = () => { clock += 1000 / 60; rafCb(clock); };
const key = (type, code) => (L[type] || []).forEach((f) => f({ type, code, preventDefault() {} }));

const NAMES = ['SHOT RATE', 'SHOT DAMAGE', 'RAINBOW RADIUS', 'RAINBOW COOLDOWN',
               'RAINBOW HOLD', 'EXTRA HEART', 'HEAL'];

// --- how a player picks cards ------------------------------------------------------
// An order of preference over the seven. Whichever of the three on offer comes
// first in the list is taken.
const PLANS = {
  'all guns':   [0, 1, 2, 3, 4, 5, 6],
  'balanced':   [5, 6, 0, 2, 1, 4, 3],
  'rainbow':    [2, 4, 3, 5, 0, 1, 6],
  'careless':   null,                             // takes whatever is in slot 1
};

// --- how a player aims -------------------------------------------------------------
// Three of them, because the first pass had only 'instant' and 'keyboard' and the
// truth is neither: most people will play this with a mouse, and a flick is far
// faster than KTURN. Reporting a keyboard median as THE median would have been
// the same mistake the old probe made, one level up.
const AIMS = {
  perfect:  1e9,      // turns instantly. An upper bound nobody reaches
  mouse:    9,        // radians a second - about a flick
  keyboard: 2.04,     // exactly KTURN
};
const REACT = 0.25;   // seconds before it accepts that the nearest has changed

const bearing = (o) => Math.atan2(o[0], o[2]);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const run = (plan, aim, s) => {
  seed = s;
  M.restart();
  M.setFire(1);
  M.look(0, 0);
  let yaw = 0, want = 0, react = 0, held = 0;
  // A run that hits this stopped because the clock ran out, not because it died,
  // and reporting the wave it reached as 'died at' would be a lie. The first pass
  // capped at twelve sim-minutes and every strong build reported exactly 33.
  const CAP = 60 * 60 * 40;
  let f = 0;
  for (; f < CAP && !M.dbg().over; f++) {
    const d = M.dbg(), a = M.anim();

    if (a.picking) {
      const n = PLANS[plan]
        ? Math.max(0, a.offer.findIndex((i) => i === PLANS[plan]
            .find((p) => a.offer.includes(p))))
        : 0;
      key('keydown', 'Digit' + (n + 1));
      key('keyup', 'Digit' + (n + 1));
      continue;                                   // the pick advances the wave itself
    }

    // Aim at whatever is closest: with no way to retreat, the nearest thing is
    // always the most urgent, whatever else is on the field.
    let near = null, nd = 1e9;
    for (const o of d.ghosts) {
      if (o[8] > 0) continue;                     // held by the rainbow, not a threat
      const q = Math.hypot(o[0], o[2]);
      if (q < nd) { nd = q; near = o; }
    }
    if (near) {
      if ((react -= 1 / 60) <= 0) { want = bearing(near); react = REACT; }
      const e = wrap(want - yaw);
      yaw += Math.sign(e) * Math.min(Math.abs(e), AIMS[aim] / 60);
      M.look(yaw, 0);
    }

    // The rainbow, on the one rule that matters: cast it when it is worth casting.
    // Two loose inside the ring it WILL have at full charge, or one nearly on you.
    const maxR = C._BINDR * C._RADG ** a.lv[2];
    const inside = d.ghosts.filter((o) => o[8] <= 0 && Math.hypot(o[0], o[2]) <= maxR).length;
    if (!held && !a.bindT && (inside >= 2 || (near && nd < 4))) { key('keydown', 'Space'); held = 1; }
    if (held && a.bindT) { key('keyup', 'Space'); held = 0; }

    tick();
  }
  // wave lives on anim(), not dbg() - reading it off dbg() gave NaN for every run.
  return { waves: M.anim().wave - 1, kills: M.dbg().kills, lv: M.anim().lv.slice(),
           alive: f >= CAP };
};


// Can a player out-level the horn while leaving the rainbow at 1? The weights say
// the trailing side is drawn twice as often; nothing says it has to be TAKEN.
const P = (x, n) => String(x).padEnd(n);
const R = (x, n) => String(x).padStart(n);
const HORNCAP = C._CARDS[0][0] + C._CARDS[1][0];
const BINDCAP = C._CARDS[2][0] + C._CARDS[3][0] + C._CARDS[4][0];

const trace = (plan, s) => {
  seed = s;
  M.restart(); M.setFire(1); M.look(0, 0);
  const rows = [];
  let yaw = 0, want = 0, react = 0, held = 0, seenWave = 0;
  for (let f = 0; f < 60 * 60 * 40 && !M.dbg().over && M.anim().wave <= 24; f++) {
    const d = M.dbg(), a = M.anim();
    if (a.picking) {
      const offered = a.offer.slice();
      const n = Math.max(0, a.offer.findIndex((i) => i === PLANS[plan].find((p) => a.offer.includes(p))));
      key('keydown', 'Digit' + (n + 1)); key('keyup', 'Digit' + (n + 1));
      rows.push({ w: a.wave, offered, took: offered[n], lv: M.anim().lv.slice() });
      continue;
    }
    let near = null, nd = 1e9;
    for (const o of d.ghosts) {
      if (o[8] > 0) continue;
      const q = Math.hypot(o[0], o[2]);
      if (q < nd) { nd = q; near = o; }
    }
    if (near) {
      if ((react -= 1 / 60) <= 0) { want = Math.atan2(near[0], near[2]); react = REACT; }
      const e = Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw));
      yaw += Math.sign(e) * Math.min(Math.abs(e), 9 / 60);
      M.look(yaw, 0);
    }
    const maxR = C._BINDR * C._RADG ** a.lv[2];
    const inside = d.ghosts.filter((o) => o[8] <= 0 && Math.hypot(o[0], o[2]) <= maxR).length;
    if (!held && !a.bindT && (inside >= 2 || (near && nd < 4))) { key('keydown', 'Space'); held = 1; }
    if (held && a.bindT) { key('keyup', 'Space'); held = 0; }
    tick();
  }
  return rows;
};


// Sweep _ADAPT, in BOTH directions. The weighting is meant to be symmetric - the
// trailing SIDE is boosted, whichever it is - so a rainbow-greedy player should
// be pushed toward the horn exactly as a horn-greedy one is pushed to the bind.
const gapsFor = (plan, adapt, seeds) => {
  C._ADAPT = adapt;
  const at10 = [], worst = [];
  for (const sd of seeds) {
    const rows = trace(plan, sd);
    let mx = 0, ten = 0;
    for (const r of rows) {
      const horn = 100 * (r.lv[0] + r.lv[1]) / HORNCAP;
      const bind = 100 * (r.lv[2] + r.lv[3] + r.lv[4]) / BINDCAP;
      const g = Math.abs(horn - bind);
      if (g > mx) mx = g;
      if (r.w === 10) ten = g;
    }
    at10.push(ten); worst.push(mx);
  }
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  return { ten: avg(at10), worst: avg(worst) };
};

const SEEDS = [1000, 8919, 16838];
console.log('');
console.log('=== HOW HARD THE DRAW PUSHES YOU BACK ============================');
console.log('');
console.log('  The gap between the two halves, each measured against its OWN cap.');
console.log('  0% means level with each other; 100% means one is maxed and the');
console.log('  other untouched. Average of three runs.');
console.log('');
console.log('  ' + P('_ADAPT', 9) + R('horn-greedy @10', 18) + R('worst', 8) +
            R('  |  ', 7) + R('rainbow-greedy @10', 20) + R('worst', 8));
for (const a of [2, 4, 6, 9, 14]) {
  const H = gapsFor('all guns', a, SEEDS), B = gapsFor('rainbow', a, SEEDS);
  console.log('  ' + P(a, 9) + R(H.ten.toFixed(0) + '%', 18) + R(H.worst.toFixed(0) + '%', 8) +
    R('  |  ', 7) + R(B.ten.toFixed(0) + '%', 20) + R(B.worst.toFixed(0) + '%', 8));
}
C._ADAPT = 2;
