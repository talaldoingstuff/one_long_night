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


// The gap AT SPAWN between a new ghost and whatever is already out there.
const P = (x, n) => String(x).padEnd(n);
const R = (x, n) => String(x).padStart(n);
const DEG = 180 / Math.PI;
const wrap = (a) => Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));


// Is the spawner spacing them EVENLY, or only keeping them off each other?
// Best-of-N maximises the gap, which is a stronger rule than 'do not overlap' -
// so this measures how strong.
const runs = (w, tries, frames) => {
  C._SPAWNTRY = tries;
  M.restart(); M.setFire(1); M.look(0, 0); M.setWave(w);
  const seen = [], rows = [];
  for (let f = 0; f < frames; f++) {
    const before = M.dbg().ghosts.slice();
    tick();
    for (const o of M.dbg().ghosts) {
      if (seen.includes(o)) continue;
      seen.push(o);
      if (before.length < 2) continue;
      const b = Math.atan2(o[0], o[2]);
      let near = Math.PI;
      for (const q of before) if (q !== o) near = Math.min(near, wrap(b - Math.atan2(q[0], q[2])));
      // The evenest possible gap with this many on the ring
      rows.push({ gap: near * DEG, even: 360 / (before.length + 1) / 2 });
    }
  }
  return rows;
};

const stat = (rows) => {
  const r = rows.map((x) => x.gap / x.even).sort((a, b) => a - b);
  return { n: r.length, min: r[0], med: r[r.length >> 1], max: r[r.length - 1] };
};

console.log('');
console.log('=== IS IT SPACING THEM EVENLY, OR JUST KEEPING THEM APART? =======');
console.log('');
console.log('  Each spawn scored against the evenest gap available to it. 1.00 means');
console.log('  it landed exactly halfway into the roomiest space - perfectly regular.');
console.log('  Near 0 means it landed on top of something.');
console.log('');
console.log('  ' + P('wave', 7) + P('spawner', 22) + R('spawns', 8) +
            R('worst', 8) + R('median', 9) + R('best', 8));
for (const w of [5, 15, 30]) {
  for (const [t, nm] of [[1, 'pure random'], [8, 'best of 8 (now)']]) {
    const r = stat(runs(w, t, 60 * 90));
    if (!r.n) continue;
    console.log('  ' + P(w, 7) + P(nm, 22) + R(r.n, 8) + R(r.min.toFixed(2), 8) +
      R(r.med.toFixed(2), 9) + R(r.max.toFixed(2), 8));
  }
}
C._SPAWNTRY = 8;
