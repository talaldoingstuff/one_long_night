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


// How many are on the field at once, and how close together they get. A minimum
// gap at spawn only works if there is room for one.
const P = (x, n) => String(x).padEnd(n);
const R = (x, n) => String(x).padStart(n);
const DEG = 180 / Math.PI;

const wave = (w, frames) => {
  M.restart(); M.setFire(1); M.look(0, 0);
  M.setWave(w);
  let peak = 0, worstGap = 360, sumGap = 0, n = 0;
  for (let f = 0; f < frames; f++) {
    tick();
    const g = M.dbg().ghosts;
    if (g.length > peak) peak = g.length;
    if (g.length > 1) {
      const b = g.map((o) => Math.atan2(o[0], o[2])).sort((x, y) => x - y);
      for (let i = 1; i < b.length; i++) {
        const d = (b[i] - b[i - 1]) * DEG;
        if (d < worstGap) worstGap = d;
      }
      // the tightest gap this frame, averaged over the wave
      let tight = 360;
      for (let i = 1; i < b.length; i++) tight = Math.min(tight, (b[i] - b[i - 1]) * DEG);
      sumGap += tight; n++;
    }
  }
  return { peak, worstGap, meanTight: n ? sumGap / n : 0 };
};

console.log('');
console.log('=== HOW CROWDED THE RING GETS ====================================');
console.log('');
console.log('  Bearings are measured from the CAMERA, so two on the same bearing');
console.log('  are the ones hiding behind each other.');
console.log('');
console.log('  ' + P('wave', 7) + R('most alive at once', 20) + R('room each', 12) +
            R('tightest pair', 15) + R('mean tightest', 15));
for (const w of [1, 5, 10, 15, 20, 25, 30, 36]) {
  const r = wave(w, 60 * 90);
  console.log('  ' + P(w, 7) + R(r.peak, 20) + R((360 / Math.max(1, r.peak)).toFixed(0) + ' deg', 12) +
    R(r.worstGap.toFixed(1) + ' deg', 15) + R(r.meanTight.toFixed(1) + ' deg', 15));
}
