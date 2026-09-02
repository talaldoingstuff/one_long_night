// The desktop-only gate, which needs a file of its own.
//
// `coarse` is read ONCE at import time - it is a property of the device and
// asking every frame would be a media query sixty times a second for an answer
// that cannot change. So a check that wants the coarse branch has to have
// matchMedia answering before main.js is imported, and tests/loop.mjs has already
// imported it. Hence a separate process.
let seed = 1;
Math.random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

// THE STUB THIS FILE EXISTS FOR. Answers coarse to (pointer:coarse) and fine to
// anything else, which is what a phone reports.
globalThis.matchMedia = (q) => ({ matches: /coarse/.test(q) });

const rec = { ops: [], style: '#000', font: '' };
const anyObj = new Proxy({ width: 10 }, { get: (t, k) => (k in t ? t[k] : () => anyObj) });
const canvas = { style: {}, width: 0, height: 0 };
const ctx = new Proxy({ canvas }, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'fillRect') return (x, y, w, h) =>
      rec.ops.push({ op: 'rect', x, y, w, h, c: rec.style });
    if (k === 'fillText') return (s, x, y) =>
      rec.ops.push({ op: 'text', s, x, y, c: rec.style, f: parseFloat(rec.font) });
    return () => anyObj;
  },
  set(t, k, v) {
    if (k === 'fillStyle') rec.style = v;
    if (k === 'font') rec.font = v;
    return true;
  },
});
globalThis.document = { getElementById: () => ({ getContext: () => ctx, style: {} }) };
globalThis.devicePixelRatio = 1;
globalThis.innerWidth = 420; globalThis.innerHeight = 900;      // a phone, upright
// Both recorded rather than swallowed. The bug this file missed was that the game
// kept RUNNING behind the sign - the loop was still scheduled and the handlers were
// still bound - and a stub that quietly accepts either cannot see that.
let rafCb = null;
const bound = [];
globalThis.addEventListener = (t, f) => bound.push([t, f]);
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; };
const noop = () => {};
const param = { value: 0, setValueAtTime: noop, linearRampToValueAtTime: noop,
                exponentialRampToValueAtTime: noop };
const node = { frequency: param, gain: param, pan: param, Q: param, type: '', buffer: null,
               connect: () => node, start: noop, stop: noop,
               threshold: param, knee: param, ratio: param, attack: param, release: param };
globalThis.AudioContext = function () {
  return { currentTime: 0, sampleRate: 44100, state: 'running', destination: node, resume: noop,
           createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }),
           createGain: () => node, createStereoPanner: () => node, createOscillator: () => node,
           createBufferSource: () => node, createBiquadFilter: () => node,
           createDynamicsCompressor: () => node };
};
globalThis.localStorage = { getItem: () => null, setItem: noop };

const M = await import('../src/main.js');
const C = M.C;

let failed = 0;
const ok = (l, c, x) => { if (!c) failed++;
  console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x ? '  ' + x : '')); };
process.on('exit', () => failed && process.exitCode === undefined && (process.exitCode = 1));

console.log('');
console.log('--- the desktop-only gate ------------------------------------------');

// No tick: there is no loop to tick. resize() painted the sign as the module ran,
// so the first frame is already in rec.ops - kept, because the rotate check below
// clears them and everything about sizing is asked of THIS frame.
const first = rec.ops.slice();
const txt = () => first.filter((o) => o.op === 'text').map((o) => o.s);

const P = C._GATE.split('|');
ok('a coarse pointer gets the gate instead of the game',
   P.every((line) => txt().includes(line)),
   '"' + txt().join('" / "') + '"');

// The point of a gate is that nothing behind it runs. THREAT LEVEL and the wave
// number are the first things a frame of the real game draws.
ok('and none of the game is drawn behind it',
   !txt().some((s) => /WAVE|THREAT|ANYWHERE|CENTURIES/i.test(s)),
   'no HUD, no title, no lore - the frame returns at the gate and nothing after ' +
   'it runs, so a phone cannot half-play this');

ok('and it is drawn over black rather than over the world',
   first.some((o) => o.op === 'rect' && o.c === '#000' && o.w >= 420),
   'the sky is not drawn at all: the gate is the whole frame');

// --- THE ONE THE FIRST VERSION OF THIS FILE MISSED ---------------------------
// It only checked that nothing was DRAWN, and passed while the game ran happily
// underneath: waves spawning, music playing, and a tap building an AudioContext
// and firing the horn. On a real phone you could hear it.
ok('and the game loop never starts at all',
   rafCb === null,
   'requestAnimationFrame was never called, so step() never runs - no waves, no ' +
   'music, no clock. Gating the DRAWING left all of that running in the dark');

ok('and no input is bound except resize',
   bound.length === 1 && bound[0][0] === 'resize',
   'bound: ' + bound.map((b) => b[0]).join(', ') + '. A tap used to reach onDown, ' +
   'which starts the ' +
   'audio context and advances the screen - the sound came from a game nobody ' +
   'could see');

// Actually fire it, rather than assert that it exists. The sign is painted once
// and never again, so if the one bound listener did not repaint it, turning the
// phone would leave a black screen and nothing else.
rec.ops = [];
globalThis.innerWidth = 900; globalThis.innerHeight = 420;      // turned sideways
bound[0][1]();
const after = rec.ops.filter((o) => o.op === 'text').map((o) => o.s);
ok('and turning the phone repaints the sign rather than losing it',
   P.every((line) => after.includes(line)),
   'landscape 900x420 repaints "' + after.join('" / "') + '" - painted from ' +
   'resize(), the one listener still bound');

// The heading has to survive a phone held upright, which is the one shape it is
// guaranteed to be read in. This is the mistake the title screen already made
// once - u comes off the NARROW side, and on a portrait window that is the width.
const head = first.find((o) => o.op === 'text' && o.s === P[0]);
const body = first.filter((o) => o.op === 'text' && o.s !== P[0]);
ok('and the heading is the largest thing on it',
   body.every((o) => o.f < head.f),
   'heading ' + head.f + 'px over body at ' + body.map((o) => o.f).join(', ') + 'px');

// Both strings measured in Palatino in headless Chrome, as width per 1px of font
// size. Retyped here rather than guessed: the line is nearly three times the width
// of the heading for the same size, and an over-estimate that flatters it would let
// a real overflow through.
const RATIO = { 'DESKTOP ONLY': 7.693, 'One Long Night': 7.229,
                'can only be played on a computer.': 15.209 };
ok('and it fits across a 420px phone held upright',
   first.filter((o) => o.op === 'text').every((o) => o.f * RATIO[o.s] < 420 * 0.92),
   first.filter((o) => o.op === 'text')
     .map((o) => (100 * o.f * RATIO[o.s] / 420).toFixed(0) + '%').join(', ') +
   ' of the width - capped against W, because on a portrait window the narrow side ' +
   'IS the width');

// The ratios above only mean anything for the strings they were measured on.
ok('and the words are the ones those widths were measured for',
   Object.keys(RATIO).join('|') === C._GATE,
   'if this fails, re-measure the new wording in Palatino and bring the caps in ' +
   'src/main.js with it - the check cannot know a string it has never been shown');

ok('and the words say which machine to use, not merely that this one is wrong',
   /computer|desktop/i.test(C._GATE),
   '"' + C._GATE.replace(/\|/g, ' / ') + '" - a dead end that does not say where ' +
   'to go is worse than no message');

console.log('');
console.log(failed ? '  ' + failed + ' problem(s)' : '  a finger gets a sign, not a broken game');
