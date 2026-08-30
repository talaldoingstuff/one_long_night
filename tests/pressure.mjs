// What the bind's timing actually sits against, measured rather than reasoned.
// Boots the real module through the same shim the loop suite uses.
const anyObj = new Proxy({ width: 10 }, { get: (t, k) => (k in t ? t[k] : () => anyObj) });
const ctx = new Proxy({ canvas: { style: {}, width: 0, height: 0 } }, {
  get: (t, k) => (k in t ? t[k] : () => anyObj),
  set: (t, k, v) => { t[k] = v; return true; },
});
let rafCb = null;
const L = Object.create(null);
globalThis.document = { getElementById: () => ({ getContext: () => ctx, style: {} }) };
globalThis.devicePixelRatio = 1;
globalThis.innerWidth = 900; globalThis.innerHeight = 500;
globalThis.addEventListener = (t, f) => { (L[t] ||= []).push(f); };
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; };
let seed = 0x4d3f21;
Math.random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

const M = await import('../src/main.js');
const C = M.C;
let t = 0;
const tick = () => { t += 1000 / 60; rafCb(t); };
tick();

M.restart(); M.place([]); M.look(0, 0);
let inside = 0, alive = 0, n = 0, firstAt = null, deadAt = null;
for (let f = 0; f < 60 * 180; f++) {
  tick();
  const gs = M.dbg().ghosts;
  if (firstAt === null && gs.some((o) => Math.hypot(o[0], o[2]) < 2)) firstAt = f / 60;
  if (deadAt === null && M.dbg().over) { deadAt = f / 60; M.restart(); M.place([]); }
  if (f > 60 * 8 && !M.dbg().over) {            // once the field has filled, before death
    alive += gs.length; n++;
    inside += gs.filter((o) => Math.hypot(o[0], o[2]) <= C._BINDR).length;
  }
}
const held = C._ARM + C._BINDCHG;
const cycle = held + C._BINDCD;
const P = (x) => String(x).padEnd(18);
console.log('');
console.log('--- what the bind timing sits against ----------------------------');
console.log('  ' + P('spawn ring') + C._ARENA + 'm, one every ' + C._SPAWN + 's, drifting ' + C.DRIFTER[1] + ' m/s');
console.log('  ' + P('a ghost lives') + (C._ARENA / C.DRIFTER[1]).toFixed(0) + 's from spawn to your face');
console.log('  ' + P('first one arrives') + (firstAt === null ? 'never' : firstAt.toFixed(1) + 's into a run'));
console.log('  ' + P('ghosts alive') + (alive / n).toFixed(1) + ' at a time');
console.log('  ' + P('inside the ring') + (inside / n).toFixed(1) + ' of them - what one bind catches');
console.log('  ' + P('a run lasts') + (deadAt === null ? 'over 180s' : deadAt.toFixed(0) + 's'));
console.log('');
console.log('  ' + P('the bind cycle') + C._ARM + 's arm + ' + C._BINDCHG + 's charge + ' + C._BINDCD +
            's cooldown = one every ' + cycle.toFixed(2) + 's');
console.log('  ' + P('holding') + held.toFixed(2) + 's of that, ' +
            (100 * held / cycle).toFixed(0) + '% of the cycle');
console.log('  ' + P('dead part') + C._ARM + 's arming = ' +
            (100 * C._ARM / held).toFixed(0) + '% of every hold, showing nothing but the rim');
console.log('  ' + P('binds per run') + (deadAt === null ? '~' + (180 / cycle).toFixed(0) : (deadAt / cycle).toFixed(0)) +
            ', each freezing ' + (inside / n).toFixed(1) + ' ghosts for ' + C._BINDDUR + 's');
console.log('');
console.log('  ' + P('shots') + 'one per ' + C._FIRE + 's, ' + C.DRIFTER[0] + ' hp a drifter, so ' +
            (C.DRIFTER[0] * C._FIRE).toFixed(0) + 's a kill');
console.log('  ' + P('kills vs spawns') + (1 / (C.DRIFTER[0] * C._FIRE)).toFixed(2) + '/s against ' +
            (1 / C._SPAWN).toFixed(2) + '/s arriving');
