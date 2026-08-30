// The progression curve, integrated properly: speed rises with DISTANCE and
// distance is the integral of speed, so time-to-phase is not a division.
const noop = () => {};
const anyObj = new Proxy({ width: 10 }, { get: (t, k) => (k in t ? t[k] : () => anyObj) });
const ctx = new Proxy({ canvas: { style: {} } }, { get: (t, k) => (k in t ? t[k] : () => anyObj), set: (t, k, v) => ((t[k] = v), true) });
globalThis.document = { getElementById: () => ({ getContext: () => ctx }) };
globalThis.devicePixelRatio = 1; globalThis.innerWidth = 900; globalThis.innerHeight = 500;
globalThis.localStorage = Object.create(null);
globalThis.addEventListener = noop;
globalThis.requestAnimationFrame = noop;
globalThis.AudioContext = function () { return { destination: {}, createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }), createBufferSource: () => ({ connect: noop, start: noop }) }; };
const { C } = await import('../src/main.js');

const capAt = (C.CAP - 1) / C.STEP;          // seconds, directly - no integration
console.log(`  SPEED ${C.SPEED}/s  STEP ${C.STEP}/s  CAP ${C.CAP}x  HARD_AT ${C.HARD_AT}s  HARD_TO ${C.HARD_TO}s
`);
console.log(`  speed cap (${C.CAP}x)       ${capAt.toFixed(0)}s`);
console.log(`  escalation begins    ${C.HARD_AT}s`);
console.log(`  fully hard           ${C.HARD_TO}s`);
const at = (h) => ({
  block: C.SP_OBST + (C.SP_OBST_HI - C.SP_OBST) * h,
  spike: C.SPIKE + (C.SPIKE * 1.8 - C.SPIKE) * h,
  prism: C.SP_LIGHT + (C.SP_LIGHT_HI - C.SP_LIGHT) * h,
  sphere: C.SP_RB + (C.SP_RB_HI - C.SP_RB) * h,
  sc: 1 + (C.OBSC - 1) * h,
  spd: Math.min(C.CAP, 1 + C.STEP * (h ? C.HARD_TO : 0)),
});
for (const [n, h] of [['early', 0], ['late ', 1]]) {
  const v = at(h), cross = C.VIEW / v.spd;      // seconds an object is on screen
  console.log(`
  ${n}: speed ${v.spd.toFixed(2)}x, an object crosses in ${cross.toFixed(1)}s`);
  console.log(`         a block every ${v.block.toFixed(1)}s (${(cross / v.block).toFixed(1)} on screen), ${(100 * v.spike).toFixed(0)}% spiked`);
  console.log(`         a prism every ${v.prism.toFixed(1)}s (${(cross / v.prism).toFixed(1)} on screen), a sphere every ${v.sphere.toFixed(1)}s`);
  // count alone hides the climb: blocks also grow, and area is what you fly through
  const aw = (C.OBW + C.OBW2) / 2 * 500 * v.sc, ah = (C.OBH + C.OBH2) / 2 * 500 * v.sc;
  const cover = (cross / v.block) * aw * ah / (900 * 500);
  console.log(`         average block ${aw.toFixed(0)}x${ah.toFixed(0)}px, covering ${(100 * cover).toFixed(1)}% of the screen`);
}
