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
const release = () => fire('pointerup', {});
tick();

const P = (x) => String(x).padEnd(34);
console.log('');
console.log('--- 1. does a fresh run start charging by itself? -----------------');
M.setFire(0);
M.restart(); M.look(0, 0); M.place([]);
press();
let i = 0;
while (!M.anim().charging && i++ < 300) tick();
console.log('  ' + P('charging after a press') + M.anim().charging + '  (armT ' + M.anim().armT.toFixed(2) + ')');
// die mid-charge, without ever releasing
M.place([[1.15, C._GY, 0, 9, 9, 0, 0, 0, 0]]);
let n = 0;
while (!M.dbg().over && n++ < 60 * 90) { if (!M.dbg().ghosts.length) M.place([[1.15, C._GY, 0, 9, 9, 0, 0, 0, 0]]); tick(); }
console.log('  ' + P('died mid-charge, armT is') + M.anim().armT.toFixed(2));
press();                                    // the click that restarts
console.log('  ' + P('after the restarting click') + 'armT ' + M.anim().armT.toFixed(2) +
            ', charging ' + M.anim().charging);
for (let j = 0; j < 40; j++) tick();
console.log('  ' + P('40 frames into the NEW run') + 'charging ' + M.anim().charging +
            ', ring already ' + M.anim().bindR.toFixed(2) + 'm');
console.log('  ' + (M.anim().charging
  ? '>> BUG: the new run began charging with no press of its own'
  : '   fine: a new run waits for input'));
release();

console.log('');
console.log('--- 2. does the crosshair wander as a ghost closes? ---------------');
M.restart(); M.look(0, 0);
let mn = [1e9, 1e9], mx = [-1e9, -1e9];
for (let z = 16; z > 1.5; z -= 0.25) {
  M.place([[0, C._GY, z, 9, 9, 0, 0, 0, 0]]);
  const a = M.aimPoint();
  mn = [Math.min(mn[0], a[0]), Math.min(mn[1], a[1])];
  mx = [Math.max(mx[0], a[0]), Math.max(mx[1], a[1])];
}
M.place([]);
const empty = M.aimPoint();
console.log('  ' + P('with no ghost at all') + '(' + empty.map((v) => v.toFixed(1)).join(', ') + ')');
console.log('  ' + P('range of crosshair over 16m..1.5m') +
  (mx[0] - mn[0]).toFixed(1) + 'px across, ' + (mx[1] - mn[1]).toFixed(1) + 'px down');
console.log('  ' + P('AIMR (shot convergence)') + C._AIMR + ' -> ' +
  (Math.atan(C._AIMR) * 180 / Math.PI).toFixed(1) + ' degrees off the line');
console.log('  ' + P('TGTR (what gets highlighted)') + C._TGTR + ' of a ' + C._TYPES[0][5] +
  'm body -> ' + (Math.atan(C._TGTR * C._TYPES[0][5] / 7) * 180 / Math.PI).toFixed(1) + ' degrees at 7m');
const wander = Math.max(mx[0] - mn[0], mx[1] - mn[1]);
console.log('  ' + (wander > 4
  ? '>> the crosshair moves ' + wander.toFixed(0) + 'px depending on what is near it'
  : '   fine: it holds within ' + wander.toFixed(1) + 'px'));

console.log('');
console.log('--- 3. is the damage feedback visible on the killing blow? --------');
M.restart(); M.look(0, 0);
let m2 = 0;
while (M.dbg().hearts > 1 && m2++ < 60 * 90) { if (!M.dbg().ghosts.length) M.place([[4, C._GY, 0, 9, 9, 0, 0, 0, 0]]); tick(); }
while (!M.dbg().over && m2++ < 60 * 90) { if (!M.dbg().ghosts.length) M.place([[4, C._GY, 0, 9, 9, 0, 0, 0, 0]]); tick(); }
console.log('  ' + P('on the frame of the last heart') + 'over=' + M.dbg().over +
  ', hurtT=' + M.anim().hurtT.toFixed(2) + ', shake=' + M.anim().shake.toFixed(2));
console.log('  ' + (M.dbg().over && M.anim().hurtT > 0
  ? '>> the red flash and kick are set but render() returns early on over,\n' +
    '     so the killing blow is the one hit you never see or feel'
  : '   fine'));
M.setFire(1);
