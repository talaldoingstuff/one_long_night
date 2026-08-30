const anyObj = new Proxy({ width: 10 }, { get: (t, k) => (k in t ? t[k] : () => anyObj) });
const ctx = new Proxy({ canvas: { style: {} } }, {
  get: (t, k) => (k in t ? t[k] : () => anyObj), set: (t, k, v) => { t[k] = v; return true; },
});
let rafCb = null;
const L = Object.create(null);
globalThis.document = { getElementById: () => ({ getContext: () => ctx, style: {} }) };
globalThis.devicePixelRatio = 1; globalThis.innerWidth = 900; globalThis.innerHeight = 500;
globalThis.addEventListener = (t, f) => { (L[t] ||= []).push(f); };
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; };
let seed = 0x4d3f21;
Math.random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

const M = await import('../src/main.js');
const C = M.C;
let t = 0;
const tick = () => { t += 1000 / 60; rafCb(t); };
const fire = (ty, e) => (L[ty] || []).forEach((f) => f(e));
const press = (x = 450, y = 250) => fire('pointerdown', { clientX: x, clientY: y });
tick();
M.setFire(0);

const P = (x) => String(x).padEnd(36);
console.log('');
console.log('--- 1. dying MID-charge, before the cast -------------------------');
C._BINDCHG = 30;                              // long enough that death lands first
M.restart(); M.look(0, 0); M.place([]);
press();
let i = 0;
while (!M.anim().charging && i++ < 300) tick();
// three contacts inside the 3s charge: one every IFRAME, so none is absorbed
let n = 0;
while (!M.dbg().over && n++ < 60 * 3) {
  if (!M.dbg().ghosts.length) M.place([[C._GCONTACT - 0.01, C._GY, 0, 9, 9, 0, 0, 0, 0]]);
  tick();
}
console.log('  ' + P('died after') + (n / 60).toFixed(2) + 's of a ' + C._BINDCHG + 's charge');
console.log('  ' + P('state at death') + 'charging ' + M.anim().charging +
            ', armT ' + M.anim().armT.toFixed(2) + ', bindC ' + M.anim().bindC.toFixed(2));
press();                                     // the click that restarts the run
console.log('  ' + P('right after the restarting click') + 'armT ' + M.anim().armT.toFixed(2) +
            ', charging ' + M.anim().charging);
for (let j = 0; j < 60; j++) tick();
console.log('  ' + P('one second into the NEW run') + 'charging ' + M.anim().charging +
            ', ring ' + M.anim().bindR.toFixed(2) + 'm, and the pointer was never held');
console.log('  ' + (M.anim().charging || M.anim().bindR > 0
  ? '>> BUG: reset() does not clear armT, so the next run arms itself'
  : '   fine'));
fire('pointerup', {});

C._BINDCHG = 3;
console.log('');
console.log('--- 2. crosshair wander at ranges you actually fight at -----------');
M.restart(); M.look(0, 0);
const span = (lo, hi) => {
  let mn = [1e9, 1e9], mx = [-1e9, -1e9];
  for (let z = lo; z <= hi; z += 0.25) {
    M.place([[0, C._GY, z, 9, 9, 0, 0, 0, 0]]);
    const a = M.aimPoint();
    mn = [Math.min(mn[0], a[0]), Math.min(mn[1], a[1])];
    mx = [Math.max(mx[0], a[0]), Math.max(mx[1], a[1])];
  }
  return [mx[0] - mn[0], mx[1] - mn[1]];
};
for (const [lo, hi] of [[4, 12], [2, 16], [6, 9]]) {
  const [dx, dy] = span(lo, hi);
  console.log('  ' + P(lo + 'm to ' + hi + 'm') + dx.toFixed(0) + 'px across, ' + dy.toFixed(0) + 'px down');
}
// and how far off the line a ghost can be and still drag the crosshair
M.place([]);
const base = M.aimPoint();
let off = 0;
for (let x = 0; x < 4; x += 0.05) {
  M.place([[x, C._GY, 7, 9, 9, 0, 0, 0, 0]]);
  const a = M.aimPoint();
  if (Math.hypot(a[0] - base[0], a[1] - base[1]) < 0.5) { off = x; break; }
}
console.log('  ' + P('a ghost stops moving it at') + off.toFixed(2) + 'm off the line at 7m' +
            ' (' + (Math.atan(off / 7) * 180 / Math.PI).toFixed(1) + ' degrees)');
console.log('  ' + P('but is only HIGHLIGHTED within') +
            (C._TGTR * C._TYPES[0][5]).toFixed(2) + 'm (' +
            (Math.atan(C._TGTR * C._TYPES[0][5] / 7) * 180 / Math.PI).toFixed(1) + ' degrees)');
M.setFire(1);
