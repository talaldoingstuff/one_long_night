// Every browser API the game touches, checked against what a real browser has.
// The loop harness answers "does it run"; this answers "does it run THERE",
// which a Proxy that no-ops everything cannot.
const touched = { ctx: new Set(), doc: new Set(), win: new Set(), canvas: new Set(),
                  audio: new Set(), node: new Set(), param: new Set() };

const anyObj = new Proxy({ width: 10 }, { get: (t, k) => (k in t ? t[k] : () => anyObj) });
const canvas = new Proxy({ style: {}, width: 0, height: 0 }, {
  get(t, k) { if (typeof k === 'string') touched.canvas.add(k); return t[k]; },
  set(t, k, v) { if (typeof k === 'string') touched.canvas.add(k); t[k] = v; return true; },
});
const ctx = new Proxy({ canvas }, {
  get(t, k) {
    if (typeof k !== 'string') return undefined;
    touched.ctx.add(k);
    if (k === 'canvas') return canvas;
    return () => anyObj;
  },
  set(t, k, v) { if (typeof k === 'string') touched.ctx.add(k); t[k] = v; return true; },
});

// The audio graph, recorded the same way as the canvas: every property the game
// reaches for on a context, a node, or an automation parameter, so it can be
// checked against what a browser actually exposes rather than against a no-op.
const param = new Proxy({}, {
  get(t, k) { if (typeof k === 'string') touched.param.add(k); return () => param; },
  set(t, k) { if (typeof k === 'string') touched.param.add(k); return true; },
});
const node = new Proxy({}, {
  get(t, k) {
    if (typeof k !== 'string') return undefined;
    touched.node.add(k);
    if (k === 'frequency' || k === 'gain' || k === 'pan') return param;
    return () => node;                                    // connect() returns its target
  },
  set(t, k) { if (typeof k === 'string') touched.node.add(k); return true; },
});
globalThis.AudioContext = function () {
  return new Proxy({}, {
    get(t, k) {
      if (typeof k !== 'string') return undefined;
      touched.audio.add(k);
      if (k === 'currentTime') return 0;
      if (k === 'state') return 'running';
      if (k === 'destination') return node;
      return () => node;
    },
    set(t, k) { if (typeof k === 'string') touched.audio.add(k); return true; },
  });
};

let rafCb = null;
const L = Object.create(null);
globalThis.document = new Proxy({
  getElementById: () => ({ getContext: (kind) => { touched.canvas.add('getContext:' + kind); return ctx; }, style: {} }),
}, { get(t, k) { if (typeof k === 'string') touched.doc.add(k); return t[k]; } });
const W = { devicePixelRatio: 1, innerWidth: 900, innerHeight: 500 };
for (const k of Object.keys(W)) Object.defineProperty(globalThis, k, { get: () => { touched.win.add(k); return W[k]; }, configurable: true });
globalThis.addEventListener = (t, f) => { touched.win.add('addEventListener:' + t); (L[t] ||= []).push(f); };
globalThis.requestAnimationFrame = (cb) => { touched.win.add('requestAnimationFrame'); rafCb = cb; };

const M = await import('../src/main.js');
const C = M.C;
let t = 0;
const tick = () => { t += 1000 / 60; rafCb(t); };
const fire = (ty, e) => (L[ty] || []).forEach((f) => f(e));

// Drive it through every state that draws anything.
tick();
M.restart(); M.look(0, 0);
M.place([[3, C._GY, 0, 9, 9, C._GFLASH, 0, 0, 0], [0, C._GY, 6, 9, 9, 0, 0, 4, -0.2],
         [2, C._GY, 5, 9, 9, 0, 0, 2, 1.5]]);
for (let i = 0; i < 60; i++) tick();
fire('pointerdown', { clientX: 450, clientY: 250 });
fire('pointermove', { clientX: 470, clientY: 240 });
for (let i = 0; i < 260; i++) tick();               // arm, charge, cast, wall
fire('pointerup', {});
fire('keydown', { type: 'keydown', code: 'KeyD', preventDefault() {} });
for (let i = 0; i < 30; i++) tick();
fire('keyup', { type: 'keyup', code: 'KeyD', preventDefault() {} });
fire('keydown', { type: 'keydown', code: 'KeyM', preventDefault() {} });
fire('keydown', { type: 'keydown', code: 'KeyM', preventDefault() {} });
fire('resize', {});
// and death, for the over screen
let n = 0;
while (!M.dbg().over && n++ < 60 * 90) { if (!M.dbg().ghosts.length) M.place([[4, C._GY, 0, 9, 9, 0, 0, 0, 0]]); tick(); }
for (let i = 0; i < 5; i++) tick();

// The card screen only draws between waves, so the loop above never reaches it -
// and it is the only thing that asks for a gradient.
M.restart();
for (let n = 0; n < M.C._CARDS.length; n++) M.drawCard(n, 10, 10, 160, 180);
M.drawCard(-1, 10, 10, 160, 180);

// --- what a real CanvasRenderingContext2D has -----------------------------------
const CTX2D = new Set(['canvas', 'save', 'restore', 'scale', 'rotate', 'translate', 'transform',
  'setTransform', 'resetTransform', 'globalAlpha', 'globalCompositeOperation', 'imageSmoothingEnabled',
  'strokeStyle', 'fillStyle', 'createLinearGradient', 'createRadialGradient', 'createConicGradient',
  'createPattern', 'shadowOffsetX', 'shadowOffsetY', 'shadowBlur', 'shadowColor', 'clearRect',
  'fillRect', 'strokeRect', 'beginPath', 'fill', 'stroke', 'clip', 'isPointInPath', 'isPointInStroke',
  'lineWidth', 'lineCap', 'lineJoin', 'miterLimit', 'setLineDash', 'getLineDash', 'lineDashOffset',
  'font', 'textAlign', 'textBaseline', 'direction', 'fillText', 'strokeText', 'measureText',
  'drawImage', 'createImageData', 'getImageData', 'putImageData', 'closePath', 'moveTo', 'lineTo',
  'quadraticCurveTo', 'bezierCurveTo', 'arcTo', 'rect', 'roundRect', 'arc', 'ellipse', 'filter',
  'letterSpacing', 'fontKerning', 'reset', 'getTransform']);
const CANVAS = new Set(['width', 'height', 'style', 'getContext', 'toDataURL', 'addEventListener']);
const DOC = new Set(['getElementById', 'querySelector', 'createElement', 'body', 'addEventListener',
  'documentElement', 'title', 'head']);
// BaseAudioContext + AudioContext, MDN's list.
const ACTX = new Set(['currentTime', 'sampleRate', 'state', 'destination', 'listener', 'audioWorklet',
  'baseLatency', 'outputLatency', 'onstatechange', 'resume', 'suspend', 'close', 'createOscillator',
  'createGain', 'createStereoPanner', 'createBiquadFilter', 'createBuffer', 'createBufferSource',
  'createConstantSource', 'createDelay', 'createDynamicsCompressor', 'createAnalyser',
  'createChannelSplitter', 'createChannelMerger', 'createConvolver', 'createIIRFilter',
  'createPanner', 'createPeriodicWave', 'createScriptProcessor', 'createWaveShaper',
  'createMediaElementSource', 'createMediaStreamDestination', 'createMediaStreamSource',
  'decodeAudioData', 'getOutputTimestamp', 'addEventListener', 'removeEventListener']);
// AudioNode, plus what an Oscillator, a Gain and a StereoPanner add to it.
const ANODE = new Set(['connect', 'disconnect', 'context', 'numberOfInputs', 'numberOfOutputs',
  'channelCount', 'channelCountMode', 'channelInterpretation', 'addEventListener',
  'removeEventListener', 'type', 'frequency', 'detune', 'start', 'stop', 'onended',
  'setPeriodicWave', 'gain', 'pan', 'buffer', 'Q', 'getChannelData', 'length',
  'threshold', 'knee', 'ratio', 'attack', 'release', 'reduction']);
const APARAM = new Set(['value', 'defaultValue', 'minValue', 'maxValue', 'automationRate',
  'setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime',
  'setValueCurveAtTime', 'cancelScheduledValues', 'cancelAndHoldAtTime']);

const P = (x) => String(x).padEnd(26);
const say = (label, used, known) => {
  const bad = [...used].filter((k) => !known.has(k.split(':')[0]));
  console.log('  ' + P(label) + [...used].sort().join(', '));
  if (bad.length) console.log('  ' + P('') + '!! NOT IN THE REAL API: ' + bad.join(', '));
  return bad.length;
};

console.log('');
console.log('--- every browser API the game touches ---------------------------');
let bad = 0;
bad += say('canvas 2d context', touched.ctx, CTX2D);
bad += say('the canvas element', touched.canvas, CANVAS);
bad += say('document', touched.doc, DOC);
bad += say('audio context', touched.audio, ACTX);
bad += say('audio nodes', touched.node, ANODE);
bad += say('audio parameters', touched.param, APARAM);
console.log('  ' + P('window') + [...touched.win].sort().join(', '));
console.log('');
console.log(bad === 0
  ? '  PASS  every call exists on the real canvas and web-audio interfaces'
  : '  FAIL  ' + bad + ' call(s) a real browser does not have');

// Things a js13k entry must not do.
//
// Scanned against the SOURCE, not the shipped file. dist/index.html is
// Roadroller-packed - our code is a compressed blob inside it - so grepping the
// dist for 'fetch(' cannot find one and would report clean whatever we wrote.
// That is exactly backwards for a rule check: it could only ever pass.
//
// The dist is still worth one look, for what the PACKER puts there rather than
// what we did.
const fs = (await import('fs')).default;
// The SVG namespace URI is an identifier, not an address - the browser never
// requests it, and an inline svg favicon cannot be written without it. Dropped
// before the scan rather than whitelisted in the pattern, so the pattern stays
// the blunt one a rule check wants.
const SRC = (fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8') +
             fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8'))
  .split('http://www.w3.org/2000/svg').join('');
const src = fs.readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const forbid = [['fetch(', /\bfetch\s*\(/], ['XMLHttpRequest', /XMLHttpRequest/],
  ['eval', /\beval\s*\(/], ['new Function', /new Function/],
  ['http:', /http:\/\//], ['https:', /https:\/\//],
  ['document.write', /document\.write/], ['localStorage.clear', /localStorage\s*\.\s*clear/]];
console.log('');
console.log('--- what the SOURCE must not contain -----------------------------');
for (const [name, re] of forbid) {
  const hit = re.test(SRC);
  console.log('  ' + (hit ? 'FOUND ' : 'clean ') + P(name) + (hit ? '<-- look at this' : ''));
}

// localStorage is ALLOWED, with conditions: section 1 says namespace every key
// and never call clear(), because every game on the platform shares one origin.
console.log('');
console.log('--- and the one it is allowed to use, on conditions ---------------');
const keys = [...new Set([...SRC.matchAll(/(?:get|set|remove)Item\(\s*[^,)]*?['"`]?([A-Za-z0-9_.:]+)/g)]
  .map((m) => m[1]))].filter((k) => !/^(C|_)/.test(k));
const lsk = (SRC.match(/_LSK:\s*'([^']+)'/) || [])[1];
console.log('  ' + P('the key') + (lsk || 'none found'));
console.log('  ' + P('namespaced') +
  (lsk && /^[a-z0-9]+[.:]/i.test(lsk) ? 'yes - games here share an origin' : '>> NO'));
console.log('  ' + P('reads guarded') +
  (/try\s*{\s*best\s*=/.test(SRC) || /try\s*{[^}]*getItem/.test(SRC) ? 'yes'
    : '>> NO - it throws in private browsing, and that is a console error'));
console.log('  ' + P('writes guarded') +
  (/try\s*{[^}]*setItem/.test(SRC) ? 'yes'
    : '>> NO - it throws in private browsing, and that is a console error'));

console.log('');
console.log('--- and what the PACKER leaves in the shipped file ----------------');
for (const [name, re] of [['eval', /\beval\s*\(/], ['new Function', /new Function/]]) {
  console.log('  ' + (re.test(src) ? 'packer ' : 'absent ') + P(name) +
    (re.test(src) ? "Roadroller's decompressor, expected" : ''));
}
process.exitCode = bad ? 1 : 0;
