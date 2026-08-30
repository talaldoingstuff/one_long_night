const anyObj = new Proxy({ width: 10 }, { get: (t, k) => (k in t ? t[k] : () => anyObj) });
const ctx = new Proxy({ canvas: { style: {} } }, { get: (t, k) => (k in t ? t[k] : () => anyObj), set: () => true });
globalThis.document = { getElementById: () => ({ getContext: () => ctx, style: {} }) };
globalThis.devicePixelRatio = 1; globalThis.innerWidth = 900; globalThis.innerHeight = 500;
let rafCb = null; const L = Object.create(null);
globalThis.addEventListener = (t, f) => { (L[t] ||= []).push(f); };
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; };
const M = await import('../src/main.js');
const C = M.C;
let t = 0;
const tick = () => { t += 1000 / 60; rafCb(t); };
tick();
for (const [x, z] of [[0, 8], [5, 5], [-5, 5], [8, 0], [0, -8], [-3, -7]]) {
  const yaw = Math.atan2(x, z);
  M.look(yaw, 0);
  const c = M.cam([x, 0, z]);
  console.log('  ghost (' + x + ',' + z + ')  yaw=atan2(x,z)=' + yaw.toFixed(2) +
    '  -> camera x ' + c[0].toFixed(3) + ', z ' + c[2].toFixed(2) +
    (Math.abs(c[0]) < 1e-9 && c[2] > 0 ? '   centred' : '   NOT centred'));
}
// and does a shot fired that way actually land?
M.restart(); M.setFire(1);
M.place([[3, C._GY, 6, 99, 99, 0, 0, 0, 0]]);
M.look(Math.atan2(3, 6), 0);
const hp0 = M.dbg().ghosts[0][3];
for (let i = 0; i < 120; i++) { M.place([[3, C._GY, 6, M.dbg().ghosts[0] ? M.dbg().ghosts[0][3] : 99, 99, 0, 0, 0, 0]]); tick(); }
console.log('');
console.log('  aimed at a pinned ghost for two seconds: hp ' + hp0 + ' -> ' + M.dbg().ghosts[0][3]);
const t0 = Date.now();
for (let i = 0; i < 6000; i++) tick();
console.log('  6000 frames in ' + (Date.now() - t0) + 'ms');
