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


// How many ghosts a wave actually sends, sampled rather than taken once. The
// spawner buys at RANDOM from whatever is unlocked and affordable, and the types
// cost different amounts - so from the wave a second type unlocks, the count
// stops being a number and becomes a distribution.
const P = (x, n) => String(x).padEnd(n);
const R = (x, n) => String(x).padStart(n);
const N = 40;

const sample = (w) => {
  const out = [];
  for (let i = 0; i < N; i++) {
    M.restart(); M.setFire(0); M.look(0, 0);
    M.setWave(w);
    const b0 = M.anim().bonus;
    let k = 0;
    while (!M.anim().picking && k++ < 60 * 400) { M.place([]); tick(); }
    out.push((M.anim().bonus - b0) / C._PTW);
  }
  return out.sort((a, b) => a - b);
};

console.log('');
console.log('=== HOW MANY GHOSTS A WAVE SENDS =================================');
console.log('');
console.log('  budget = ' + C._BUD0 + ' x ' + C._BUDR + ' a wave, rounded. The spawner buys at');
console.log('  random from what is unlocked until it cannot afford anything.');
console.log('  Drifter 1, Darter 2, Hulk 5, Splitter 5, Warden 7.');
console.log('');
console.log('  ' + P('wave', 6) + R('budget', 8) + P('  unlocked', 26) +
            R('fewest', 8) + R('median', 8) + R('most', 7) + '   spread');
for (let w = 1; w <= 20; w++) {
  const b = Math.round(C._BUD0 * C._BUDR ** (w - 1));
  const un = C._TYPES.filter((t) => t[4] <= w).length;
  const names = ['Drifter', 'Darter', 'Hulk', 'Splitter', 'Warden'].slice(0, un)
    .map((n) => n.slice(0, 4)).join(' ');
  const o = sample(w);
  const lo = o[0], hi = o[o.length - 1], med = o[o.length >> 1];
  console.log('  ' + P(w, 6) + R(b, 8) + '  ' + P(names, 24) +
    R(lo, 8) + R(med, 8) + R(hi, 7) + '   ' + (lo === hi ? 'fixed' : hi - lo + ' wide'));
}
