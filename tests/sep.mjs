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

const measure = (w, frames) => {
  M.restart(); M.setFire(1); M.look(0, 0); M.setWave(w);
  const seen = [], gaps = [];
  for (let f = 0; f < frames; f++) {
    const before = M.dbg().ghosts.slice();
    tick();
    for (const o of M.dbg().ghosts) {
      if (seen.includes(o)) continue;
      seen.push(o);
      const b = Math.atan2(o[0], o[2]);
      let near = Math.PI;
      for (const q of before) {
        if (q === o) continue;
        near = Math.min(near, wrap(b - Math.atan2(q[0], q[2])));
      }
      if (before.length) gaps.push(near * DEG);
    }
  }
  gaps.sort((a, b) => a - b);
  return { n: gaps.length, min: gaps[0] || 0, p10: gaps[gaps.length / 10 | 0] || 0,
           med: gaps[gaps.length >> 1] || 0,
           tight: gaps.filter((g) => g < 10).length };
};

console.log('');
console.log('=== HOW CLOSE A NEW GHOST LANDS TO AN OLD ONE ====================');
console.log('');
console.log('  SPAWNTRY ' + C._SPAWNTRY + ' bearings a spawn, roomiest wins.');
console.log('  Waves 20 and up also count the two Drifters a dying Splitter leaves,');
console.log('  which are placed beside each other on purpose and never went through');
console.log('  spawn() at all - so the late rows read worse than the spawner is.');
console.log('');
console.log('  ' + P('wave', 7) + R('spawns', 9) + R('closest', 10) + R('10th pct', 11) +
            R('median', 9) + R('under 10 deg', 15));
for (const w of [1, 5, 10, 15, 19, 25, 36]) {
  const r = measure(w, 60 * 90);
  console.log('  ' + P(w, 7) + R(r.n, 9) + R(r.min.toFixed(1), 10) + R(r.p10.toFixed(1), 11) +
    R(r.med.toFixed(1), 9) + R(r.tight + ' of ' + r.n, 15));
}
