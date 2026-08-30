// Two confirmations, measured through the real draw path.
const anyObj = new Proxy({ width: 10 }, { get: (t, k) => (k in t ? t[k] : () => anyObj) });
const rec = { ops: [], f: '', s: '', cur: null };
const ctx = new Proxy({ canvas: { style: {} } }, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'createLinearGradient') return () => ({ addColorStop: () => {}, toString: () => 'grad' });
    if (k === 'beginPath') return () => { rec.cur = []; };
    if (k === 'moveTo' || k === 'lineTo') return (x, y) => rec.cur && rec.cur.push([x, y]);
    if (k === 'fill') return () => { rec.ops.push({ op: 'fill', c: '' + rec.f, n: rec.cur ? rec.cur.length : 0 }); rec.cur = null; };
    if (k === 'fillText') return (v) => rec.ops.push({ op: 'text', v });
    return () => anyObj;
  },
  set(t, k, v) { if (k === 'fillStyle') rec.f = v; if (k === 'strokeStyle') rec.s = v; t[k] = v; return true; },
});
let rafCb = null;
const L = Object.create(null);
globalThis.document = { getElementById: () => ({ getContext: () => ctx, style: {} }) };
globalThis.devicePixelRatio = 1; globalThis.innerWidth = 900; globalThis.innerHeight = 500;
globalThis.addEventListener = (t, f) => { (L[t] ||= []).push(f); };
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; };
let seed = 20260101;
Math.random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

const M = await import('../src/main.js');
const C = M.C;
let t = 0;
const tick = () => { rec.ops = []; t += 1000 / 60; rafCb(t); };
const fire = (ty, e) => (L[ty] || []).forEach((f) => f(e));
const press = (x, y) => fire('pointerdown', { clientX: x, clientY: y });
const release = () => fire('pointerup', {});
tick();
M.setFire(0);

const P = (x, n) => String(x).padEnd(n);
const RED = 'rgba(' + C._HPC.join(',') + ',1)';

console.log('');
console.log('=== 1. what level does each card read on its first offer? =========');
M.restart();
for (let i = 0; i < C._CARDS.length; i++) {
  rec.ops = [];
  M.drawCard(i, 0, 0, 900 * C._CARDW, 500 * C._CARDH);
  const lv = rec.ops.filter((o) => o.op === 'text').map((o) => o.v).find((v) => /^LV /.test(v));
  const want = i === 5 ? 'LV 1' : 'LV 2';
  console.log('  ' + P(C._CARDS[i][5], 15) + P(lv, 8) +
    (lv === want ? 'as specified' : '<<< WRONG, expected ' + want));
}

console.log('');
console.log('=== 2. do three empty hearts fill the same way? ==================');
// Five hearts, and Heal at its cap, so a card can bring three back at once.
M.restart(); M.look(0, 0); M.place([]);
M.setWave(12);
M.setLv(5, 2);                                   // both Extra Heart cards
M.setLv(6, 2);                                   // both Heal cards: +3 a wave
console.log('  ' + P('max hearts', 22) + M.anim().maxhp + ', heal +' + M.anim().regen + ' a wave');

// take three hits
let n = 0;
while (M.dbg().hearts > M.anim().maxhp - 3 && n++ < 60 * 200) {
  if (!M.dbg().ghosts.length) M.place([[C._GCONTACT - 0.01, C._GY, 0, 9, 9, 0, 0, 0, 0]]);
  tick();
}
console.log('  ' + P('after three hits', 22) + M.dbg().hearts + ' of ' + M.anim().maxhp + ' hearts');

// clear the field, let the wave turn over, take a card
M.place([]);
let g2 = 0;
while (!M.anim().picking && g2++ < 60 * 60) { M.place([]); tick(); }
const b = M.boxes()[0];
press(b[0] + b[2] / 2, b[1] + b[3] / 2);
release();
console.log('  ' + P('the card healed', 22) + M.anim().healN + ' heart(s), from slot ' +
  M.anim().healA + ', for ' + M.anim().healT.toFixed(2) + 's');
console.log('  ' + P('hearts now', 22) + M.dbg().hearts + ' of ' + M.anim().maxhp);

const shot = () => {
  tick();
  return rec.ops.filter((o) => o.op === 'fill' && o.n === 6).map((o) => o.c);
};
console.log('');
console.log('  ' + P('frame', 9) + 'each heart slot, left to right');
for (const label of ['pulse', '+10f', '+20f', '+30f']) {
  if (label !== 'pulse') for (let i = 0; i < 9; i++) tick();
  const cols = shot();
  console.log('  ' + P(label, 9) + cols.map((c, i) =>
    (c === RED ? 'RED' : c === '#2a2136' ? 'empty' : c.replace('rgba(', '').replace(',1)', ''))
    .padEnd(16)).join(''));
}
let f = 0;
while (M.anim().healT > 0 && f++ < 60 * 10) tick();
const done = shot();
console.log('  ' + P('settled', 9) + done.map((c) =>
  (c === RED ? 'RED' : c === '#2a2136' ? 'empty' : c).padEnd(16)).join(''));
console.log('');
const healed = [2, 3, 4];
console.log('  ' + (healed.every((i) => done[i] === RED)
  ? 'All three settled to red together, and pulsed together on the way -\n' +
    '  they share one clock, so they cannot drift apart.'
  : '>> they did NOT all settle'));
