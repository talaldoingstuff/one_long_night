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


// Two rolls of the SAME wave, and what each is worth against what each costs you.
const roll = (w) => {
  M.restart(); M.setFire(0); M.look(0, 0);
  M.setWave(w);
  const seen = [];
  let k = 0;
  while (!M.anim().picking && k++ < 60 * 400) {
    for (const o of M.dbg().ghosts) if (!seen.includes(o)) seen.push(o.slice());
    M.place([]);
    tick();
  }
  let hp = 0, dmg = 0;
  const by = [0, 0, 0, 0, 0];
  for (const o of seen) { const t = C._TYPES[o[7]]; hp += t[0]; dmg += t[2]; by[o[7]]++; }
  return { n: seen.length, hp, dmg, by };
};

console.log('');
console.log('=== THE SAME WAVE, ROLLED TWENTY TIMES ===========================');
console.log('');
const W = 15;
console.log('  Wave ' + W + ', budget ' + Math.round(C._BUD0 * C._BUDR ** (W - 1)) +
            '. Every one of these is a legal roll of the same wave.');
console.log('');
console.log('  ' + P('ghosts', 9) + R('total hp', 10) + R('damage', 9) +
            R('clear pays', 12) + R('perfect', 9) + '   what it sent');
const rolls = [];
for (let i = 0; i < 20; i++) rolls.push(roll(W));
rolls.sort((a, b) => a.n - b.n);
for (const r of [rolls[0], rolls[rolls.length >> 1], rolls[rolls.length - 1]]) {
  console.log('  ' + P(r.n, 9) + R(r.hp, 10) + R(r.dmg, 9) +
    R(r.n * C._PTW, 12) + R(r.n * 3, 9) + '   ' +
    ['Drif', 'Dart', 'Hulk', 'Spli', 'Ward'].map((s, i) => r.by[i] ? r.by[i] + ' ' + s : null)
      .filter(Boolean).join(', '));
}
const lo = rolls[0], hi = rolls[rolls.length - 1];
console.log('');
console.log('  The lightest roll sends ' + hi.n + ' and pays ' + hi.n * 3 + '.');
console.log('  The heaviest sends ' + lo.n + ' and pays ' + lo.n * 3 + ' - for ' +
            (lo.hp / hi.hp).toFixed(2) + 'x the hp to chew through');
console.log('  and ' + (lo.dmg / hi.dmg).toFixed(2) + 'x the damage coming at you.');
console.log('');
console.log('  So the harder the wave rolls, the LESS it pays. That is not variance,');
console.log('  it is backwards.');
