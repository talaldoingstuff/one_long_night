// What a bandpass actually passes. Every noise sound in the game is white noise
// through a BiquadFilterNode of type 'bandpass', and its gain is what goes IN -
// the peak that comes out is a fraction of it, which is why the shot needed 1.35
// to be heard while a triangle at 0.44 was plenty.
const anyObj = new Proxy({ width: 10 }, { get: (t, k) => (k in t ? t[k] : () => anyObj) });
const ctx = new Proxy({ canvas: { style: {} } }, { get: (t, k) => (k in t ? t[k] : () => anyObj), set: () => true });
globalThis.document = { getElementById: () => ({ getContext: () => ctx, style: {} }) };
globalThis.devicePixelRatio = 1; globalThis.innerWidth = 900; globalThis.innerHeight = 500;
globalThis.addEventListener = () => {}; globalThis.requestAnimationFrame = () => {};
const { C } = await import('../src/main.js');

const SR = 44100;
// RBJ bandpass, constant 0 dB peak gain - the same one BiquadFilterNode implements
const pass = (x, f, Q) => {
  const w0 = 2 * Math.PI * f / SR, al = Math.sin(w0) / (2 * Q), cw = Math.cos(w0);
  const a0 = 1 + al;
  const b0 = al / a0, b1 = 0, b2 = -al / a0, a1 = -2 * cw / a0, a2 = (1 - al) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, mx = 0, sum = 0;
  const out = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const y = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y;
    out[i] = y;
    if (Math.abs(y) > mx) mx = Math.abs(y);
    sum += y * y;
  }
  return { peak: mx, rms: Math.sqrt(sum / x.length) };
};

let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
const noise = new Float64Array(SR);
for (let i = 0; i < noise.length; i++) noise[i] = rnd();

const P = (x, n) => String(x).padEnd(n);
console.log('');
console.log('--- what a bandpass passes, at Q ' + C._NQ + ' ------------------------------');
console.log('  ' + P('centre', 10) + P('peak out', 12) + P('rms out', 12) + 'of unit white noise in');
for (const f of [260, 500, 1100, 2000, 3300, 7500, 9000]) {
  const r = pass(noise, f, C._NQ);
  console.log('  ' + P(f + ' Hz', 10) + P(r.peak.toFixed(3), 12) + P(r.rms.toFixed(3), 12));
}
console.log('');
console.log('  So a noise sound at gain g peaks at roughly g x 0.3, not g. The shot is');
console.log('  written 1.350 and lands near ' + (1.35 * pass(noise, 600, C._NQ).peak).toFixed(2) +
            ', which is why it needed a number over 1.');
