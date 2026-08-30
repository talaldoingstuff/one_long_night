// Can a ghost be shot while it is not on screen?
// The hit test in step() is a world-space sphere check with no visibility term,
// so the question is whether a horn ever gets near one you cannot see.
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
C._BUD0 = 0; C.BUDG = 0;                    // silence the spawner; only my ghost exists
let t = 0;
const tick = () => { t += 1000 / 60; rafCb(t); };
tick();
const W = 900, H = 500, PX = M.dbg().PX;

// Visibility computed, not inferred from a draw call: drawGhost has no viewport
// test at all - it only drops what is behind the eye and lets the canvas clip the
// rest - so "it was drawn" and "you can see it" are different questions.
const onScreen = (p) => {
  const c = M.cam(p);
  if (c[2] < C._NEAR) return false;
  const s = C._F / (C._F + c[2]), r = C._TYPES[0][5] * s * PX;
  const q = M.proj(c);
  return q[0] > -r && q[0] < W + r && q[1] > -r && q[1] < H + r;
};

const trial = (deg, range, pitch = 0) => {
  const a = deg * Math.PI / 180;
  const at = [Math.sin(a) * range, C._GY, Math.cos(a) * range];
  M.restart(); M.look(0, pitch);
  let hp = 60;
  for (let i = 0; i < 60 * 6; i++) {
    M.place([[at[0], at[1], at[2], hp, 60, 0, 0, 0, 0]]);
    tick();
    const o = M.dbg().ghosts.find((q) => q[4] === 60);
    if (o) hp = o[3];
  }
  return { seen: onScreen(at), hit: 60 - hp, at };
};

const P = (x) => String(x).padEnd(13);
console.log('');
console.log('--- can you shoot what you cannot see? ---------------------------');
console.log('  a horn hits within ' + (C._HHIT + C._TYPES[0][5]).toFixed(2) +
            'm of a Drifter centre, in world space, with no visibility test');
console.log('  and shots fly down the horn line, which does not move on screen');
console.log('');
console.log('  ' + P('bearing') + P('range') + P('on screen?') + 'hits taken in 6s');
let anyBad = 0;
for (const range of [2, 3, 5, 7, 14]) {
  for (const deg of [0, 5, 10, 15, 20, 30, 45, 60, 90, 180]) {
    const r = trial(deg, range);
    const bad = !r.seen && r.hit > 0;
    if (bad) anyBad++;
    if (r.hit > 0 || !r.seen)
      console.log('  ' + P(deg + ' deg') + P(range + 'm') + P(r.seen ? 'yes' : 'NO') +
                  r.hit + (bad ? '   <-- HIT WHILE UNSEEN' : ''));
  }
}
console.log('');
console.log(anyBad
  ? '  >> ' + anyBad + ' case(s) where an unseen ghost took damage'
  : '  Nothing off screen was ever hit: every ghost a horn reached was visible.');

console.log('');
console.log('--- how far off the line can a horn still reach? ------------------');
for (const range of [2, 3, 5, 7, 14]) {
  let last = -1;
  for (let d = 0; d <= 60; d += 1) if (trial(d, range).hit > 0) last = d;
  const a = last * Math.PI / 180;
  const at = [Math.sin(a) * range, C._GY, Math.cos(a) * range];
  console.log('  ' + P(range + 'm') + 'out to ' + P(last + ' deg') +
              '= ' + (Math.sin(a) * range).toFixed(2) + 'm off the line' +
              (onScreen(at) ? '   (on screen)' : '   (OFF SCREEN)'));
}

console.log('');
console.log('--- and with the view pitched away from the ghost band ------------');
console.log('  ' + P('pitch') + P('range') + P('on screen?') + 'hits taken in 6s');
let bad2 = 0;
for (const pd of [C._PITCHMAX, -C._PITCHMAX]) {
  for (const range of [1.5, 2, 3, 5, 9]) {
    M.restart(); M.look(0, pd);
    const at = [0, C._GY, range];
    const seen = onScreen(at);
    const r = trial(0, range, pd);
    const b = !seen && r.hit > 0;
    if (b) bad2++;
    console.log('  ' + P((pd * 180 / Math.PI).toFixed(0) + ' deg') + P(range + 'm') +
                P(seen ? 'yes' : 'NO') + r.hit + (b ? '   <-- HIT WHILE UNSEEN' : ''));
  }
}
console.log('');
console.log(bad2 ? '  >> ' + bad2 + ' unseen hit(s) when pitched'
                 : '  Pitched fully up or down, nothing unseen was hit either.');
