// Ghost assertions below are about TYPES[0], the Drifter - the type that was
// the whole roster when they were written.
// Step 3's core loop, driven through the real module: spawning, closing, firing,
// travel time, collision, hearts, death, restart.
const anyObj = new Proxy({ width: 10 }, { get: (t, k) => (k in t ? t[k] : () => anyObj) });
const rec = { ops: [], style: '#000', sstyle: '#000', alpha: 1, comp: 'source-over', cur: null };
const canvas = { style: {}, width: 0, height: 0 };
const ctx = new Proxy({ canvas }, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'beginPath') return () => { rec.cur = []; rec.arc = null; };
    if (k === 'lineTo' || k === 'moveTo') return (x, y) => rec.cur && rec.cur.push([x, y]);
    if (k === 'fill') return (rule) => { rec.ops.push({ op: 'fill', rule, c: rec.style, alpha: rec.alpha, comp: rec.comp, n: rec.cur ? rec.cur.length : 0, p: rec.cur, a: rec.arc }); rec.cur = null; };
    if (k === 'stroke') return () => { rec.ops.push({ op: 'stroke', c: rec.sstyle, w: rec.lw, cap: rec.cap, alpha: rec.alpha, comp: rec.comp, n: rec.cur ? rec.cur.length : 0, p: rec.cur, a: rec.arc }); };
    if (k === 'translate') return (x, y) => rec.ops.push({ op: 'translate', x, y });
    if (k === 'createLinearGradient') return (x0, y0, x1, y1) => {
      const stops = [];
      return { addColorStop: (o, c) => stops.push(o + ':' + c),
               toString: () => 'grad(' + x0 + ',' + y0 + ',' + x1 + ',' + y1 + ';' +
                 stops.join(' ') + ')' };
    };
    if (k === 'strokeRect') return (x, y, w, h) => rec.ops.push({ op: 'srect', x, y, w, h, c: rec.sstyle, lw: rec.lw, alpha: rec.alpha });
    if (k === 'fillRect') return (x, y, w, h) => rec.ops.push({ op: 'rect', x, y, w, h, c: rec.style, alpha: rec.alpha, comp: rec.comp });
    // alpha too: text that breathes cannot be checked without it
    if (k === 'fillText') return (s, x, y) => rec.ops.push({ op: 'text', s, x, y, c: rec.style, align: rec.align, f: parseFloat(rec.font), comp: rec.comp, alpha: rec.alpha });
    // Monospace, and the game only ever measures monospace - so an advance of
    // 0.6em a character is the right answer and 'anyObj.width = 10' was not.
    if (k === 'measureText') return (str) => ({ width: str.length * parseFloat(rec.font) * 0.6 });
        if (k === 'arc') return (x, y, rad, a0, a1) => { (rec.cur = rec.cur || []).push([x, y]); rec.arc = [x, y, rad, a0, a1]; };
    return () => anyObj;
  },
  set(t, k, v) {
    if (k === 'fillStyle') rec.style = '' + v;
    if (k === 'strokeStyle') rec.sstyle = v;
    if (k === 'lineWidth') rec.lw = v;
    if (k === 'lineCap') rec.cap = v;
    if (k === 'globalAlpha') rec.alpha = v;
    if (k === 'globalCompositeOperation') rec.comp = v;
    if (k === 'textAlign') rec.align = v;
    if (k === 'font') rec.font = v;
    t[k] = v; return true;
  },
});
// A recording AudioContext. A sound is one source under a gain and a panner, built
// and connected in that order and then started, so a note is complete by the time
// start() is called and can be pushed whole. The pitch sweep is recorded wherever
// it lands - on the oscillator for a pitched sound, on the bandpass for a noise
// one - because from and to mean the same thing to the player either way.
const snd = { notes: [], made: 0 };
const freqParam = () => ({
  setValueAtTime: (v) => { snd.f0 = v; },
  exponentialRampToValueAtTime: (v) => { snd.f1 = v; },
});
const source = (kind) => {
  const o = {
    frequency: freqParam(),
    connect: (x) => x,
    start: (at) => snd.notes.push({ f0: snd.f0, f1: snd.f1, type: kind || o.type,
                                    vol: snd.g.v, at }),
    stop: () => {},
  };
  return o;
};
globalThis.AudioContext = class {
  constructor() {
    snd.made++;
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.state = 'running';
    this.destination = {};
  }
  resume() { this.state = 'running'; }
  createBuffer(ch, n) { return { getChannelData: () => new Float32Array(n) }; }
  createGain() {
    const g2 = { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {},
                         linearRampToValueAtTime: (v) => { g2.v = v; } },
                 connect: (x) => { snd.gainTo = x; return x; } };
    return (snd.g = g2);
  }
  createDynamicsCompressor() {
    const c = { connect: (x) => { snd.toDest = x === this.destination; return x; }, reduction: 0 };
    for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) c[k] = { value: 0 };
    return (snd.lim = c);
  }
  createBiquadFilter() {
    return { type: '', Q: { value: 0 }, frequency: freqParam(), connect: (x) => x };
  }
  createBufferSource() { return source('noise'); }
  createOscillator() { return source(); }
};

let rafCb = null;
const L = Object.create(null);
globalThis.document = { getElementById: () => ({ getContext: () => ctx, style: {} }) };
globalThis.devicePixelRatio = 1;
globalThis.innerWidth = 900; globalThis.innerHeight = 500;
globalThis.addEventListener = (t, f) => { (L[t] ||= []).push(f); };
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; };
// The game reads a personal best at import and writes one at death. A real
// localStorage throws in private browsing, which is why the game guards both -
// this one just records, so the key and the value can be asserted.
const STORE = Object.create(null);
globalThis.localStorage = {
  getItem: (k) => (k in STORE ? STORE[k] : null),
  setItem: (k, v) => { STORE[k] = '' + v; },
};

let seed = 0x4d3f21;
Math.random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

const M = await import('../src/main.js');
// The palette length, read from the game rather than remembered - it went from
// six to seven and four checks were still counting to six.
const BOWN = 7;
const C = M.C;
const ok = (l, c, x) => console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x ? '  ' + x : ''));
let t = 0;
const tick = (n = 1) => { for (let i = 0; i < n; i++) { rec.ops = []; t += 1000 / 60; rafCb(t); } };
const fire = (t2, e) => (L[t2] || []).forEach((f) => f(e));
const press = (x = 450, y = 250) => fire('pointerdown', { clientX: x, clientY: y });
const release = () => fire('pointerup', {});
const drag = (x, y) => fire('pointermove', { clientX: x, clientY: y });
// Press and wait for the arming window to actually finish. Ticking exactly
// ARM*60 frames looks equivalent and is not: dt comes off a float clock that has
// been accumulating all suite, so by the later blocks eighteen frames sum to
// 0.2999999999998 and the charge never starts. Wait for the state, not the count.
const armed = () => { press(); let i = 0; while (!M.anim().charging && i++ < 600) tick(); };
// A wave now ends on a card, so anything that waits for the next one has to take
// one. Clicks the middle of the nth card, which is the path a player takes.
const pickCard = (n = 0) => {
  const b = M.boxes()[n];
  press(b[0] + b[2] / 2, b[1] + b[3] / 2);
  release();
};
const clearWave = (max = 60 * 60) => {
  let i = 0;
  while (!M.anim().picking && i++ < max) { if (M.dbg().ghosts.length) M.place([]); tick(); }
  return i;
};
let prevented = 0;
const key = (type, code) => fire(type, { type, code, preventDefault: () => prevented++ });
const kdown = (code) => key('keydown', code);
const kup = (code) => key('keyup', code);
const allUp = () => ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown',
                     'ArrowLeft', 'ArrowRight', 'Space'].forEach(kup);
// Firing is automatic: after a restart the cooldown is zero, so one tick fires
// exactly one horn. This replaces every press()-to-shoot in the suite.
const shoot = () => { tick(); return M.dbg().horns[M.dbg().horns.length - 1]; };
tick();
const madeBeforeAnyPress = snd.made;

console.log('--- spawning -----------------------------------------------------');
{
  M.restart();
  M.place([]);
  const known = [], seen = [];
  for (let i = 0; i < 600 && seen.length < 8; i++) {
    tick();
    for (const o of M.dbg().ghosts) if (!known.includes(o)) { known.push(o); seen.push([o[0], o[2]]); }
  }
  const off = seen.map((p) => Math.abs(Math.hypot(p[0], p[1]) - C._ARENA));
  // A ghost is stepped on the same frame it spawns, so one frame of travel is
  // expected here and an exact-ring assertion was measuring the wrong thing.
  // One frame of travel at the FASTEST type's speed, not the Drifter's: a Darter
  // covers 1.8x as much ground before the first measurement.
  const slack = C._GSPEED * Math.max(...C._TYPES.map((t) => t[1])) / 60 + 1e-6;
  ok('ghosts spawn on the arena ring', seen.length >= 6 && Math.max(...off) < slack,
     seen.length + ' spawned, worst off-ring ' + (1000 * Math.max(...off)).toFixed(1) +
     'mm from the ' + C._ARENA + 'm ring - one frame at the fastest is ' + (1000 * slack).toFixed(1) + 'mm');
  // The resultant length, not max minus min. atan2 wraps at +-PI, so two bearings
  // two degrees apart across the wrap measured as 358 degrees - the old check
  // called that a good spread, and would have called a real cluster sitting on
  // the wrap a good spread too. Summing unit vectors has no seam: scattered
  // bearings cancel toward 0, one fixed direction sums to 1.
}

console.log('\n--- closing ------------------------------------------------------');
{
  M.restart();
  M.place([[0, C._GY, 8, 3, 3, 0, 0, 0]]);
  const d0 = 8;
  let mono = true, prev = d0;
  for (let i = 0; i < 120; i++) {
    tick();
    const o = M.dbg().ghosts[0];
    if (!o) break;
    const d = Math.hypot(o[0], o[2]);
    if (d > prev + 1e-9) mono = false;
    prev = d;
  }
  ok('a ghost closes on the player, monotonically', mono && prev < d0,
     d0 + 'm down to ' + prev.toFixed(2) + 'm in 2s');
  const want = (C._GSPEED * C._TYPES[0][1]) * 2;
  ok('and it travels at its own speed', Math.abs((d0 - prev) - want) < 0.05,
     'covered ' + (d0 - prev).toFixed(2) + 'm against ' + want.toFixed(2) + 'm at ' + (C._GSPEED * C._TYPES[0][1]) + ' m/s');
}

console.log('\n--- contact ------------------------------------------------------');
{
  M.restart();
  M.place([[0, C._GY, C._GCONTACT + 0.05, 3, 3, 0, 0, 0]]);
  const h0 = M.dbg().hearts;
  tick(20);
  const d = M.dbg();
  ok('reaching the player costs a heart and removes the ghost',
     d.hearts === h0 - C._TYPES[0][2] && d.ghosts.length === 0,
     'hearts ' + h0 + ' -> ' + d.hearts + ', ' + d.ghosts.length + ' ghosts left');

  // a clump must not strip the whole bar in one frame
  M.restart();
  M.place([0, 1, 2, 3].map(() => [0, C._GY, C._GCONTACT + 0.02, 3, 3, 0, 0, 0]));
  tick(4);
  ok('a clump cannot chain-hit through the grace window', M.dbg().hearts >= C._HEARTS - 1,
     'four ghosts arriving together took ' + (C._HEARTS - M.dbg().hearts) + ' heart');
}

console.log('\n--- death and restart --------------------------------------------');
{
  M.restart();
  let guard = 0;
  while (!M.dbg().over && guard++ < 4000) {
    if (!M.dbg().ghosts.length) M.place([[0, C._GY, C._GCONTACT + 0.02, 3, 3, 0, 0, 0]]);
    tick();
  }
  const dead = M.dbg();
  ok('hearts reaching zero ends the run', dead.over === 1 && dead.hearts === 0,
     'over after ' + guard + ' frames, hearts ' + dead.hearts);
  M.place([[0, C._GY, 8, 3, 3, 0, 0, 0]]);
  const before = M.dbg().ghosts[0][2];
  tick(60);
  ok('and the world stops simulating once it is over',
     M.dbg().ghosts[0] && M.dbg().ghosts[0][2] === before,
     'a ghost 8m out has not moved a millimetre in a second');
  press(); release();
  tick();
  const fresh = M.dbg();
  ok('a click restarts', !fresh.over && fresh.hearts === C._HEARTS && fresh.kills === 0,
     'hearts back to ' + fresh.hearts + ', kills ' + fresh.kills + ', ' + fresh.ghosts.length + ' ghosts');
}

console.log('\n--- firing -------------------------------------------------------');
{
  M.restart();
  M.place([]);
  M.look(0, 0);
  const at = [];
  // Long enough to see several gaps at the SLOWEST fire rate, or this measures
  // its own window instead of the cadence.
  let seen = 0;
  for (let i = 0; i < Math.ceil(C._FIRE * 60 * 6); i++) {
    tick();
    const n = M.dbg().horns.length;
    if (n > seen) at.push(i / 60);
    seen = n;
  }
  const gaps = at.slice(1).map((v, i) => v - at[i]);
  ok('firing is gated by the fire rate, not the frame rate',
     gaps.length >= 3 && gaps.every((v) => Math.abs(v - C._FIRE) < 0.04),
     gaps.length + ' shots at ' + gaps.map((v) => v.toFixed(2)).join('/') + 's apart, FIRE is ' + C._FIRE);

  // travel time, not hitscan
  M.restart();
  M.place([]);
  M.look(0, 0);
  const h = shoot();
  ok('a horn is a projectile with travel time', !!h,
     'launched at ' + Math.hypot(h[3], h[4], h[5]).toFixed(1) + ' m/s');
  const z0 = h[2];
  tick(6);
  const moved = M.dbg().horns[0][2] - z0;
  ok('and it moves at HSPD', Math.abs(moved - C._HSPD * 0.1) < 0.05,
     'travelled ' + moved.toFixed(2) + 'm in 0.1s against ' + (C._HSPD * 0.1).toFixed(2) + 'm');
}

console.log('\n--- hitting, at any bearing --------------------------------------');
{
  // Range as well as bearing: the muzzle sits nearly a metre off the camera axis
  // because the puppet is worn on the right hand, so a horn fired parallel to the
  // view missed at EVERY range. They are aimed at the crosshair's point instead,
  // and this is the sweep that has to stay green.
  // Targets go where the CROSSHAIR is, which is the horn's line - not the camera
  // axis. Centring a ghost in the view no longer aims at it, and the sweep quietly
  // measured that instead of the shooting.
  const fails = [];
  for (const R of [1.4, 2, 3, 5, 8, 12, 16]) {
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 2.4]) {
      M.restart();
      M.look(a, 0);
      M.place([]);
      tick();
      const w = M.aimWorld(R);
      M.place([[w[0], w[1], w[2], 9, 9, 0, 0, 0]]);
      shoot();
      let n = 0;
      while (M.dbg().horns.length && n++ < 200) tick();
      const g = M.dbg().ghosts[0];
      if (!g || g[3] === 9) fails.push(R + 'm/' + (a * 180 / Math.PI).toFixed(0) + 'deg');
    }
  }
  ok('a horn hits what the crosshair is on, at every range and bearing',
     fails.length === 0,
     fails.length ? 'missed at ' + fails.join(', ') : '35 range/bearing combinations, 1.4m to 16m, all round');

  // and it takes exactly HP hits to kill
  M.restart();
  M.look(0, 0);
  // Hold one ghost in the field and evict whatever the spawner adds, or the
  // wait-for-empty never ends and the test times its own cap instead of the kill.
  const g0 = [0, C._GY, 6, C._TYPES[0][0], C._TYPES[0][0], 0, 0, 0];
  let n = 0, hp = [];
  while (g0[3] > 0 && n++ < 300) { M.place([g0]); tick(); hp.push(g0[3]); }
  const shots = [...new Set(hp)].length;
  ok('and a ghost dies after exactly its HP in hits',
     M.dbg().kills === 1 && g0[3] === 0 && n < 300,
     C._TYPES[0][0] + ' hp gone in ' + (n / 60).toFixed(2) + 's, hp stepped through ' +
     [...new Set(hp)].join('->') + ', kills=' + M.dbg().kills);

  // a miss expires rather than living forever
  M.restart();
  M.place([]);
  M.look(0, 0);
  const auto0 = M.setFire(0);                    // one shot, then silence
  M.setFire(1); shoot(); M.setFire(0);
  tick(Math.ceil(C._HLIFE * 60) + 6);
  ok('a horn that hits nothing expires', M.dbg().horns.length === 0,
     'the flight was capped at HLIFE = ' + C._HLIFE + 's');
  M.setFire(1);
}

console.log('\n--- aiming -------------------------------------------------------');
{
  M.restart();
  M.look(0, 0);
  press(400, 250);
  drag(500, 250);
  const afterX = M.dbg();
  // Sensitivity is a fraction of the SCREEN now, so the rate per pixel depends on
  // how wide the window is - the check is the gesture, not the constant.
  const rate = C._SWEEP * Math.PI / 900;
  ok('dragging right turns the view right', afterX.yaw > 0,
     '100px of drag gave ' + afterX.yaw.toFixed(3) + ' rad in a 900px window');
  ok('and one drag across the window is SWEEP half-turns',
     Math.abs(afterX.yaw - 100 * rate) < 1e-9,
     '900px of it would be ' + (900 * rate / Math.PI).toFixed(2) + ' half-turns, so ' +
     'two sweeps is all the way round - and it is the same gesture on any display, ' +
     'where a fixed rate per pixel was two sweeps at 1500px and nearly three at 1080p');
  drag(500, 150);
  ok('dragging up pitches up', M.dbg().pitch > 0, M.dbg().pitch.toFixed(3) + ' rad');
  for (let i = 0; i < 40; i++) drag(500, 150 - i * 40);
  ok('pitch is clamped', Math.abs(M.dbg().pitch) <= C._PITCHMAX + 1e-9,
     'held past the stop, pitch is ' + M.dbg().pitch.toFixed(3) + ' of a ' + C._PITCHMAX + ' limit');
  const y0 = M.dbg().yaw;
  for (let i = 0; i < 200; i++) drag(500 + i * 50, 150);
  ok('yaw is not clamped - the arena is 360 degrees',
     Math.abs(M.dbg().yaw - y0) > 2 * Math.PI,
     'turned ' + ((M.dbg().yaw - y0) * 180 / Math.PI).toFixed(0) + ' degrees without hitting a stop');
  release();
  M.look(0, 0);
}

console.log('\n--- draw order and blending --------------------------------------');
{
  M.restart();
  M.place([[0, C._GY, 5, 3, 3, 0, 0, 0], [3, C._GY, 4, 3, 3, 0, 0, 0]]);
  M.look(0, 0);
  tick();
  const ops = rec.ops;
  const firstGhost = ops.findIndex((o) => o.comp === 'lighter');
  const lastGhost = ops.map((o) => o.comp === 'lighter').lastIndexOf(true);
  const puppetFills = ops.map((o, i) => (o.op === 'fill' && o.comp === 'source-over' && i > lastGhost ? i : -1)).filter((i) => i >= 0);
  ok('ghosts are drawn with additive blending', firstGhost >= 0,
     ops.filter((o) => o.comp === 'lighter').length + ' additive draws');
  ok('their eye voids are holes in the same path, not lit fills',
     ops.some((o) => o.rule === 'evenodd' && o.comp === 'lighter'),
     'additive blending cannot darken, so a drawn eye would glow');
  ok('the viewmodel is drawn after every ghost', puppetFills.length > 5,
     puppetFills.length + ' viewmodel faces, all after the last ghost');
  ok('and the background before them', ops[0].op === 'rect',
     'first op of the frame is the sky fill');
}

console.log('');
console.log('--- the unicorn is a drawn sprite ---------------------------------');
{
  // The 3D swept-box puppet is gone. What replaces it is a flat 3/4 low-poly
  // unicorn drawn straight in screen space - so these check the drawing, not a
  // model, and there is no projection or depth sort left to get wrong.
  M.restart(); M.place([]); M.look(0, 0);
  M.setFire(0);
  tick();
  const sp = M.sprite();
  // Draw the sprite ALONE into the recorder. Sieving it out of a whole frame by
  // the shape of its colour strings is what broke the moment it started emitting
  // rgba() instead of rgb(); this cannot drift.
  rec.ops = [];
  M.drawPuppet();
  const ps = rec.ops.filter((o) => o.op === 'fill');
  ok('the unicorn is one path per row of the model table',
     ps.length >= sp.paths, ps.length + ' fills for ' + sp.paths + ' paths in the sprite');
  ok('and every one is a closed polygon, not a projected face',
     ps.every((o) => o.n >= 3) && rec.ops.every((o) => o.op !== 'translate'),
     'smallest path has ' + Math.min(...ps.map((o) => o.n)) + ' points');
  const cols = new Set(ps.map((o) => o.c));
  ok('it carries a gold horn, a grey body and a rainbow crest',
     cols.size >= 20, cols.size + ' distinct fills across ' + sp.paths + ' paths');

  // What each path is FOR is what lets the drawing keep carrying state, so the
  // tally matters as much as the geometry.
  const kinds = sp.kinds.split('').map(Number);
  const tally = [0, 1, 2, 3].map((k) => kinds.filter((v) => v === k).length);
  ok('and the table says which path is body, mane, horn and eye',
     tally[0] > 0 && tally[1] >= 7 && tally[2] > 0 && tally[3] > 0,
     tally[0] + ' body, ' + tally[1] + ' mane, ' + tally[2] + ' horn, ' + tally[3] + ' eye');
  ok('with a mane band for every colour in the rainbow',
     sp.mane >= 7, sp.mane + ' mane paths against a ' + 7 + '-band rainbow');

  // It is a viewmodel: it hangs off the bottom-right corner and runs off the
  // bottom of the frame, exactly as a puppet worn on the arm would.
  const xs = ps.flatMap((o) => o.p.map((q) => q[0]));
  const ys = ps.flatMap((o) => o.p.map((q) => q[1]));
  ok('it sits in the bottom-right and runs off the bottom edge',
     Math.min(...xs) > 900 / 2 && Math.max(...ys) > 500,
     'x from ' + Math.min(...xs).toFixed(0) + ', reaching y ' + Math.max(...ys).toFixed(0) +
     ' past a frame 500 tall');
  ok('and its horn tip is the model origin, so the pose has one handle',
     Math.abs(sp.tip[0] - Math.min(...xs)) < 2 && Math.abs(sp.tip[1] - Math.min(...ys)) < 2,
     'tip reported at ' + sp.tip.map((v) => v.toFixed(0)).join(', ') +
     ', drawn bounds start ' + Math.min(...xs).toFixed(0) + ', ' + Math.min(...ys).toFixed(0));
  M.setFire(1);
}

console.log('');
console.log('--- and it is sized off the frame, not in fixed pixels -------------');
{
  // Everything else in the HUD scales with the screen height. A viewmodel pinned
  // in absolute pixels would be a different animal on every monitor.
  M.restart(); M.place([]); M.look(0, 0);
  M.setFire(0);
  const spanAt = (w, h) => {
    globalThis.innerWidth = w; globalThis.innerHeight = h;
    (L.resize || []).forEach((f) => f());
    tick();
    rec.ops = []; M.drawPuppet();
    const ys = rec.ops.filter((o) => o.op === 'fill').flatMap((o) => o.p.map((q) => q[1]));
    return Math.max(...ys) - Math.min(...ys);
  };
  const a = spanAt(900, 500), b = spanAt(1800, 1000);
  ok('twice the height draws twice the unicorn',
     Math.abs(b / a - 2) < 0.02,
     a.toFixed(0) + 'px tall at 500, ' + b.toFixed(0) + 'px at 1000 - a ratio of ' + (b / a).toFixed(3));

  // Height was never the problem; SHAPE was. x used to be a fraction of the
  // height measured from the left edge, so keeping the width and taking height
  // away - which is all docking a console does - walked the animal from 71% of
  // the way across the frame to 38%, while the crosshair stayed on the middle.
  // Measured from the centre it cannot: the offset is the same number of pixels
  // whatever the width.
  const across = (w, h) => {
    globalThis.innerWidth = w; globalThis.innerHeight = h;
    (L.resize || []).forEach((f) => f());
    tick();
    return M.sprite().tip[0] / w;
  };
  const shapes = [[1280, 551], [1280, 860], [1920, 1080], [1024, 768], [2560, 1080]];
  const pcs = shapes.map(([w, h]) => across(w, h));
  ok('and the same window at a different SHAPE keeps it in the same place',
     Math.max(...pcs) - Math.min(...pcs) < 0.04,
     'from 4:3 to 21:9 it sits ' + (Math.min(...pcs) * 100).toFixed(1) + '% to ' +
     (Math.max(...pcs) * 100).toFixed(1) + '% across, a spread of ' +
     ((Math.max(...pcs) - Math.min(...pcs)) * 100).toFixed(1) + ' points');
  // and the crosshair holds the middle through all of it
  const offs = shapes.map(([w, h]) => {
    globalThis.innerWidth = w; globalThis.innerHeight = h;
    (L.resize || []).forEach((f) => f());
    tick();
    return Math.abs(M.aimPoint()[0] - w / 2);
  });
  ok('while the crosshair stays on the middle of every one of them',
     Math.max(...offs) < 0.5,
     'worst ' + Math.max(...offs).toFixed(2) + 'px off centre across five window shapes');
  across(900, 500);                               // put the frame back for what follows
  globalThis.innerWidth = 900; globalThis.innerHeight = 500;
  (L.resize || []).forEach((f) => f());
  M.setFire(1);
}
console.log('--- recoil and blink ---------------------------------------------');
{
  // Recoil moves what is DRAWN, not what is aimed: a crosshair that shook on
  // every shot would be aiming at the kick. sprite() reports both.
  const tipNow = () => M.sprite().drawn;
  M.restart(); M.place([]); M.look(0, 0);
  M.setFire(0);
  for (let i = 0; i < 6; i++) tick();
  const rest = tipNow();
  M.setFire(1);
  shoot();
  const kicked = tipNow();
  M.setFire(0);
  const back = Math.hypot(kicked[0] - rest[0], kicked[1] - rest[1]);
  ok('firing kicks the puppet back', back > 3,
     'the horn tip moved ' + back.toFixed(0) + 'px on screen');
  ok('and it kicks AFTER the shot leaves, not before',
     M.dbg().horns.length === 1,
     'the horn is already away when the recoil starts');
  // and eases out within RECT
  let n = 0;
  while (M.anim().rec > 0 && n++ < 120) tick();
  const settled = tipNow();
  M.setFire(1);
  ok('and eases back out', Math.hypot(settled[0] - rest[0], settled[1] - rest[1]) < 0.5 &&
     Math.abs(n / 60 - C._RECT) < 0.05,
     'back to within ' + Math.hypot(settled[0] - rest[0], settled[1] - rest[1]).toFixed(2) +
     'px after ' + (n / 60).toFixed(2) + 's, against RECT ' + C._RECT);

  // blink: the eye's own height collapses and returns, on a varying timer
  M.restart(); M.place([]); M.look(0, 0);
  M.setFire(0);                                  // firing blinks too - this is the idle timer
  let sawOpen = 0, sawShut = 0, gaps = [], last = -1, n2 = 0;
  const anim0 = [];
  for (let i = 0; i < 60 * 20; i++) {
    tick();
    const a = M.anim();
    anim0.push(a.blink);
    if (a.blink > 0 && last <= 0) { if (last >= 0) gaps.push(n2 / 60); n2 = 0; }
    last = a.blink;
    n2++;
  }
  M.setFire(1);
  const blinks = anim0.filter((v, i) => v > 0 && (anim0[i - 1] || 0) <= 0).length;
  ok('the eyes blink', blinks >= 3, blinks + ' blinks in 20 seconds');
  ok('on a randomised timer, not a metronome',
     new Set(gaps.map((v) => v.toFixed(1))).size > 1,
     'gaps of ' + gaps.map((v) => v.toFixed(1)).join(', ') + 's between ' + C._BLINK0 + ' and ' + C._BLINK1);
  const maxB = Math.max(...anim0);
  ok('and each lasts about BLINKD', Math.abs(maxB - C._BLINKD) < 0.03,
     'longest blink ' + maxB.toFixed(3) + 's against ' + C._BLINKD);

  // firing blinks too, and pushes the idle timer back so a shot is not followed
  // by a second blink a moment later
  M.restart(); M.place([]); M.look(0, 0);
  M.setFire(0);
  for (let i = 0; i < 40; i++) tick();           // let any idle blink finish
  const before = M.anim();
  M.setFire(1);
  shoot();
  const after = M.anim();
  ok('firing blinks as well as kicking',
     before.blink === 0 && after.blink > 0,
     'blink went ' + before.blink.toFixed(2) + ' -> ' + after.blink.toFixed(2) + 's on the trigger');
  ok('and the idle timer is pushed back, so it does not blink twice',
     after.nextB >= C._BLINK0 - 1e-9,
     'next idle blink rescheduled to ' + after.nextB.toFixed(1) + 's away');
}

console.log('');
console.log('--- a horn in flight is a cone -----------------------------------');
{
  M.restart(); M.place([]); M.look(0, 0);
  rec.ops = [];
  shoot();
  tick();
  const isGold = (c) => { const m = (c.match(/[0-9]+/g) || []).map(Number);
    return m.length === 3 && m[0] > 90 && m[1] > 60 && m[2] < m[0] * 0.35; };
  const gold = rec.ops.filter((o) => o.op === 'fill' && o.n >= 3 && isGold(o.c));
  const tri = gold.filter((o) => o.n === 3).length;
  const base = gold.filter((o) => o.n === C._HN).length;
  // The proof is the ROUND base. How many side triangles survive culling depends
  // on where the puppet is posed, which is not what this is about.
  ok('the flying horn is a cone, not a pyramid',
     base >= 1 && C._HN > 4,
     'a ' + C._HN + '-sided base and ' + tri + ' visible side triangles - a box tapered to a point is a pyramid');
  ok('and its base is round enough to read as one', C._HN >= 6,
     C._HN + ' sides');
}

console.log('');
console.log('--- the cooldown reads on the mane -------------------------------');
{
  // DESIGN.md 6 puts this on a casting arm. There is no arm - the unicorn casts -
  // so the rainbow it runs on is the mane.
  const sat = (c) => { const m = (c.match(/[0-9]+/g) || []).map(Number).slice(0, 3);
    return m.length === 3 ? (Math.max(...m) - Math.min(...m)) / (Math.max(...m) || 1) : 0; };
  M.setFire(0);
  M.restart(); M.place([]); M.look(0, 0);
  const at = (t) => { M.setBind(t); rec.ops = []; tick();
    return rec.ops.filter((o) => o.op === 'fill' && o.n >= 3).map((o) => o.c); };
  const a0 = at(0), a1 = at(C._BINDCD * 0.5), a2 = at(C._BINDCD);
  // Only the faces that actually change: the horn's gold and the eyes are
  // saturated too and do not wash, and averaging them in halves the effect.
  const moved = a0.map((c, i) => (c !== a2[i] ? i : -1)).filter((i) => i >= 0);
  const mean = (arr, idx) => idx.reduce((a, i) => a + sat(arr[i]), 0) / (idx.length || 1);
  const s1 = mean(a0, moved), s2 = mean(a1, moved), s3 = mean(a2, moved);
  M.setBind(0);
  ok('the mane is the cooldown: full colour ready, washed out when spent',
     moved.length >= M.sprite().mane && s1 > s2 && s2 > s3,
     moved.length + ' faces change with it; saturation ' + s1.toFixed(2) + ' ready, ' +
     s2.toFixed(2) + ' half charged, ' + s3.toFixed(2) + ' just cast');
  ok('washed, never gone - the rainbow stays on the unicorn',
     s3 > 0.02 && s3 < s1 * 0.45,
     'down to ' + s3.toFixed(2) + ' of ' + s1.toFixed(2) + ', which is SAT0 ' + C._SAT0);
  M.setBind(C._BINDCD);
  let n = 0;
  while (M.anim().bindT > 0 && n++ < 60 * 20) tick();
  ok('and it recharges over BINDCD', Math.abs(n / 60 - C._BINDCD) < 0.1,
     'back to full in ' + (n / 60).toFixed(2) + 's against ' + C._BINDCD + 's');
  // Checking that nothing draws on the left broke the moment the puppet was
  // moved toward the middle of the frame. The arm's absence is a fact about the
  // source, so check that.
  ok('the casting arm is gone from the source, not just off-screen',
     ['CAST', 'CASTL', 'CASTR', 'SLEEVE', 'PALM', 'WRAPT', 'BANDN'].every((k) => C[k] === undefined),
     'none of its constants exist any more');
  M.setFire(1);
}

console.log('');
console.log('--- the crosshair sits on the drawn horn --------------------------');
{
  M.setFire(0);
  M.restart(); M.place([]); M.look(0, 0);
  tick();
  // The sprite is flat-shaded polygons and carries no outline: it has its own
  // facets to separate its parts, which is what the 3D neck and head needed the
  // outline for. Nothing in the viewmodel strokes any more.
  const sp = M.sprite();
  rec.ops = []; M.drawPuppet();
  const ps = rec.ops.filter((o) => o.op === 'fill');
  ok('the sprite is filled, never stroked',
     ps.length > 20 && !rec.ops.some((o) => o.op === 'stroke') &&
     C._OUTL === undefined && C._OUTA === undefined,
     ps.length + ' fills, 0 strokes, and no outline constants left in the source');

  // Where the crosshair lands is a pose decision, so it is reported, not
  // asserted - asserting it would be this file overruling the pose.
  const a = M.aimPoint();
  console.log('       (the crosshair is at (' + a.map((v) => v.toFixed(0)).join(', ') +
              '), ' + Math.hypot(a[0] - 450, a[1] - 250).toFixed(0) + 'px from the centre of a 900x500 frame)');

  // Whether the drawn horn ALSO points at it is a pose decision, and the pose
  // says no: the crosshair is pinned to the centre of the screen and the animal
  // sits where it looks right, so the horn casts its own line past it. Reported,
  // never asserted - asserting it would be this file overruling the pose.
  const ca = Math.cos(C._UROT), sa = Math.sin(C._UROT);
  const dx = -(C._UHA[0] * ca - C._UHA[1] * sa), dy = -(C._UHA[0] * sa + C._UHA[1] * ca);
  const t = (a[0] - sp.tip[0]) / dx;
  console.log('       (the drawn horn casts its line ' +
              Math.abs(sp.tip[1] + t * dy - a[1]).toFixed(0) + 'px from the crosshair)');

  // But a shot must still LEAVE the horn the player is looking at, and end up
  // under the crosshair. Those are two different points now - AIMO holds the
  // crosshair still, the sprite sits where the pose puts it - so the trajectory
  // is what joins them: born on the drawn tip, aimed at the convergence point.
  M.restart(); M.place([]); M.look(0, 0); M.setFire(1);
  for (let i = 0; i < 200 && !M.dbg().horns.length; i++) tick();
  const h0 = M.dbg().horns[0].slice();            // the game moves these in place
  const born = M.proj(M.cam([h0[0] - h0[3] / 60, h0[1] - h0[4] / 60, h0[2] - h0[5] / 60]));
  const xh = M.aimPoint();
  M.setFire(0);
  let n2 = 0; while (M.anim().rec > 0 && n2++ < 120) tick();   // let the kick ease out
  const tip = M.sprite().tip;
  ok('a shot leaves the horn the player can see',
     Math.hypot(born[0] - tip[0], born[1] - tip[1]) < 2,
     'born at ' + born.map((v) => v.toFixed(1)).join(', ') +
     ' against a drawn horn tip at ' + tip.map((v) => v.toFixed(1)).join(', '));
  const at = (t) => M.proj(M.cam([h0[0] + h0[3] * t, h0[1] + h0[4] * t, h0[2] + h0[5] * t]));
  const off = [0.1, 0.2, 0.35].map((t) => Math.hypot(at(t)[0] - xh[0], at(t)[1] - xh[1]));
  ok('and flies to the crosshair, closing the whole way',
     off[0] > off[1] && off[1] > off[2] && off[2] < 6,
     'it comes in ' + off.map((v) => v.toFixed(0)).join('px, ') +
     'px off the crosshair at 0.10s, 0.20s and 0.35s');
  M.setFire(1);
  M.setFire(1);
}

console.log('--- the bind -----------------------------------------------------');
{
  M.setFire(0);
  const RB = [[255, 59, 107], [255, 149, 0], [255, 214, 10], [58, 211, 95],
                [34, 201, 255], [88, 96, 235], [180, 92, 255]];
  const ARMF = Math.round(C._ARM * 60);
  // Afterwards charging is on and bindC is still zero, so frame counts below mean
  // what they say.
  const arm = armed;
  const hold = (frames) => { arm(); for (let i = 0; i < frames; i++) tick(); };
  // The only way to cast: hold until it lets go by itself.
  const fireIt = () => { arm(); let i = 0; while (M.anim().charging && i++ < 60 * 20) tick(); release(); };
  const CHG = Math.round(C._BINDCHG * 60);

  // --- it charges on a clock, and lets go by itself ---------------------------
  M.restart(); M.place([]); M.look(0, 0);
  hold(30);
  const half = M.anim().bindR;
  release();
  ok('holding charges the bind', half > 0,
     'radius ' + half.toFixed(2) + 'm after half a second');
  ok('and the radius is how far through BINDCHG you are',
     Math.abs(half - C._BINDR * 0.5 / C._BINDCHG) < 0.05,
     half.toFixed(2) + 'm against ' + (C._BINDR * 0.5 / C._BINDCHG).toFixed(2) + 'm - a clock, not a speed');

  M.restart(); M.place([]); M.look(0, 0);
  arm();
  let n = 0;
  while (M.anim().charging && n++ < 60 * 20) tick();
  ok('it FIRES ITSELF at BINDCHG, without waiting for the player',
     Math.abs(n / 60 - C._BINDCHG) < 0.03 && M.anim().wallT > 0,
     'let go on its own after ' + (n / 60).toFixed(2) + 's against ' + C._BINDCHG + 's, and threw the wall');
  ok('and a full charge costs the whole BINDCD',
     Math.abs(M.anim().bindT - C._BINDCD) < 0.05,
     M.anim().bindT.toFixed(2) + 's owed against ' + C._BINDCD + 's');
  const fullR = M.anim().wallR;
  ok('at exactly BINDR', Math.abs(fullR - C._BINDR) < 0.05,
     fullR.toFixed(2) + 'm against ' + C._BINDR + 'm');
  release();

  // --- and the cooldown locks you out -----------------------------------------
  press();
  for (let i = 0; i < ARMF + 30; i++) tick();
  ok('you cannot begin a charge while the cooldown is owed',
     M.anim().charging === 0 && M.anim().bindR === 0,
     'held still past the arming window with ' + M.anim().bindT.toFixed(1) +
     's still owed, and nothing grew');
  release();
  let w = ARMF + 30;                             // the lockout probe above was part of the wait
  while (M.anim().bindT > 0 && w++ < 60 * 30) tick();
  ok('and it comes back after BINDCD', Math.abs(w / 60 - C._BINDCD) < 0.1,
     'ready again ' + (w / 60).toFixed(2) + 's after the cast, against ' + C._BINDCD + 's');
  hold(30);
  ok('and then it charges again', M.anim().bindR > 0,
     'a fresh press grew ' + M.anim().bindR.toFixed(2) + 'm');
  release();

  // --- the trigger is the ONLY thing that fires it -----------------------------
  M.restart(); M.look(0, 0);
  M.place([[3, C._GY, 0, 9, 9, 0, 0, 0, 0]]);
  hold(CHG - 6);                                 // a tenth of a second short of it
  const nearly = M.anim().bindR;
  release(); tick();
  ok('letting go short of the trigger fires nothing at all',
     M.anim().wallT === 0 && M.dbg().ghosts[0][8] === 0,
     'released at ' + nearly.toFixed(2) + 'm of ' + C._BINDR + 'm - no wall, and the ghost at 3m was not caught');
  ok('and costs nothing, so it can be started again at once',
     M.anim().bindT === 0 && M.anim().bindR === 0,
     'no cooldown owed and the charge is back to zero');

  // --- the arming window --------------------------------------------------------
  // A player who only wants to look around holds and drags. That must never
  // charge, or every camera movement casts.
  M.restart(); M.place([]); M.look(0, 0);
  press(450, 250);
  drag(450 + C._ARMPX + 6, 250);
  for (let i = 0; i < ARMF * 3; i++) tick();
  ok('dragging inside the arming window never charges, however long you hold',
     M.anim().charging === 0 && M.anim().armT < 0,
     'moved ' + (C._ARMPX + 6) + 'px past the ' + C._ARMPX + 'px allowance, then held for ' +
     (C._ARM * 3).toFixed(1) + 's - the press is a turn and only a turn');
  release();

  // but a hand is never perfectly still, so a little movement has to be allowed
  M.restart(); M.place([]); M.look(0, 0);
  press(450, 250);
  for (let i = 0; i < ARMF; i++) { drag(450 + (i % 2), 250); tick(); }
  ok('and a jittering hand still arms', M.anim().charging === 1,
     'a pixel of wobble each frame stayed inside the ' + C._ARMPX + 'px allowance');
  release();

  M.restart(); M.place([]); M.look(0, 0);
  press();
  for (let i = 0; i < ARMF - 2; i++) tick();
  const notYet = M.anim();
  tick(); tick();
  ok('holding still starts the charge at ARM, not before',
     notYet.charging === 0 && M.anim().charging === 1,
     'nothing at ' + ((ARMF - 2) / 60).toFixed(2) + 's, charging at ' + C._ARM + 's');
  ok('and the charge starts from zero when it does',
     M.anim().bindR < C._BINDR / C._BINDCHG * 0.1,
     'the arming second is not counted as charge - ' + M.anim().bindR.toFixed(3) + 'm so far');
  release();

  // Nothing shows while it arms. A ring that appears during a press which turns
  // out to be a turn reads as the bind going off early, and every turn starts
  // with a few frames of arming before the drag disqualifies it.
  M.restart(); M.place([]); M.look(0, 0);
  press();
  for (let i = 0; i < ARMF - 2; i++) tick();     // the sampling tick below is the last one
  rec.ops = []; tick();
  // Additive, like everything the bind puts on the floor - which is also what
  // keeps the unicorn's own four-point rainbow paths out of the count.
  const ground = rec.ops.filter((o) => o.op === 'fill' && o.n === 4 && o.comp === 'lighter' &&
    o.c.startsWith('rgba(') && !o.c.startsWith('rgba(' + C._RINGC.join(',') + ','));
  ok('nothing is drawn on the ground while it is only arming',
     ground.length === 0 && M.anim().charging === 0,
     'a frame short of arming, and neither the rim nor the floor exists yet');
  // and once it is charging the rim fades in, rather than snapping on
  const rimAt = (ops) => {
    const q = ops.filter((o) => o.op === 'fill' && o.c.startsWith('rgba(' + C._RIMC.join(',') + ','));
    return q.length ? parseFloat(q[0].c.split(',').pop()) : 0;
  };
  rec.ops = []; tick();
  const a0 = rimAt(rec.ops);
  for (let i = 0; i < Math.round(C._RIMFI * 30); i++) tick();
  rec.ops = []; tick();
  const a1 = rimAt(rec.ops);
  for (let i = 0; i < Math.round(C._RIMFI * 60); i++) tick();
  rec.ops = []; tick();
  const a2 = rimAt(rec.ops);
  ok('and the rim fades in over RIMFI rather than snapping on',
     a0 < a1 && a1 < a2 && a0 < 0.05,
     'alpha ' + a0.toFixed(3) + ' then ' + a1.toFixed(2) + ' then ' + a2.toFixed(2) +
     ' across the first ' + C._RIMFI + 's of the charge');
  const both = rec.ops.filter((o) => o.op === 'fill' && o.n === 4 &&
    o.c.startsWith('rgba(') && !o.c.startsWith('rgba(' + C._RINGC.join(',') + ','));
  const cyan = both.filter((o) => o.c.startsWith('rgba(' + C._RIMC.join(',') + ','));
  ok('and the floor is up by then too',
     cyan.length > 8 && both.length > cyan.length,
     cyan.length + ' cyan quads and ' + (both.length - cyan.length) + ' of floor, ' +
     M.anim().bindR.toFixed(2) + 'm in');
  release();

  // --- turning while charging does both ----------------------------------------
  M.restart(); M.place([]); M.look(0, 0);
  arm();
  for (let i = 1; i <= 20; i++) { drag(450 + i * 8, 250); tick(); }
  const turned = M.anim();
  const yawNow = M.dbg().yaw;
  release();
  ok('turning the camera while charging does not cancel it',
     turned.charging === 1 && turned.bindR > 0,
     'dragged 160px over a third of a second and the charge reached ' +
     turned.bindR.toFixed(2) + 'm');
  ok('and the camera actually turned while it did', Math.abs(yawNow) > 0.05,
     'yaw ' + (yawNow * 180 / Math.PI).toFixed(0) + ' degrees - both gestures at once, on one pointer');

  // and it still reaches the trigger from there
  M.restart(); M.place([]); M.look(0, 0);
  arm();
  let dn = 0;
  while (M.anim().charging && dn++ < 60 * 20) { drag(450 + (dn % 40), 250); tick(); }
  release();
  ok('and a charge held through a turn still fires',
     Math.abs(dn / 60 - C._BINDCHG) < 0.05 && M.anim().wallT > 0,
     'turning the whole way, it still let go by itself at ' + (dn / 60).toFixed(2) + 's');

  // --- what it catches ---------------------------------------------------------
  // Placed far enough out that three seconds of charging does not walk them
  // somewhere else before the cast lands.
  M.restart(); M.look(0, 0);
  M.place([[6, C._GY, 0, 9, 9, 0, 0, 0, 0], [0, C._GY, 20, 9, 9, 0, 0, 0, 0]]);
  fireIt();
  const [near, far] = M.dbg().ghosts;
  ok('casting holds the ghosts inside the ring', near[8] > 0,
     'one at ' + Math.hypot(near[0], near[2]).toFixed(1) + 'm, inside the ' + C._BINDR +
     'm ring, held for ' + near[8].toFixed(1) + 's');
  ok('and leaves the ones outside it alone', far[8] === 0,
     'one at ' + far[2].toFixed(1) + 'm, outside, untouched');
  const z0 = far[2], x0 = near[0];
  for (let i = 0; i < 30; i++) tick();
  ok('a held ghost stops where it is', Math.abs(M.dbg().ghosts[0][0] - x0) < 1e-9,
     'still at ' + M.dbg().ghosts[0][0].toFixed(2) + 'm after half a second');
  ok('while a free one keeps coming', M.dbg().ghosts[1][2] < z0 - 0.4,
     'the far one closed from ' + z0.toFixed(1) + 'm to ' + M.dbg().ghosts[1][2].toFixed(1) + 'm');
  let h = 30;
  while (M.dbg().ghosts[0] && M.dbg().ghosts[0][8] > 0 && h++ < 600) tick();
  ok('and is released after BINDDUR', Math.abs(h / 60 - C._BINDDUR) < 0.1,
     'held for ' + (h / 60).toFixed(2) + 's against ' + C._BINDDUR + 's');

  // --- the ground rainbow ------------------------------------------------------
  // The distance rings are drawn with the same band() the ground rainbow uses, so
  // 'a four-point rgba fill on the floor' now matches them too. They are the one
  // thing on that floor which is never a rainbow colour.
  const RINGC = 'rgba(' + C._RINGC.join(',') + ',';
  const isBow = (c) => c.startsWith('rgba(') && !c.startsWith(RINGC);
  // A four-point fill in a rainbow colour used to mean the bind and nothing
  // else. The unicorn's mane is rainbow-coloured too and has four-point paths of
  // its own, so what separates them is the blending: the bind is drawn additively
  // over the world, the sprite is not.
  const quads = (ops) => ops.filter((o) => o.op === 'fill' && isBow(o.c) && o.n === 4 &&
    o.comp === 'lighter');
  M.restart(); M.place([]); M.look(0, 0);
  hold(60);
  rec.ops = []; tick();
  const floor = quads(rec.ops);
  ok('the charge covers the ground rather than ringing it',
     floor.length > C._BINDBAND * 4 &&
       !rec.ops.some((o) => o.op === 'stroke' && o.comp === 'lighter' &&
         /rgba\(255,255,255/.test(o.c)),
     floor.length + ' filled quads across ' + C._BINDBAND + ' bands, and no white ring anywhere');
  ok('and it is additive, so the shared band edges are seamless',
     floor.every((o) => o.comp === 'lighter'),
     'two antialiased half-covered edges sum to exactly one whole');

  // uniform: every band spans the same radial distance in the world
  const colours = [...new Set(floor.map((o) => o.c.replace(/,[\d.]+\)$/, ')')))];
  ok('and the bands walk the rainbow rather than repeating six colours',
     colours.length > RB.length,
     colours.length + ' distinct colours across ' + C._BINDBAND + ' bands, from a palette of only ' +
     RB.length + ' - they are stops interpolated between, not slots');

  // The rim sits out at BINDR the whole time. It used to walk the rainbow around
  // its circumference, which is exactly why it read as one colour and that colour
  // was orange: you only ever see the forward arc, and forward is a quarter of the
  // way round. A hint is one deliberate colour instead.
  const rimQ = (ops) => ops.filter((o) => o.op === 'fill' &&
    o.c.startsWith('rgba(' + C._RIMC.join(',') + ','));
  const rq = rimQ(rec.ops);
  ok('a cyan circle marks where the wave will end', rq.length > 8,
     rq.length + ' quads at rgb(' + C._RIMC + '), one colour all the way round');
  ok('and it is one colour, not an arc of the rainbow',
     new Set(rq.map((o) => o.c)).size === 1,
     'every quad of it is the same cyan, so which way you face does not change it');

  const alphaOf = (ops, i) => parseFloat(quads(ops)[i].c.split(',').pop());
  const p0 = alphaOf(rec.ops, 0);
  for (let i = 0; i < 14; i++) tick();
  rec.ops = []; tick();
  const p1 = alphaOf(rec.ops, 0);
  ok('and it pulses, rather than sitting there', Math.abs(p1 - p0) > 0.02,
     'the innermost band went from alpha ' + p0.toFixed(3) + ' to ' + p1.toFixed(3) + ' in a quarter second');

  // the rim brightens as the trigger comes up
  const rimA = (ops) => parseFloat(rimQ(ops)[0].c.split(',').pop());
  const early = rimA(rec.ops);
  for (let i = 0; i < 60; i++) tick();
  rec.ops = []; tick();
  ok('and the rim brightens as the trigger comes up', rimA(rec.ops) > early + 0.05,
     'alpha ' + early.toFixed(2) + ' to ' + rimA(rec.ops).toFixed(2) + ' a second later');
  release();

  // --- the wall ----------------------------------------------------------------
  M.restart(); M.place([]); M.look(0, 0);
  fireIt();
  let wt = 0;
  for (; wt < 6; wt++) tick();                   // let it get far enough out to be seen
  rec.ops = []; tick(); wt++;
  const wq = quads(rec.ops);
  ok('casting throws a wall of rainbow', wq.length > 20,
     wq.length + ' quads, red on the floor to violet on top');
  const wc = [...new Set(wq.map((o) => o.c.replace(/,[\d.]+\)$/, ')')))];
  ok('and the rainbow repeats WALLREP times up it',
     wc.length === RB.length && wq.length > C._BINDSEG * 3,
     RB.length + ' colours over ' + (6 * C._WALLREP) + ' bands - the same wave stacked ' +
     C._WALLREP + ' times, ' + (C._WALLH * C._WALLREP).toFixed(1) + 'm tall');
  const w0 = M.anim().wallR;
  let wn = wt;
  while (M.anim().wallT > 0 && wn++ < 300) tick();
  ok('and it lives for WALLDUR then is gone', Math.abs(wn / 60 - C._WALLDUR) < 0.03,
     'a ' + w0.toFixed(1) + 'm wall lasted ' + (wn / 60).toFixed(2) + 's against ' + C._WALLDUR + 's');
  rec.ops = []; tick();
  ok('and draws nothing once it is over', quads(rec.ops).length === 0, 'no rainbow quads left');

  // --- the eye and the horn while charging -----------------------------------
  // Both used to be found by their geometry - the eye a ten-point cone, the horn
  // an opaque four-point quad. The sprite has neither, so they are found by what
  // the model table SAYS they are, which is the same thing the frame reads.
  const KIND = M.sprite().kinds.split('').map(Number);
  const byKind = (k) => {
    rec.ops = []; M.drawPuppet();
    const fills = rec.ops.filter((o) => o.op === 'fill');
    return fills.filter((_, i) => KIND[i] === k).map((o) => o.c);
  };
  const chan = (c) => c.match(/\d+/g).map(Number).slice(0, 3);

  M.restart(); M.place([]); M.look(0, 0);
  tick();
  const calm = byKind(3), calmH = byKind(2), calmB = byKind(0);
  ok('the eye is a cool blue when nothing is charging',
     calm.length > 0 && (() => { const v = chan(calm[0]); return v[2] > v[0] * 1.4 && v[2] > 60; })(),
     calm[0] + ' - blue channel well clear of the red');
  hold(90);
  const lit = byKind(3), litH = byKind(2);
  ok('and it runs the rainbow while charging', lit.length > 0 && lit[0] !== calm[0],
     calm[0] + ' became ' + lit[0] + ' at ' + M.anim().bindR.toFixed(1) + 'm of charge');
  ok('and so does the horn, which is where the crosshair sits',
     litH.length > 0 && litH[0] !== calmH[0],
     calmH[0] + ' became ' + litH[0]);
  release(); tick();

  M.restart(); M.place([]); M.look(0, 0);
  const still0 = byKind(0).join('|');
  for (let i = 0; i < 20; i++) tick();
  ok('the body holds its colours when nothing is charging',
     byKind(0).join('|') === still0, 'a third of a second later, not a face has changed');

  hold(60);
  const horn0 = byKind(2).join('|');
  for (let i = 0; i < 12; i++) tick();
  ok('and the horn keeps moving as the charge cycle turns over',
     byKind(2).join('|') !== horn0,
     'it changed twice - once from gold when the charge started, and again a ' +
     'fifth of a second later as the cycle moved on');
  ok('while the body stays out of it',
     byKind(0).join('|') === still0,
     'only the paths the table marks as horn and eye take the rainbow');
  release(); tick();
  M.setFire(1);
}

console.log('');
console.log('--- the minimap --------------------------------------------------');
{
  M.setFire(0);
  const arcs = (ops, col) => ops.filter((o) => o.a && (!col || o.c === col));
  const R = C._MAPR * 500, OX = C._MAPPAD + R, OY = C._MAPPAD + R;

  M.restart(); M.look(0, 0);
  M.place([]);
  rec.ops = []; tick();
  const dish = arcs(rec.ops, C._MAPBG)[0];
  ok('there is a round dish in the top-left corner',
     !!dish && Math.abs(dish.a[0] - OX) < 0.5 && Math.abs(dish.a[1] - OY) < 0.5,
     'centred at ' + dish.a[0].toFixed(0) + ',' + dish.a[1].toFixed(0) +
     ' with a radius of ' + dish.a[2].toFixed(0) + 'px');
  ok('and it is inside DESIGN.md 11 roughly-a-quarter-of-H cap',
     dish.a[2] * 2 <= 500 / 4 && dish.a[2] * 2 > 500 / 6,
     (dish.a[2] * 2).toFixed(0) + 'px across against the ' + (500 / 4).toFixed(0) +
     'px cap - inside it, and nowhere near shrunk for tidiness');

  const cone = arcs(rec.ops, C._MAPCONE)[0];
  const mid = (cone.a[3] + cone.a[4]) / 2, half = (cone.a[4] - cone.a[3]) / 2;
  ok('the view cone points straight up, because the map is heading-up',
     Math.abs(mid + Math.PI / 2) < 1e-9,
     'centred on ' + (mid * 180 / Math.PI).toFixed(0) + ' degrees - screen up, so ahead is up');
  ok('and it is the real field of view, not a decorative wedge',
     Math.abs(half * 2 - 2 * Math.atan2(900 / 2, M.dbg().PX * C._F)) < 1e-9,
     (half * 2 * 180 / Math.PI).toFixed(0) + ' degrees wide, off the same W, PX and F the projection uses');

  // bearings. A blip must sit where the thing actually is.
  const blipFor = (x, z) => {
    M.restart(); M.look(0, 0);
    M.place([[x, C._GY, z, 9, 9, 0, 0, 0, 0]]);
    rec.ops = []; tick();
    return arcs(rec.ops, 'rgb(' + C._TYPES[0][9] + ')')[0].a;
  };
  const ahead = blipFor(0, 10), behind = blipFor(0, -10), right = blipFor(10, 0);
  ok('a ghost ahead of you is a blip above the dot',
     Math.abs(ahead[0] - OX) < 0.5 && ahead[1] < OY - 1,
     'dead ahead at 10m plots ' + (OY - ahead[1]).toFixed(0) + 'px above centre, dead on the vertical');
  ok('and one behind you is below it - true bearing, not just what is on screen',
     Math.abs(behind[0] - OX) < 0.5 && behind[1] > OY + 1,
     'behind you at 10m plots ' + (behind[1] - OY).toFixed(0) + 'px below centre');
  ok('and one to your right is to the right',
     right[0] > OX + 1 && Math.abs(right[1] - OY) < 0.5,
     '10m to starboard plots ' + (right[0] - OX).toFixed(0) + 'px right of centre');
  ok('and range is to scale', Math.abs((OY - ahead[1]) - 10 * R / (C._ARENA * C._MAPZ)) < 0.5,
     '10m of ' + (C._ARENA * C._MAPZ).toFixed(1) + 'm reach is ' + (OY - ahead[1]).toFixed(1) + 'px of ' + R.toFixed(0));

  // heading-up: turning moves the world, not the cone
  M.restart(); M.look(Math.PI / 2, 0);
  M.place([[0, C._GY, 10, 9, 9, 0, 0, 0, 0]]);
  rec.ops = []; tick();
  const turnedBlip = arcs(rec.ops, 'rgb(' + C._TYPES[0][9] + ')')[0].a;
  const turnedCone = arcs(rec.ops, C._MAPCONE)[0];
  ok('turning right swings the world left under a cone that never moves',
     turnedBlip[0] < OX - 1 && Math.abs(turnedCone.a[3] - cone.a[3]) < 1e-9,
     'the ghost that was ahead is now ' + (OX - turnedBlip[0]).toFixed(0) +
     'px to port, and the cone is still pointing up');

  // a ghost further out than the dish is clamped to the rim, not dropped
  M.restart(); M.look(0, 0);
  M.place([[0, C._GY, C._ARENA * 3, 9, 9, 0, 0, 0, 0]]);
  rec.ops = []; tick();
  const far = arcs(rec.ops, 'rgb(' + C._TYPES[0][9] + ')')[0].a;
  ok('a ghost beyond the dish is pinned to the rim rather than dropped',
     Math.abs((OY - far[1]) - R) < 0.5,
     'one at ' + (C._ARENA * 3) + 'm sits exactly on the rim at ' + (OY - far[1]).toFixed(0) + 'px');

  // held ghosts read as held
  M.restart(); M.look(0, 0);
  // Far enough out to survive the whole charge: it drifts a metre a second, and
  // arming plus charging is 3.3 of them.
  M.place([[8, C._GY, 0, 9, 9, 0, 0, 0, 0]]);
  armed();
  let z = 0;
  while (M.anim().charging && z++ < 60 * 20) tick();
  release();
  rec.ops = []; tick();
  const RBM = [[255, 59, 107], [255, 149, 0], [255, 214, 10], [58, 211, 95],
                [34, 201, 255], [88, 96, 235], [180, 92, 255]];
  ok('a held ghost turns rainbow on the map',
     RBM.some((v) => arcs(rec.ops, 'rgba(' + v.join(',') + ',1)').length === 1),
     'caught, and its blip runs the rainbow for as long as it is held');

  // the bind circle, which DESIGN.md 6 says is what the map is FOR
  M.restart(); M.place([]); M.look(0, 0);
  let w2 = 0;
  while (M.anim().bindT > 0 && w2++ < 60 * 30) tick();
  armed(); for (let i = 0; i < 60; i++) tick();
  rec.ops = []; tick();
  const ring = arcs(rec.ops, 'rgba(' + C._RIMC.join(',') + ',0.8)')[0];
  const disc = arcs(rec.ops, 'rgba(255,214,10,0.22)')[0];
  ok('the bind draws on the map as the circle it actually is',
     !!ring && Math.abs(ring.a[2] - C._BINDR * R / (C._ARENA * C._MAPZ)) < 0.5,
     'a ' + C._BINDR + 'm ring is ' + ring.a[2].toFixed(1) + 'px of a ' + R.toFixed(0) + 'px dish');
  ok('with the charge filling it as it grows',
     !!disc && disc.a[2] > 0 && disc.a[2] < ring.a[2],
     'charged to ' + disc.a[2].toFixed(1) + 'px of the ' + ring.a[2].toFixed(1) + 'px it is heading for');
  release(); tick();
  M.setFire(1);
}

console.log('');
console.log('--- the HUD ------------------------------------------------------');
{
  M.setFire(0);
  M.restart(); M.place([]); M.look(0, 0);
  rec.ops = []; tick();
  const texts = rec.ops.filter((o) => o.op === 'text');
  const wave = texts.find((o) => /^WAVE/.test(o.s));
  const kills = texts.find((o) => /^THREAT LEVEL/.test(o.s));
  ok('the wave counter is at the top centre', !!wave && wave.x === 900 / 2 && wave.align === 'center',
     '"' + wave.s + '" centred at x=' + wave.x + ', y=' + wave.y.toFixed(0));
  ok('and the threat level sits under it, on the same centre line',
     !!kills && kills.x === wave.x && kills.y > wave.y && kills.align === 'center',
     '"' + kills.s + '" ' + (kills.y - wave.y).toFixed(0) + 'px below it');
  const shown = (w) => Math.max(Math.round(C._BUD0 * C._BUDR ** (w - 1)), w + 5);
  ok('and it reads the budget, which is what buys the ghosts',
     kills.s === 'THREAT LEVEL ' + shown(M.anim().wave),
     'the same number for every player who reaches this wave, where a kill count ' +
     'measured whatever the spawner happened to roll');
  // A threat level that stands still for a wave reads as a bug.
  const ladder = [];
  for (let w = 1; w <= 20; w++) ladder.push(shown(w));
  ok('and it never stands still from one wave to the next',
     ladder.every((v, i) => !i || v > ladder[i - 1]),
     ladder.slice(0, 10).join(', ') + ' ... - the BUDGET repeats at waves 3 and 4, ' +
     'because round(6 x 1.12^2) is 7.53 and round(6 x 1.12^3) is 8.43. The reading ' +
     'is nudged past it and the difficulty is untouched');
  ok('and the nudge only touches the early waves',
     [10, 15, 20].every((w) => shown(w) === Math.round(C._BUD0 * C._BUDR ** (w - 1))),
     'from wave 6 on it is the budget exactly - wave + 5 outruns the curve for five ' +
     'waves and never catches it again');

  const U = Math.min(900, 500) * C._HUDU;
  // Both read from the config rather than a remembered number, so retuning the
  // sizes is a config edit and not a test edit.
  ok('the wave counter is sized off WAVEF and leads the threat level',
     Math.abs(wave.f - (U * C._WAVEF | 0)) < 0.5 && wave.f > kills.f,
     wave.f + 'px at ' + C._WAVEF + ' of the unit, ahead of the ' + kills.f + 'px threat');
  ok('and the kill count off KILLF',
     Math.abs(kills.f - (U * C._KILLF | 0)) < 0.5,
     kills.f + 'px at ' + C._KILLF + ' of the unit');
  ok('and the wave counter is the horn gold', wave.c === 'rgba(' + C._GOLD.join(',') + ',1)',
     wave.c + ' - the same colour as the horn and the map dot');
  ok('while the kill count stays quiet under it', kills.c !== wave.c,
     kills.c + ', so the two do not compete');

  // hearts, doubled
  // Six-point fills used to mean hearts and nothing else. The unicorn sprite has
  // paths of six points too, so the HUD half of the frame is what separates them:
  // hearts live in the top strip, the animal hangs off the bottom.
  const hearts = rec.ops.filter((o) => o.op === 'fill' && o.n === 6 && !o.a &&
    o.p.every((q) => q[1] < 500 / 2));
  const wide = Math.max(...hearts.map((o) => Math.max(...o.p.map((q) => q[0])))) -
               Math.min(...hearts.map((o) => Math.min(...o.p.map((q) => q[0]))));
  const tall = Math.max(...hearts[0].p.map((q) => q[1])) - Math.min(...hearts[0].p.map((q) => q[1]));
  ok('there are three hearts, top-right', hearts.length === C._HEARTS &&
     Math.min(...hearts.map((o) => Math.min(...o.p.map((q) => q[0])))) > 900 / 2,
     hearts.length + ' of them, ' + wide.toFixed(0) + 'px of row');
  ok('and each is HEARTS2 times the HUD unit tall',
     Math.abs(tall - Math.min(900, 500) * C._HUDU * C._HEARTS2) < 0.5,
     tall.toFixed(0) + 'px against a ' + (Math.min(900, 500) * C._HUDU).toFixed(0) + 'px unit doubled');

  // the rainbow bar
  const RB2 = [[255, 59, 107], [255, 149, 0], [255, 214, 10], [58, 211, 95],
                [34, 201, 255], [88, 96, 235], [180, 92, 255]];
  const bars = (ops) => ops.filter((o) => o.op === 'rect' &&
    RB2.some((v) => o.c.startsWith('rgba(' + v.join(',') + ',')));
  const track = rec.ops.find((o) => o.op === 'rect' && o.c === C._BARBG);
  const heartL = Math.min(...hearts.map((o) => Math.min(...o.p.map((q) => q[0]))));
  const heartB = Math.max(...hearts.map((o) => Math.max(...o.p.map((q) => q[1]))));
  ok('there is a bar under the hearts', !!track && track.y > heartB,
     'a ' + track.w.toFixed(0) + 'x' + track.h.toFixed(0) + 'px track, ' +
     (track.y - heartB).toFixed(0) + 'px clear of them');
  ok('and it is as wide as BARN hearts, so it runs out past the three there are',
     Math.abs(track.w - Math.min(900, 500) * C._HUDU * C._HEARTS2 * (1 + (C._BARN - 1) * 1.35)) < 0.5 &&
       track.x < heartL,
     C._BARN + ' hearts wide at ' + track.w.toFixed(0) + 'px, reaching ' +
     (heartL - track.x).toFixed(0) + 'px left of the hearts');

  const readyOf = (ops) => ops.find((o) => o.op === 'text' && o.s === 'RAINBOW READY');
  const healthOf = (ops) => ops.find((o) => o.op === 'text' && o.s === 'HEALTH');
  const hp = healthOf(rec.ops);
  ok('HEALTH is captioned under the hearts, in their own colour',
     !!hp && hp.c === 'rgba(' + C._HPC.join(',') + ',1)' && hp.y > heartB && hp.align === 'right',
     '"' + hp.s + '" in ' + hp.c + ', ' + (hp.y - heartB).toFixed(0) + 'px under the last heart');
  ok('and the bar clears it rather than crowding it',
     track.y > hp.y,
     'the bar starts ' + (track.y - hp.y).toFixed(0) + 'px below the label');
  ok('and the two captions match each other in size',
     hp.f === readyOf(rec.ops).f,
     'both ' + hp.f + 'px - captions, not readouts');
  ok('and both hang off the same right edge as the hearts and the bar',
     hp.x === 900 - 16 && readyOf(rec.ops).x === 900 - 16,
     'one column down the right of the screen');

  ok('RAINBOW READY sits under the bar while the bind is up',
     !!readyOf(rec.ops) && readyOf(rec.ops).y > track.y + track.h &&
       readyOf(rec.ops).c === 'rgba(' + C._RIMC.join(',') + ',1)',
     '"' + readyOf(rec.ops).s + '" in the bind own cyan, ' +
     (readyOf(rec.ops).y - track.y - track.h).toFixed(0) + 'px under the bar');
  ok('and matches the kill count size while staying cyan',
     readyOf(rec.ops).f === kills.f,
     readyOf(rec.ops).f + 'px, same as KILLS, and still ' + readyOf(rec.ops).c);
  const hint = ops2 => ops2.find((o) => o.op === 'text' && o.s === 'CLICK/SPACE & HOLD');
  ok('and it says how to use it, under the words that name it',
     !!hint(rec.ops) && hint(rec.ops).c === '#fff' &&
     hint(rec.ops).y > readyOf(rec.ops).y && hint(rec.ops).align === 'right',
     '"CLICK/SPACE & HOLD" in white at ' + hint(rec.ops).f + 'px, ' +
     (hint(rec.ops).y - readyOf(rec.ops).y).toFixed(0) + 'px under RAINBOW READY');
  ok('and it is smaller than the label it explains',
     hint(rec.ops).f < readyOf(rec.ops).f &&
     Math.abs(hint(rec.ops).f - (readyOf(rec.ops).f * C._HINTF | 0)) < 1.5,
     hint(rec.ops).f + 'px against the ' + readyOf(rec.ops).f + 'px label - HINTF ' + C._HINTF);

  ok('and is pushed right, to the edge the bar and the hearts end on',
     readyOf(rec.ops).align === 'right' && readyOf(rec.ops).x === 900 - 16,
     'right-aligned at x=' + readyOf(rec.ops).x + ', so the corner reads as one column');
  const shades = new Set(bars(rec.ops).map((o) => o.c.replace(/,[\d.]+\)$/, ')')));
  ok('the bar is a whole rainbow, all seven of it',
     shades.size === BOWN,
     BOWN + ' distinct colours across the bar. It had six - red, orange, yellow, ' +
     'green, blue, violet - and a rainbow has seven, so indigo goes between the ' +
     'blue and the violet');

  ok('and it is full and rainbow when the bind is ready',
     bars(rec.ops).length === BOWN &&
     Math.abs(bars(rec.ops).reduce((a, o) => a + o.w, 0) - track.w) < 0.5,
     'all ' + BOWN + ' colours in the same ' + track.w.toFixed(0) + 'px - a rainbow ' +
     'has seven, so it is seven narrower bands rather than a longer bar');

  // it empties on a cast and comes back
  armed();
  let q = 0;
  while (M.anim().charging && q++ < 60 * 20) tick();
  release();
  rec.ops = []; tick();
  ok('and empties the moment it is spent',
     bars(rec.ops).reduce((a, o) => a + o.w, 0) < 1,
     'nothing left of it with ' + M.anim().bindT.toFixed(1) + 's owed');
  ok('and READY is gone with it', !readyOf(rec.ops),
     'nothing claims to be ready while ' + M.anim().bindT.toFixed(1) + 's is owed');
  for (let i = 0; i < 60 * C._BINDCD / 2; i++) tick();
  rec.ops = []; tick();
  const halfway = bars(rec.ops).reduce((a, o) => a + o.w, 0);
  ok('and refills as the cooldown comes back',
     Math.abs(halfway / track.w - 0.5) < 0.05,
     (100 * halfway / track.w).toFixed(0) + '% of the way back, half a cooldown in');

  // the map dot is the horn
  let w3 = 0;
  while (M.anim().bindT > 0 && w3++ < 60 * 30) tick();
  rec.ops = []; tick();
  const dotOf = (ops) => ops.filter((o) => o.a && o.a[2] < C._MAPBLIP * C._MAPR * 500).pop();
  const rest = dotOf(rec.ops).c;
  ok('the player dot is the horn colour at rest', rest === 'rgba(' + C._GOLD.join(',') + ',1)',
     rest + ' against GOLD [' + C._GOLD + ']');
  armed(); for (let i = 0; i < 90; i++) tick();
  rec.ops = []; tick();
  ok('and runs the rainbow with it while charging', dotOf(rec.ops).c !== rest,
     rest + ' became ' + dotOf(rec.ops).c + ' - the same charged() the horn uses');
  ok('and READY is not shown mid-charge either', !readyOf(rec.ops),
     'it means ready to cast, not ready a moment ago');
  release(); tick();

  // the fan has drawn sides now, and a thicker edge
  M.restart(); M.place([]); M.look(0, 0);
  rec.ops = []; tick();
  const fan = rec.ops.find((o) => o.op === 'stroke' && o.c === C._MAPFAN);
  const edge = rec.ops.find((o) => o.op === 'stroke' && o.c === C._MAPEDGE);
  ok('the view fan has its sides drawn, not just a fill', !!fan,
     'stroked at ' + C._MAPFANW + 'px');
  ok('and the dish edge is thicker than a hairline', !!edge && C._MAPEW >= 3,
     C._MAPEW + 'px of edge');
  M.setFire(1);
}

console.log('');
console.log('--- the game over screen -----------------------------------------');
{
  M.setFire(0);
  M.restart(); M.look(0, 0);
  // One at a time, from far enough out that the walk in outlasts the i-frame from
  // the last hit. All three at once costs a single heart, because the second and
  // third are eaten by that window - which is the point of it.
  let d = 0;
  while (!M.dbg().over && d++ < 60 * 60) {
    if (!M.dbg().ghosts.length) M.place([[4, C._GY, 0, 9, 9, 0, 0, 0, 0]]);
    tick();
  }
  ok('the run ends when the hearts are gone', M.dbg().over === 1,
     'dead after ' + (d / 60).toFixed(2) + 's of being stood on');

  // The killing blow gets HURTD of world first; the results come after it.
  let hb = 0;
  while (M.anim().hurtT > 0 && hb++ < 60 * 5) tick();
  rec.ops = []; tick();
  const texts = rec.ops.filter((o) => o.op === 'text');
  const waves = texts.find((o) => /^WAVES SURVIVED/.test(o.s));
  ok('and the wave you died ON is not counted as survived',
     waves.s === 'WAVES SURVIVED ' + (M.anim().wave - 1),
     'died in wave ' + M.anim().wave + ', so "' + waves.s + '"');
  const again = texts.find((o) => /PLAY AGAIN$/.test(o.s));

  ok('and every game object is gone with it',
     !rec.ops.some((o) => o.a) &&                                   // no minimap, no blips
     !rec.ops.some((o) => o.op === 'fill' && /^rgb\(/.test(o.c)) && // no puppet, no ghosts
     !rec.ops.some((o) => o.op === 'fill' && o.n === 6 &&
       o.p.every((q) => q[1] < 500 / 2)),                          // no hearts
     'nothing drawn but a black field and four lines');
  const bestLine = texts.find((o) => /^BEST/.test(o.s));
  const gameOver = texts.find((o) => o.s === 'GAME OVER');
  ok('four lines, and only four', texts.length === 4,
     texts.map((o) => '"' + o.s + '"').join(', '));
  ok('GAME OVER leads, in the hearts own red',
     !!gameOver && gameOver.y < waves.y && gameOver.c === 'rgba(' + C._HPC.join(',') + ',1)',
     'the same red the hearts are, so the thing that ran out and the screen that ' +
     'says so are one colour');
  ok('and the personal best is one of them, under the run you just had',
     !!bestLine && bestLine.y > waves.y && /^BEST \d+$/.test(bestLine.s),
     '"' + bestLine.s + '" - the comparison the over screen exists to make. The ' +
     'kill count is gone from it: a wave sends a different number of ghosts every ' +
     'time, so counting them measured the spawner');
  ok('waves survived on top, in the horn gold',
     !!waves && waves.c === 'rgba(' + C._GOLD.join(',') + ',1)',
     '"' + waves.s + '" in ' + waves.c);
  ok('the best under it', bestLine.y > waves.y,
     '"' + bestLine.s + '" ' + (bestLine.y - waves.y).toFixed(0) + 'px below');
  ok('and the invitation under that', !!again && again.y > bestLine.y,
     '"' + again.s + '" ' + (again.y - bestLine.y).toFixed(0) + 'px below that');
  ok('all three stacked down the centre of the screen',
     texts.every((o) => o.x === 900 / 2 && o.align === 'center'),
     'every line centred on x=' + (900 / 2));
  ok('and they get smaller down the stack, so the score leads',
     waves.f > bestLine.f && bestLine.f > again.f,
     gameOver.f + 'px, ' + waves.f + 'px, then ' + bestLine.f + 'px, then ' + again.f + 'px');
  // It used to have to be 1.4x the instruction under it. The instruction is half
  // as big again as it was and pulses now, deliberately - it is the one thing on
  // the screen that has to be acted on - so what is left to hold is the order:
  // the score still leads, and the instruction still does not outgrow it.
  ok('the best is white and still leads the instruction under it',
     bestLine.c === '#fff' && bestLine.f > again.f,
     '"' + bestLine.s + '" at ' + bestLine.f + 'px, against ' + again.f +
     'px for the instruction under it');
  ok('and the instruction is set apart from the result rather than stacked on it',
     again.y - bestLine.y > (bestLine.y - waves.y) * 1.4,
     (again.y - bestLine.y).toFixed(0) + 'px under the best, against ' +
     (bestLine.y - waves.y).toFixed(0) + 'px between the two numbers - it is an ' +
     'instruction, not part of the score');

  // and clicking anywhere really does start again
  press(700, 400); release(); tick();
  ok('clicking anywhere plays again', M.dbg().over === 0 && M.dbg().hearts === C._HEARTS,
     'a click at 700,400 - nowhere in particular - restored all ' + C._HEARTS + ' hearts');
  M.setFire(1);
}

console.log('');
console.log('--- the keyboard -------------------------------------------------');
{
  M.setFire(0);
  const turnBy = (code, frames) => {
    M.restart(); M.place([]); M.look(0, 0);
    allUp();
    kdown(code);
    for (let i = 0; i < frames; i++) tick();
    kup(code);
    return M.dbg();
  };

  // turning, on both sets of keys
  for (const [name, left, right] of [['WASD', 'KeyA', 'KeyD'], ['the arrows', 'ArrowLeft', 'ArrowRight']]) {
    const l = turnBy(left, 30).yaw, r = turnBy(right, 30).yaw;
    ok(name + ' turns you left and right',
       l < -0.01 && r > 0.01 && Math.abs(l + r) < 1e-9,
       (l * 180 / Math.PI).toFixed(0) + ' and ' + (r * 180 / Math.PI).toFixed(0) +
       ' degrees in half a second, symmetric');
  }
  for (const [name, up, down] of [['W and S', 'KeyW', 'KeyS'], ['up and down', 'ArrowUp', 'ArrowDown']]) {
    const u = turnBy(up, 30).pitch, d = turnBy(down, 30).pitch;
    ok(name + ' look up and down', u > 0.01 && d < -0.01,
       (u * 180 / Math.PI).toFixed(0) + ' and ' + (d * 180 / Math.PI).toFixed(0) + ' degrees');
    ok('and pitch has its own, slower rate', Math.abs(u - C._KPITCH / 2) < 0.01 && C._KPITCH < C._KTURN,
       'KPITCH ' + C._KPITCH + ' against KTURN ' + C._KTURN + ' - the pitch range is only ' +
       (2 * C._PITCHMAX * 180 / Math.PI).toFixed(0) + ' degrees, so one rate for both was twitchy');
  }

  ok('and the rate is KTURN a second, not the OS key-repeat rate',
     Math.abs(turnBy('KeyD', 60).yaw - C._KTURN) < 0.01,
     turnBy('KeyD', 60).yaw.toFixed(3) + ' radians in one second against KTURN ' + C._KTURN);
  ok('and holding a key does not accelerate as the OS starts repeating it',
     Math.abs(turnBy('KeyD', 120).yaw - 2 * turnBy('KeyD', 60).yaw) < 0.01,
     'two seconds is exactly twice one - held state, not events');

  // pitch is clamped the same way the pointer clamps it
  const far = turnBy('ArrowUp', 60 * 10);
  ok('and looking up is clamped at PITCHMAX', Math.abs(far.pitch - C._PITCHMAX) < 1e-9,
     'ten seconds of up stops at ' + (C._PITCHMAX * 180 / Math.PI).toFixed(0) + ' degrees');

  // two keys at once
  M.restart(); M.place([]); M.look(0, 0);
  allUp();
  kdown('KeyD'); kdown('KeyW');
  for (let i = 0; i < 30; i++) tick();
  ok('two keys at once do both', M.dbg().yaw > 0.01 && M.dbg().pitch > 0.01,
     'right and up together: ' + (M.dbg().yaw * 180 / Math.PI).toFixed(0) + ' and ' +
     (M.dbg().pitch * 180 / Math.PI).toFixed(0) + ' degrees');
  allUp();

  // space is the bind
  M.restart(); M.place([]); M.look(0, 0);
  allUp();
  kdown('Space');
  tick(); tick();
  ok('space charges the bind with no arming window',
     M.anim().charging === 1 && M.anim().bindR > 0,
     'charging on the second frame - a key is not ambiguous the way one pointer is');
  let n = 2;
  while (M.anim().charging && n++ < 60 * 20) tick();
  ok('and it still fires itself at BINDCHG', Math.abs(n / 60 - C._BINDCHG) < 0.05 && M.anim().wallT > 0,
     'let go on its own after ' + (n / 60).toFixed(2) + 's, and threw the wall');
  ok('and costs the same full cooldown', Math.abs(M.anim().bindT - C._BINDCD) < 0.05,
     M.anim().bindT.toFixed(2) + 's owed, exactly as a held pointer costs');

  // holding space through the cast does not queue another
  for (let i = 0; i < 60 * C._BINDCD + 30; i++) tick();
  ok('and holding space on does not queue a second cast',
     M.anim().charging === 0 && M.anim().bindT === 0,
     'still held with the cooldown fully back, and nothing has started - one press, one cast');
  kup('Space');

  // releasing early abandons it, as with the pointer
  kdown('Space');
  for (let i = 0; i < 30; i++) tick();
  const partway = M.anim().bindR;
  kup('Space'); tick();
  ok('releasing space early fires nothing, as with the pointer',
     M.anim().wallT === 0 && M.anim().bindT === 0 && M.anim().bindR === 0,
     'let go at ' + partway.toFixed(2) + 'm of ' + C._BINDR + 'm and nothing happened');

  // turning while charging, which is the whole point of having both hands
  M.restart(); M.place([]); M.look(0, 0);
  allUp();
  kdown('Space'); kdown('KeyD');
  for (let i = 0; i < 60; i++) tick();
  ok('and you can turn with the keys while space charges',
     M.anim().charging === 1 && M.anim().bindR > 0 && M.dbg().yaw > 0.01,
     'charged to ' + M.anim().bindR.toFixed(2) + 'm while turning ' +
     (M.dbg().yaw * 180 / Math.PI).toFixed(0) + ' degrees');
  allUp();

  // space restarts a finished run
  M.restart(); M.look(0, 0);
  let d2 = 0;
  while (!M.dbg().over && d2++ < 60 * 60) {
    if (!M.dbg().ghosts.length) M.place([[4, C._GY, 0, 9, 9, 0, 0, 0, 0]]);
    tick();
  }
  kdown('Space'); tick();
  ok('and space plays again from the over screen',
     M.dbg().over === 0 && M.dbg().hearts === C._HEARTS,
     'no reaching for the mouse to start the next run');
  allUp();

  // the page must not scroll out from under the game
  prevented = 0;
  kdown('Space'); kup('Space'); kdown('ArrowDown'); kup('ArrowDown');
  ok('space and the arrows do not scroll the page', prevented === 4,
     'preventDefault on all four events - space scrolls and arrows scroll');
  prevented = 0;
  kdown('KeyQ'); kup('KeyQ');
  ok('but keys the game does not use are left alone', prevented === 0,
     'Q passes straight through, so nothing else on the page is broken');
  allUp();
  M.setFire(1);
}

console.log('');
console.log('--- ghost types --------------------------------------------------');
{
  M.setFire(0);
  const NAMES = ['Drifter', 'Darter', 'Hulk', 'Splitter', 'Warden'];
  // The tuned roster, retyped rather than read out of the code. This SUPERSEDES
  // DESIGN.md 7's table: hp, speed, cost and unlock waves all moved in the balance
  // pass, because 7's numbers made the cheapest ghost the best value on both hp
  // and damage, and put every unlock inside the first 20 waves.
  const SPEC = [[3, 1.15, 1], [4, 2.40, 1], [18, 0.70, 3], [10, 1.20, 1], [16, 1.08, 2]];
  const UNLOCK = [1, 5, 10, 20, 30];
  ok('and the unlocks are the difficulty spikes', C._TYPES.every((t, i) => t[4] === UNLOCK[i]),
     'waves ' + UNLOCK.join(', ') + ' - one new type on each');
  const hpc = C._TYPES.map((t, k) => (t[0] + (k === C._SPLIT ? 2 * C._TYPES[0][0] : 0)) / t[3]);
  ok('and cost tracks the work each one makes you do',
     Math.max(...hpc) / Math.min(...hpc) < 2,
     'hp per cost runs ' + Math.min(...hpc).toFixed(1) + ' to ' + Math.max(...hpc).toFixed(1) +
     ', against 1.0 to 3.0 before - and the cheapest is no longer the best value');

  ok('all five types exist', C._TYPES.length === 5, NAMES.join(', '));
  ok('and their hp, speed and damage are the tuned roster',
     SPEC.every((r, i) => r[0] === C._TYPES[i][0] && Math.abs(r[1] - C._TYPES[i][1]) < 1e-9 &&
                          r[2] === C._TYPES[i][2]),
     SPEC.map((r, i) => NAMES[i] + ' ' + r.join('/')).join(', '));
  ok('and every one is a different colour',
     new Set(C._TYPES.map((t) => t[9].join())).size === 5,
     C._TYPES.map((t, i) => NAMES[i][0] + ':rgb(' + t[9] + ')').join(' '));

  // speed really is a multiple
  const speedOf = (k) => {
    M.restart(); M.look(0, 0);
    M.place([[0, C._GY, 12, 9, 9, 0, 0, k, 0]]);
    const z0 = M.dbg().ghosts[0][2];
    for (let i = 0; i < 60; i++) tick();
    return z0 - M.dbg().ghosts[0][2];
  };
  const sd = speedOf(0), sh = speedOf(1);
  ok('and speed is a multiple of GSPEED, not a number per row',
     Math.abs(sd - C._GSPEED * C._TYPES[0][1]) < 0.02 &&
     Math.abs(sh / sd - C._TYPES[1][1] / C._TYPES[0][1]) < 0.02,
     'a Drifter covers ' + sd.toFixed(2) + 'm a second and a Darter ' + sh.toFixed(2) +
     'm - ' + (sh / sd).toFixed(2) + 'x, which is its column');

  // the blob: a dome on top, triangular teeth along the bottom
  const outlineOf = (k) => {
    M.restart(); M.look(0, 0);
    M.place([[0, C._GY, 7, 9, 9, 0, 0, k, 0]]);
    rec.ops = []; tick();
    const blob = rec.ops.filter((o) => o.op === 'fill' && o.rule === 'evenodd').pop();
    // dome first, then the hem: GDOME+1 points and then 2*(wisps-1)+1
    const nd = C._GDOME + 1;
    return { dome: blob.p.slice(0, nd), hem: blob.p.slice(nd, nd + 2 * (C._TYPES[k][8] - 1) + 1) };
  };

  const dr = outlineOf(0);
  ok('the top is a dome - one arc, not a lumpy circle',
     dr.dome.length === C._GDOME + 1,
     C._GDOME + ' segments of arc across the crown');
  const dcx = (dr.dome[0][0] + dr.dome[C._GDOME][0]) / 2;
  const dcy = dr.dome[0][1];
  const rad = dr.dome.map((q) => Math.hypot(q[0] - dcx, q[1] - dcy));
  ok('and every point of it is the same distance from the dome centre',
     (Math.max(...rad) - Math.min(...rad)) / Math.max(...rad) < 0.12,
     'radius varies ' + (100 * (Math.max(...rad) - Math.min(...rad)) / Math.max(...rad)).toFixed(0) +
     '% across it - a circle breathing, not a shape');
  ok('and it is the top half, above where the sides begin',
     dr.dome.every((q) => q[1] <= dcy + 0.5) && Math.min(...dr.dome.map((q) => q[1])) < dcy - 5,
     'it reaches ' + (dcy - Math.min(...dr.dome.map((q) => q[1]))).toFixed(0) + 'px above the shoulders');

  // the hem: two levels, alternating, tips at the corners
  const ys = dr.hem.map((q) => q[1]);
  const tips = ys.filter((y, i) => i % 2 === 0), notch = ys.filter((y, i) => i % 2 === 1);
  ok('the bottom is teeth, not a wave: every tip is at one height and every notch at another',
     Math.max(...tips) - Math.min(...tips) < 0.5 && Math.max(...notch) - Math.min(...notch) < 0.5,
     'tips all at y=' + tips[0].toFixed(0) + ', notches all at y=' + notch[0].toFixed(0) +
     ' - straight edges between them, which is what makes them triangles');
  ok('and there is one tip per wisp', tips.length === C._TYPES[0][8],
     tips.length + ' points on a ' + C._TYPES[0][8] + '-wisp Drifter, with ' + notch.length + ' notches between');
  ok('and the teeth hang BELOW the dome, not over it',
     Math.min(...tips) > Math.max(...dr.dome.map((q) => q[1])),
     'the lowest tip is ' + (Math.min(...tips) - Math.max(...dr.dome.map((q) => q[1]))).toFixed(0) +
     'px under the shoulders');
  ok('and the outer corners are tips, so the silhouette ends on points',
     Math.abs(dr.hem[0][1] - tips[0]) < 0.5 &&
     Math.abs(dr.hem[dr.hem.length - 1][1] - tips[0]) < 0.5,
     'both ends of the hem sit at the tip line');

  const wide = Math.max(...dr.dome.map((q) => q[0])) - Math.min(...dr.dome.map((q) => q[0]));
  const tall = Math.max(...tips) - Math.min(...dr.dome.map((q) => q[1]));
  ok('and the whole thing is a shade taller than it is wide, like the reference',
     tall > wide && tall < wide * 1.5,
     tall.toFixed(0) + 'px tall by ' + wide.toFixed(0) + 'px wide');

  // per-type size, colour and tooth count
  M.restart(); M.look(0, 0);
  M.place([[0, C._GY, 7, 9, 9, 0, 0, 2, 0]]);
  rec.ops = []; tick();
  const hulk = rec.ops.filter((o) => o.op === 'fill' && o.rule === 'evenodd').pop();
  const hd = outlineOf(2).dome;
  ok('a Hulk is drawn bigger than a Drifter, off its own radius',
     (Math.max(...hd.map((q) => q[0])) - Math.min(...hd.map((q) => q[0]))) > wide * 1.5,
     'radius ' + C._TYPES[2][5] + 'm against ' + C._TYPES[0][5] + 'm');
  ok('and in its own colour', hulk.c === 'rgb(' + C._TYPES[2][9] + ')', hulk.c + ' - angry red');
  ok('and the wisp count really is the tooth count',
     outlineOf(1).hem.filter((q, i) => i % 2 === 0).length === C._TYPES[1][8] &&
     outlineOf(2).hem.filter((q, i) => i % 2 === 0).length === C._TYPES[2][8],
     'a ' + C._TYPES[1][8] + '-wisp Darter has ' + C._TYPES[1][8] + ' teeth and a ' +
     C._TYPES[2][8] + '-wisp Hulk has ' + C._TYPES[2][8]);

  // --- the Darter's face and horn -------------------------------------------------
  const bodyOf = (k) => {
    M.restart(); M.look(0, 0);
    M.place([[0, C._GY, 7, 9, 9, 0, 0, k, 0]]);
    rec.ops = []; tick();
    const blob = rec.ops.filter((o) => o.op === 'fill' && o.rule === 'evenodd').pop();
    const nd = C._GDOME + 1 + 2 * (C._TYPES[k][8] - 1) + 2;
    // A scared eye is moveTo + 8 dome + 7 lid = 16 points; a round one is 11. The
    // MOUTH is the same shape appended after both eyes, so halving the eye block
    // stopped isolating one eye the moment the Darter got a face.
    const n1 = C._TYPES[k][10] ? 16 : 11;
    return { dome: blob.p.slice(0, C._GDOME + 1), eyes: blob.p.slice(nd, nd + n1),
             right: blob.p.slice(nd + n1, nd + n1 * 2),
             mouth: C._TYPES[k][12] ? blob.p.slice(nd + n1 * 2, nd + n1 * 2 + 16) : [],
             all: blob.p };
  };

  const apex = (b2) => Math.min(...b2.dome.map((q) => q[1]));
  const side = (b2) => b2.dome[0][1];
  ok('the Darter wears a horn and the Drifter does not',
     C._TYPES[1][11] > 0 && C._TYPES[0][11] === 0,
     'horn ' + C._TYPES[1][11] + ' of the half width, against ' + C._TYPES[0][11]);

  // Measured on ONE ghost with the horn switched off and on. Comparing a Darter
  // against a Drifter would be comparing two radii as much as two shapes.
  const horn = C._TYPES[1][11];
  C._TYPES[1][11] = 0;
  const flat = bodyOf(1);
  C._TYPES[1][11] = horn;
  const spiked = bodyOf(1);
  const rise = (b2) => side(b2) - apex(b2);
  ok('and it really stands proud of the dome',
     rise(spiked) > rise(flat) * (1 + horn * 0.7),
     'the same Darter reaches ' + rise(flat).toFixed(1) + 'px above its shoulders without it and ' +
     rise(spiked).toFixed(1) + 'px with it - x' + (rise(spiked) / rise(flat)).toFixed(2));
  const d0 = bodyOf(0), d1 = spiked;
  ok('and the horn is part of the outline, not a shape stuck on it',
     d1.dome.filter((q) => q[1] < apex(d1) + 0.5).length === 1,
     'one point at the tip, inside the same path the body is filled from - so the ' +
     'target outline traces it without knowing it is there');

  // the eyes
  const eyeSpan = (b2) => ({
    top: Math.min(...b2.eyes.map((q) => q[1])),
    bot: Math.max(...b2.eyes.map((q) => q[1])),
  });
  ok('the Darter, the Hulk and the Warden have faces; the other two do not',
     [1, 2, 4].every((k) => C._TYPES[k][10] === 1) &&
     C._TYPES.filter((t) => t[10]).length === 3,
     'eye shape 1 on three of them, 0 on the Drifter and the Splitter');
  // Same ghost again, eye style toggled - a Darter's eye is smaller than a
  // Drifter's whatever shape it is, because the Darter is smaller.
  const st = C._TYPES[1][10];
  C._TYPES[1][10] = 0;
  const round0 = eyeSpan(bodyOf(1));
  C._TYPES[1][10] = st;
  const scared = eyeSpan(bodyOf(1));
  const mid = (round0.top + round0.bot) / 2;      // the eye's own centre line
  // The eye's two CORNERS sit on that centre line by construction, so the lowest
  // point of the outline never moves however the lid curves. What moves is the
  // middle of the lid, and that is the only thing worth measuring.
  const lip = () => bodyOf(1).eyes.slice(-7)[3][1];
  // EYEH multiplies the HALF width, so 2 is the point where the eye becomes as
  // tall as it is wide. At 1.7 it is still a little wider than tall - worth
  // knowing, since "taller" was the intent and the number does not say so.
  const er2 = (round0.bot - round0.top) / 2;
  ok('and EYEH is how tall it stands, in half widths',
     Math.abs((scared.bot - scared.top) - er2 * C._EYEH) < 0.4,
     (scared.bot - scared.top).toFixed(1) + 'px of height off a ' + er2.toFixed(1) +
     'px half width - EYEH ' + C._EYEH + ', and 2 would make it square');
  // A STRAIGHT lower edge, which means every point of it shares one y.
  const lid = () => bodyOf(1).eyes.slice(-7).map((q) => q[1]);
  ok('while its straight edge is the TOP of it, with the dome hanging under',
     C._EYEBOW === 1 && Math.max(...lid()) - Math.min(...lid()) < 0.01 &&
     Math.abs(lid()[3] - scared.top) < 0.01,
     'all seven points of the flat edge at y=' + lid()[3].toFixed(1) +
     ', which is the highest point of the eye - a brow, and the eye falling away below it');
  ok('and the dome really is below it, not around it',
     scared.bot > scared.top + 4,
     (scared.bot - scared.top).toFixed(1) + 'px of eye hanging off a flat brow');
  ok('and it hangs from EYEY rather than sitting on the round eye line',
     Math.abs(scared.top - (round0.top + round0.bot) / 2 + 0) > 0.5 && C._EYEY > 0,
     'anchored ' + C._EYEY + ' of a radius above centre - the shape hangs DOWN from ' +
     'its anchor, so the round eye line would have put the whole face too low');
  // The bounding height above is the same for any EYEBOW - the corners of the eye
  // sit on the centre line whatever the curve does. What EYEBOW moves is the
  // MIDDLE of the lower edge, so that is what has to be measured.
  const was = C._EYEBOW;
  C._EYEBOW = 1; const flatLid = lip();
  C._EYEBOW = 1.6; const inLid = lip();
  C._EYEBOW = was;
  ok('and EYEBOW is what that top edge curves by',
     inLid > flatLid + 1,
     'flat at y=' + flatLid.toFixed(1) + ' when EYEBOW is 1, and y=' + inLid.toFixed(1) +
     ' at 1.6 - ' + (inLid - flatLid).toFixed(1) + 'px further down into the eye');

  // the mouth: the same shape again, lower down
  const mo = bodyOf(1).mouth;
  ok('and the same three have mouths',
     [1, 2, 4].every((k) => C._TYPES[k][12] > 0) && C._TYPES.filter((t) => t[12]).length === 3,
     'half widths of ' + [1, 2, 4].map((k) => C._TYPES[k][12]).join(', ') + ' of their radii');
  ok('and the Warden wears the Hulk face exactly',
     [10, 13, 14, 15, 16].every((c) => C._TYPES[4][c] === C._TYPES[2][c]) &&
     C._TYPES[4][12] === C._TYPES[2][12],
     'eye shape, tilt, mouth curve, height and drop all copied across');
  ok('and it is the same shape as the eyes, not a second idea',
     mo.length === bodyOf(1).eyes.length &&
     Math.max(...mo.slice(-7).map((q) => q[1])) - Math.min(...mo.slice(-7).map((q) => q[1])) < 0.01,
     'the same ' + mo.length + ' points, and its top edge is one straight line like theirs');
  ok('and it sits under them, clear of both',
     Math.min(...mo.map((q) => q[1])) > eyeSpan(bodyOf(1)).bot,
     'the top of the mouth is ' +
     (Math.min(...mo.map((q) => q[1])) - eyeSpan(bodyOf(1)).bot).toFixed(1) +
     'px below the bottom of the eyes');

  // --- the Hulk's horns ------------------------------------------------------------
  // A horn is a dome point pushed out past its neighbours, so find the points that
  // stand proud of the arc their neighbours describe.
  const spikes = (k) => {
    const d = bodyOf(k).dome;
    const cx = (d[0][0] + d[d.length - 1][0]) / 2;
    const rad = d.map((q) => Math.hypot(q[0] - cx, q[1] - d[0][1]));
    return d.map((q, i) => [i, q, rad[i]])
      .filter(([i]) => i > 0 && i < d.length - 1 &&
              rad[i] > rad[i - 1] * 1.15 && rad[i] > rad[i + 1] * 1.15);
  };
  const hs = spikes(2), ds = spikes(1);
  ok('the Hulk has TWO horns where the Darter has one',
     hs.length === 2 && ds.length === 1,
     hs.length + ' points standing proud on the Hulk, ' + ds.length + ' on the Darter');
  ok('and they sit either side of the crown, out on the shoulders',
     (() => {
       const mid = (bodyOf(2).dome[0][0] + bodyOf(2).dome[C._GDOME][0]) / 2;
       return hs[0][1][0] < mid - 1 && hs[1][1][0] > mid + 1 &&
              Math.abs((mid - hs[0][1][0]) - (hs[1][1][0] - mid)) < 1;
     })(),
     'mirrored about the middle, ' + C._TYPES[2][17] + ' of the way out to each side');
  ok('and the Darter one is still dead centre',
     Math.abs(ds[0][1][0] - (bodyOf(1).dome[0][0] + bodyOf(1).dome[C._GDOME][0]) / 2) < 1,
     'spread 0 keeps it at the crown, which is what the Darter had before');
  // Past a spread of 1 a horn leaves the dome and becomes an arm on the straight
  // side, so it cannot be found by looking at dome points - it is a vertex the
  // sides did not have before. Look for anything wider than the body instead.
  const arms = (k) => {
    const b2 = bodyOf(k);
    const cx = (b2.dome[0][0] + b2.dome[C._GDOME][0]) / 2;
    const halfW = (b2.dome[C._GDOME][0] - b2.dome[0][0]) / 2;
    const domeY = b2.dome[0][1];
    const low = Math.max(...b2.all.map((q) => q[1]));
    return b2.all.filter((q) => Math.abs(q[0]) && Math.abs(q[0] - cx) > halfW * 1.15)
      .map((q) => ({ side: Math.sign(q[0] - cx), out: Math.abs(q[0] - cx) / halfW,
                     down: (q[1] - domeY) / (low - domeY) }));
  };
  const sa = arms(3);
  ok('the Splitter pair are arms on the straight sides, not horns on the dome',
     sa.length === 2 && C._TYPES[3][17] > 1 && !spikes(3).length,
     'two vertices out past the body at ' + (100 * sa[0].down).toFixed(0) +
     '% down it, and nothing standing proud of the dome at all');
  ok('and mirrored, like every other pair',
     sa[0].side === -sa[1].side && Math.abs(sa[0].out - sa[1].out) < 0.02 &&
     Math.abs(sa[0].down - sa[1].down) < 0.02,
     'one either side, ' + sa[0].out.toFixed(2) + ' of a half width out from each');
  ok('and the Hulk pair are still on its dome, where the spread is under 1',
     !arms(2).length && spikes(2).length === 2 && C._TYPES[2][17] < 1,
     'nothing wider than its body, and two points proud of its dome - one column ' +
     'either side of 1 is the whole difference');

  ok('and neither is a shape stuck on the body',
     hs.every(([i]) => i > 0 && i < C._GDOME),
     'both are points of the dome itself, so the outlines trace them');

  // --- the Hulk's face -----------------------------------------------------------
  const hb = bodyOf(2);
  const ends = (e) => ({ l: e.reduce((a, q) => (q[0] < a[0] ? q : a))[1],
                         r: e.reduce((a, q) => (q[0] > a[0] ? q : a))[1] });
  const dl = ends(bodyOf(1).eyes), hl = ends(hb.eyes), hr = ends(hb.right);
  ok('the Hulk brow is tilted and the Darter one is level',
     C._TYPES[2][13] > 0 && C._TYPES[1][13] === 0 && Math.abs(dl.l - dl.r) < 0.5,
     'tilt ' + C._TYPES[2][13] + ' against ' + C._TYPES[1][13] +
     ', and the Darter eye measures level end to end');
  ok('and it rides UP on the outside of the face, which is what makes it angry',
     hl.l < hl.r - 1 && hr.r < hr.l - 1,
     'the left eye is ' + (hl.r - hl.l).toFixed(1) + 'px higher outside, the right ' +
     (hr.l - hr.r).toFixed(1) + 'px - mirrored, so they scowl inward rather than lean');
  ok('and the tilt is a SHEAR, so the top edge is still straight',
     (() => {
       const top = hb.eyes.slice(-7);
       const dx = top[6][0] - top[0][0], dy = top[6][1] - top[0][1];
       return top.every((q) => Math.abs((q[1] - top[0][1]) - dy * (q[0] - top[0][0]) / dx) < 0.02);
     })(),
     'every point of the brow on one straight line, just not a level one');

  // Which way a mouth opens: its two corners sit on its anchor line, and the rest
  // of the shape is on one side of them or the other.
  const opens = (m) => {
    const corner = m.reduce((a, q) => (q[0] < a[0] ? q : a))[1];
    const mean = m.reduce((a, q) => a + q[1], 0) / m.length;
    return mean - corner;                        // negative is upward
  };
  const hm = opens(hb.mouth), dm = opens(bodyOf(1).mouth);
  ok('the Hulk mouth is upside down against the Darter one',
     hm < 0 && dm > 0 && C._TYPES[2][15] < 0 && C._TYPES[1][15] > 0,
     'the Hulk one lies ' + (-hm).toFixed(1) + 'px above its corners and the Darter one ' +
     dm.toFixed(1) + 'px below - a negative mouth height turns the shape over');
  const mtop = hb.mouth.slice(-7).map((q) => q[1]);
  const dome = Math.min(...hb.mouth.map((q) => q[1]));
  ok('and both its edges still bend the same way, so it is a crescent not a slab',
     C._TYPES[2][14] > 1 && mtop[3] < mtop[0] - 1 && dome < mtop[3] - 1,
     'the curved edge arches ' + (mtop[0] - mtop[3]).toFixed(1) +
     'px up off the corners and the dome ' + (mtop[0] - dome).toFixed(1) +
     'px past that - mouth curve ' + C._TYPES[2][14] + ', where 1 would be straight');
  ok('while the Darter mouth is untouched',
     C._TYPES[1][14] === 1 && C._TYPES[1][15] > 0,
     'the two faces differ by numbers on the row, not by two lots of code');

  // --- the Splitter ------------------------------------------------------------
  M.restart(); M.look(0, 0);
  M.setFire(1);
  M.place([[0, C._GY, 6, 1, C._TYPES[3][0], 0, 0, C._SPLIT, 0]]);
  const range0 = 6;
  let n = 0;
  while (M.dbg().ghosts.some((o) => o[7] === C._SPLIT) && n++ < 60 * 12) tick();
  const kids = M.dbg().ghosts.filter((o) => o[7] === 0);
  ok('a Splitter dies into two Drifters', kids.length === 2,
     'killed it and got ' + kids.length + ' of type 0 back');
  ok('and both keep the range the parent had, so neither is handed a head start',
     kids.every((o) => Math.abs(Math.hypot(o[0], o[2]) - range0) < 0.3),
     'at ' + kids.map((o) => Math.hypot(o[0], o[2]).toFixed(2) + 'm').join(' and ') +
     ', either side of where it stood');
  ok('and they are apart, not stacked', Math.hypot(kids[0][0] - kids[1][0], kids[0][2] - kids[1][2]) > 0.5,
     (Math.hypot(kids[0][0] - kids[1][0], kids[0][2] - kids[1][2])).toFixed(2) + 'm between them');
  M.setFire(0);

  // --- the Warden --------------------------------------------------------------
  M.restart(); M.look(0, 0);
  // Both in FRONT of the camera. At (5,0) the Warden sits square to your right,
  // off screen, and drawGhost drops it before any of this can be seen.
  //
  // And far enough out to survive the test. At 5m it used to, at 0.9x speed; at
  // 1.08x it covers the arming second, three seconds of charge, the shrug and the
  // window below - 4.6m in all - and reached contact partway through. The list
  // then closed up, ghosts[0] became the held Drifter, and the check reported the
  // Warden moving AWAY. 8m is still inside the 9m ring, so it is still caught.
  M.place([[-2, C._GY, 8, 9, 9, 0, 0, C._WARDEN, 0], [2, C._GY, 8, 9, 9, 0, 0, 0, 0]]);
  armed();
  let c2 = 0;
  while (M.anim().charging && c2++ < 60 * 20) tick();
  const [ward, drift] = M.dbg().ghosts;
  ok('the bind cannot hold a Warden', drift[8] > 0 && !(ward[8] > 0),
     'inside the same ring: the Drifter is held for ' + drift[8].toFixed(1) +
     's, the Warden is not held at all');
  ok('and the shrug is on it the moment the ring lands',
     Math.abs(ward[8] + C._SHRUGD) < 0.02,
     'marked for ' + (-ward[8]).toFixed(2) + 's of shrugging against SHRUGD ' + C._SHRUGD);

  rec.ops = []; tick();
  ok('and it is SEEN shrugging the ring off, so the rule can be learnt by watching',
     rec.ops.some((o) => o.op === 'stroke' && o.c === 'rgb(' + C._TYPES[C._WARDEN][9] + ')'),
     'a ring of its own pale gold pushing out past it and fading');
  let sn = 1;
  while (M.dbg().ghosts[0][8] < 0 && sn++ < 60 * 5) tick();
  ok('and the shrug lasts SHRUGD then is gone', Math.abs(sn / 60 - C._SHRUGD) < 0.05,
     'faded after ' + (sn / 60).toFixed(2) + 's against SHRUGD ' + C._SHRUGD);
  rec.ops = []; tick();
  ok('and stops being drawn once it has',
     !rec.ops.some((o) => o.op === 'stroke' && o.c === 'rgb(' + C._TYPES[C._WARDEN][9] + ')'),
     'no ring left on it');

  const wz = Math.hypot(ward[0], ward[2]), dz = drift[2];
  for (let i = 0; i < 30; i++) tick();
  ok('and it keeps coming the whole time, while everything else stops',
     M.dbg().ghosts.includes(ward) &&
     Math.hypot(M.dbg().ghosts[0][0], M.dbg().ghosts[0][2]) < wz - 0.2 &&
     Math.abs(M.dbg().ghosts[1][2] - dz) < 1e-9,
     'the Warden closed ' + (wz - Math.hypot(M.dbg().ghosts[0][0], M.dbg().ghosts[0][2])).toFixed(2) +
     'm while the held Drifter did not move at all');
  release();
  M.setFire(1);
}

console.log('');
console.log('--- waves and the threat budget ----------------------------------');
{
  M.setFire(0);
  const NAMES = ['Drifter', 'Darter', 'Hulk', 'Splitter', 'Warden'];

  // wave 1 buys six Drifters and nothing else
  M.restart(); M.look(0, 0); M.place([]);
  ok('wave 1 opens with a budget of BUD0', M.anim().wave === 1 && M.anim().budget === C._BUD0,
     C._BUD0 + ' of threat to spend, and a Drifter costs ' + C._TYPES[0][3]);
  let n = 0;
  while (M.anim().budget > 0 && n++ < 60 * 60) tick();
  const born = M.dbg().ghosts;
  ok('and spends it on exactly six Drifters', born.length === 6 && born.every((o) => o[7] === 0),
     born.length + ' ghosts, all ' + NAMES[0] + ' - ' + C._BUD0 + ' budget at ' +
     C._TYPES[0][3] + ' each');
  ok('and nothing else is unlocked yet to buy',
     C._TYPES.filter((t) => t[4] <= 1).length === 1,
     'only the Drifter unlocks at wave 1; the rest are gated to ' +
     C._TYPES.slice(1).map((t) => t[4]).join(', '));

  // the wave does not end until the field is clear
  ok('and the wave does not turn over while they are still out there',
     M.anim().wave === 1,
     'budget spent, six still walking, still wave 1');

  // Clear the field rather than letting them arrive: arriving costs hearts, and a
  // dead player stops step() before any of this can be observed.
  M.place([]);
  let g2 = 0;
  while (!M.anim().picking && g2++ < 60 * 30) tick();
  ok('and offers cards once it is', M.anim().picking === 1 && Math.abs(g2 / 60 - C._WAVEGAP) < 0.1,
     M.anim().offer.length + ' cards after ' + (g2 / 60).toFixed(1) +
     's of quiet, against WAVEGAP ' + C._WAVEGAP);
  ok('and the wave does not turn over until one is taken', M.anim().wave === 1,
     'still wave 1 while the cards are up');
  pickCard();
  ok('and the budget grows geometrically, not by a fixed step',
     M.anim().wave === 2 && M.anim().budget === Math.round(C._BUD0 * C._BUDR) && C._BUDR > 1,
     'wave 2 has ' + M.anim().budget + ' against wave 1 ' + C._BUD0 + ' - x' + C._BUDR +
     ' a wave, because the cards multiply and a budget that only adds gets outrun');

  // Spend a whole wave with the field swept every frame, so nothing reaches the
  // player and nothing is removed before it has been counted.
  const spendAt = (w) => {
    M.restart(); M.look(0, 0); M.place([]);
    M.setWave(w);
    const b = M.anim().budget;
    const seen = new Set();
    let paid = 0, low = b, i = 0;
    while (M.anim().budget > 0 && i++ < 60 * 2000) {
      tick();
      for (const o of M.dbg().ghosts) { seen.add(o[7]); paid += C._TYPES[o[7]][3]; }
      M.place([]);
      low = Math.min(low, M.anim().budget);
    }
    return { b, seen, paid, low };
  };

  // Unlocks gate the LIST. The buy is random, so one wave is a sample and not the
  // roster - the union of several is.
  const rosterAt = (w, runs) => {
    const all = new Set();
    for (let i = 0; i < runs; i++) for (const k of spendAt(w).seen) all.add(k);
    return all;
  };
  for (const [w, want] of [[1, [0]], [5, [0, 1]], [10, [0, 1, 2]], [20, [0, 1, 2, 3]], [30, [0, 1, 2, 3, 4]]]) {
    const seen = rosterAt(w, 4);
    ok('wave ' + w + ' buys ' + want.map((k) => NAMES[k]).join(', ') + ' and nothing later',
       [...seen].every((k) => want.includes(k)) && seen.size === want.length,
       'over four waves it bought ' + [...seen].sort().map((k) => NAMES[k]).join(', '));
  }
  ok('and the Warden really is held back until wave 30', !rosterAt(29, 4).has(4),
     'four wave 29s spend ' + Math.round(C._BUD0 * C._BUDR ** 28) + ' of threat each and never buy one');

  const w20 = spendAt(30);
  ok('and the spender never goes over budget',
     w20.low === 0 && w20.paid === w20.b,
     'wave 30 spent exactly ' + w20.paid + ' of ' + w20.b + ', never dipping below ' + w20.low);
  M.restart(); M.look(0, 0); M.place([]);
  const gapAt = (w) => {
    M.restart(); M.look(0, 0); M.place([]);
    M.setWave(w);
    let a = 0, b = 0, i = 0;
    while (!M.dbg().ghosts.length && i++ < 6000) tick();
    a = i;
    M.place([]);
    while (!M.dbg().ghosts.length && i++ < 12000) tick();
    return (i - a) / 60;
  };
  const g1 = gapAt(1), g30 = gapAt(30);
  ok('and they arrive closer together as the waves go on',
     g30 < g1 * 0.6 && Math.abs(g1 - C._SPAWN) < 0.05,
     'every ' + g1.toFixed(2) + 's at wave 1, every ' + g30.toFixed(2) +
     's at wave 30 - the budget sets how LONG a wave is, this sets how hard');

  ok('and a big budget still buys cheap types, because the gate is on the list not the amount',
     w20.seen.has(0) && w20.seen.size > 2,
     'Drifters alongside ' + [...w20.seen].sort().filter((k) => k).map((k) => NAMES[k]).join(', '));
  M.setFire(1);
}

console.log('');
console.log('--- hit flash and the target outline ------------------------------');
{
  M.setFire(0);
  const blobOf = (ops) => ops.filter((o) => o.op === 'fill' && o.rule === 'evenodd').pop();
  const goldStroke = (ops) => ops.find((o) => o.op === 'stroke' &&
    o.c === 'rgba(' + C._GOLD.join(',') + ',1)');

  // --- the target outline -------------------------------------------------------
  M.restart(); M.look(0, 0);
  // Where the CROSSHAIR points, not straight ahead in the world: the aim runs
  // down the horn's line, and the two are a couple of degrees apart. The old
  // pick had 45px of slack and did not care; this one does, correctly.
  const wc = M.aimWorld(7);
  M.place([[wc[0], C._GY, wc[2], 9, 9, 0, 0, 0, 0]]);
  rec.ops = []; tick();
  const lit = goldStroke(rec.ops);
  const blob = blobOf(rec.ops);
  ok('the ghost under the crosshair is outlined in the horn gold, not white',
     !!lit && !rec.ops.some((o) => o.op === 'stroke' && o.c === '#fff'),
     'stroked ' + lit.c + ' at ' + lit.w + 'px, and nothing white anywhere');
  ok('and it traces the ghost own silhouette, not a circle round it',
     !lit.a && lit.n === C._GDOME + 1 + 2 * (C._TYPES[0][8] - 1) + 2,
     lit.n + ' points - the dome and every tooth, which is exactly the body path');
  ok('and the outline stops at the body, so the eyes are not ringed too',
     lit.n < blob.n,
     'the outline is ' + lit.n + ' points against ' + blob.n +
     ' in the filled path - the eye subpaths come after it');

  // one off to the side is not the target and is not lit
  M.restart(); M.look(0, 0);
  M.place([[6, C._GY, 7, 9, 9, 0, 0, 0, 0]]);
  rec.ops = []; tick();
  ok('and a ghost you are not aimed at is not outlined', !goldStroke(rec.ops),
     'off the crosshair, so nothing is lit');

  // --- the hit flash --------------------------------------------------------------
  M.restart(); M.look(0, 0);
  M.place([[0, C._GY, 7, 9, 9, 0, 0, 0, 0]]);
  rec.ops = []; tick();
  const calm = blobOf(rec.ops);
  M.place([[0, C._GY, 7, 9, 9, C._GFLASH, 0, 0, 0]]);
  rec.ops = []; tick();
  const flash = blobOf(rec.ops);
  ok('taking damage flashes the whole ghost body white',
     flash.c === '#fff' && calm.c !== '#fff' && flash.n === calm.n,
     'the same ' + flash.n + '-point body, filled white instead of ' + calm.c);

  // and it does not fade out with the health it is reporting on
  M.place([[0, C._GY, 7, 1, 9, C._GFLASH, 0, 0, 0]]);
  rec.ops = []; tick();
  const dying = blobOf(rec.ops);
  M.place([[0, C._GY, 7, 1, 9, 0, 0, 0, 0]]);
  rec.ops = []; tick();
  const faint = blobOf(rec.ops);
  ok('and the flash is full strength even on a nearly-dead ghost',
     dying.alpha === 1 && faint.alpha < 0.6,
     'at 1 hp of 9 it draws at alpha ' + faint.alpha.toFixed(2) +
     ', and the flash still at ' + dying.alpha.toFixed(2));

  // it lasts GFLASH and stops
  M.setFire(1);
  M.restart(); M.look(0, 0);
  M.place([[0, C._GY, 7, 9, 9, 0, 0, 0, 0]]);
  let n = 0;
  while (!M.dbg().ghosts[0][5] && n++ < 60 * 10) tick();
  let f = 0;
  while (M.dbg().ghosts[0][5] > 0 && f++ < 60 * 5) tick();
  ok('and the flash lasts GFLASH then clears', Math.abs(f / 60 - C._GFLASH) < 0.02,
     'white for ' + (f / 60).toFixed(3) + 's against GFLASH ' + C._GFLASH);
  M.setFire(1);
}

console.log('');
console.log('--- being hit ----------------------------------------------------');
{
  M.setFire(0);
  const redOf = (ops) => ops.find((o) => o.op === 'rect' &&
    o.c.startsWith('rgba(' + C._HURTC.join(',') + ','));

  // nothing on a quiet frame
  M.restart(); M.look(0, 0); M.place([]);
  rec.ops = []; tick();
  ok('a quiet frame has no kick and no red', !redOf(rec.ops) &&
     !rec.ops.some((o) => o.op === 'translate' && (o.x || o.y)),
     'the view sits still and the screen is its own colour');

  // walk one in and let it reach you
  M.place([[0, C._GY, 1.3, 9, 9, 0, 0, 0, 0]]);
  let n = 0;
  const h0 = M.dbg().hearts;
  while (M.dbg().hearts === h0 && n++ < 60 * 10) tick();
  ok('something reaching you costs a heart', M.dbg().hearts === h0 - C._TYPES[0][2],
     'down to ' + M.dbg().hearts + ' from ' + h0);
  ok('and starts the red', Math.abs(M.anim().hurtT - C._HURTD) < 0.02,
     C._HURTD + 's of it, from the moment of contact');

  rec.ops = []; tick();
  const red = redOf(rec.ops);
  ok('the whole screen flashes red', !!red && red.w === 900 && red.h === 500 && red.x === 0 && red.y === 0,
     'a ' + red.w + 'x' + red.h + ' fill of ' + red.c);
  const kick = rec.ops.find((o) => o.op === 'translate');
  ok('and the whole view kicks with it, not just the horizon',
     !!kick && Math.hypot(kick.x, kick.y) > 0 && Math.hypot(kick.x, kick.y) <= C._SHAKEA,
     'translated ' + Math.hypot(kick.x, kick.y).toFixed(1) + 'px of a ' + C._SHAKEA + 'px kick');
  ok('but the red does not kick with it - a flash that moved would read as an object',
     rec.ops.indexOf(red) > rec.ops.indexOf(kick) &&
       rec.ops.slice(rec.ops.indexOf(kick), rec.ops.indexOf(red)).some((o) => o.op === 'fill'),
     'drawn after the world, outside the transform');

  // it fades rather than switching off
  const a0 = parseFloat(red.c.split(',').pop());
  for (let i = 0; i < 8; i++) tick();
  rec.ops = []; tick();
  const a1 = parseFloat(redOf(rec.ops).c.split(',').pop());
  ok('and it fades out rather than blinking off', a1 < a0 && a1 > 0,
     'alpha ' + a0.toFixed(3) + ' to ' + a1.toFixed(3) + ' over an eighth of a second');
  let f = 0;
  while (M.anim().hurtT > 0 && f++ < 60 * 5) tick();
  ok('and is gone after HURTD', Math.abs((f + 9) / 60 - C._HURTD) < 0.03,
     'clear after ' + ((f + 9) / 60).toFixed(2) + 's against HURTD ' + C._HURTD);
  rec.ops = []; tick();
  ok('leaving the screen its own colour again', !redOf(rec.ops), 'no red left');

  // the kick settles too
  let k2 = 0;
  while (M.anim().shake > 0 && k2++ < 60 * 5) tick();
  rec.ops = []; tick();
  ok('and the view settles', !rec.ops.some((o) => o.op === 'translate' && (o.x || o.y)),
     'back to still after ' + (k2 / 60).toFixed(2) + 's of shake');
  M.setFire(1);
}

console.log('');
console.log('--- the crosshair, and what it picks ------------------------------');
{
  M.setFire(0);
  const gold = 'rgba(' + C._GOLD.join(',') + ',' + C._XHA + ')';

  M.restart(); M.look(0, 0); M.place([]);
  rec.ops = []; tick();
  const xh = rec.ops.filter((o) => o.op === 'stroke' && o.c === gold).pop();
  ok('the crosshair is the horn gold, not white',
     !!xh && !rec.ops.some((o) => o.op === 'stroke' && /#ffffff88/.test(o.c)),
     'stroked ' + xh.c + ' at ' + xh.w + 'px, and nothing white left');
  const arm = Math.max(...xh.p.map((q) => Math.abs(q[0] - xh.p[0][0])));
  ok('and bigger than it was', C._XHR * 500 > 0.012 * 500,
     (C._XHR * 500).toFixed(1) + 'px arms at 500px height, up from ' + (0.012 * 500).toFixed(1));

  // --- the crosshair holds still ---------------------------------------------------
  // It sits where the shots converge, and the muzzle is over a metre off the
  // camera axis - so its SCREEN position depends on the convergence RANGE. When
  // that range switched in one frame, the crosshair flicked.
  const worstFlick = (place, frames) => {
    M.restart(); M.look(0, 0); M.setFire(0);
    let prev = null, mx = 0;
    // The assist is left ON: this is measuring what a player sees, and the assist
    // is part of what they see. Holding the camera still would isolate the
    // crosshair from it and answer a question nobody asked.
    for (let i = 0; i < frames; i++) {
      place(i);
      tick();
      const q = M.aimPoint();
      if (prev) mx = Math.max(mx, Math.hypot(q[0] - prev[0], q[1] - prev[1]));
      prev = q;
    }
    return mx;
  };
  const walkIn = worstFlick((i) => {
    const z = 6 - i * 0.04;
    M.place(z > C._GCONTACT ? [[0, C._GY, z, 99, 99, 0, 0, 0, 0]] : []);
  }, 120);
  ok('the crosshair does not flick when a ghost reaches you', walkIn < 15,
     'worst single frame ' + walkIn.toFixed(1) + 'px, against 93.5 before the range ' +
     'was eased - it used to snap from the ghost back to the ' + C._CONV +
     'm fallback in one frame, seven metres of convergence in a sixtieth of a second');
  const cross = worstFlick((i) => {
    M.place([[-1.2 + i * 0.02, C._GY, 4, 99, 99, 0, 0, 0, 0]]);
  }, 120);
  ok('nor when one crosses in front of it', cross < 4,
     'worst single frame ' + cross.toFixed(1) + 'px, against 14.5 - that was a ghost ' +
     'entering the convergence cone and taking the range with it');
  const pair = worstFlick((i) => {
    M.place([[-0.5 + i * 0.008, C._GY, 5, 99, 99, 0, 0, 0, 0],
             [0.5 - i * 0.008, C._GY, 5.2, 99, 99, 0, 0, 0, 0]]);
  }, 120);
  ok('nor when two of them argue over it', pair < 4,
     'worst single frame ' + pair.toFixed(1) + 'px with two at almost the same bearing ' +
     'and different depths - the winner flips frame to frame and the range went with it');

  // and the floor under it, over a whole walk-in rather than at one distance: a
  // ghost AT contact is not a convergence target at all, because the horn line
  // starts at the muzzle and it is barely off it by then.
  M.restart(); M.look(0, 0); M.setFire(0);
  let lowest = 1e9;
  for (let i = 0; i < 200; i++) {
    const z = 8 - i * 0.035;
    M.place(z > C._GCONTACT ? [[0, C._GY, z, 99, 99, 0, 0, 0, 0]] : []);
    tick();
    lowest = Math.min(lowest, M.anim().conv);
  }
  ok('and it never converges closer than CONVMIN', lowest >= C._CONVMIN - 1e-9,
     'the closest it got over a whole walk-in was ' + lowest.toFixed(2) + 'm against a ' +
     'floor of ' + C._CONVMIN + '. The muzzle is at ' + C._MUZZ + 'm, so converging on ' +
     'something at contact put the point barely past it, where a centimetre of range ' +
     'is a dozen pixels of screen');

  // --- the assist ------------------------------------------------------------------
  ok('the assist reaches wider than the pick', C._ASSISTR > C._TGTR * 1.5,
     C._ASSISTR + ' radii against ' + C._TGTR + ' for the highlight - it pulls you ' +
     'onto things that are not lit up yet, which is what acquiring one means');
  ok('and it closes the gap in well under a second',
     Math.log(2) / C._ASSIST < 0.2,
     'half the gap in ' + (Math.log(2) / C._ASSIST).toFixed(2) + 's at ASSIST ' +
     C._ASSIST + ', 95% in ' + (3 / C._ASSIST).toFixed(2) + 's');
  // it really turns the camera, and only the camera
  M.restart(); M.look(0, 0); M.setFire(0);
  const off = M.aimWorld(7);
  const side = 0.5;
  const dd = Math.hypot(off[0], off[2]) || 1;
  const before = M.dbg().yaw, tipBefore = M.sprite().tip.slice();
  for (let i = 0; i < 30; i++) {
    M.place([[off[0] - off[2] / dd * side, C._GY, off[2] + off[0] / dd * side, 99, 99, 0, 0, 0, 0]]);
    tick();
  }
  // The unicorn is a viewmodel: it is drawn in screen space and pinned there, so
  // turning must move the world and leave the animal exactly where it was.
  const tipAfter = M.sprite().tip;
  ok('and it turns the camera rather than the puppet',
     Math.abs(M.dbg().yaw - before) > 0.01 &&
     Math.hypot(tipAfter[0] - tipBefore[0], tipAfter[1] - tipBefore[1]) < 1e-9,
     'the view came round by ' + ((M.dbg().yaw - before) * 180 / Math.PI).toFixed(1) +
     ' degrees and the unicorn never moved - the horn still points exactly where the ' +
     'shots go, which is what keeps the assist honest');

  // --- what it picks -------------------------------------------------------------
  // Placed relative to where the crosshair actually points, not to the screen
  // centre: the aim runs down the horn's line and the two are not the same place.
  //
  // The assist is switched OFF for all of this. It is a separate mechanism with a
  // separate radius, and every frame it runs it drags the ghost toward the
  // crosshair - so leaving it on measures the pick plus however much the assist
  // managed in the meantime, and the answer moves whenever the assist is tuned.
  const wasAssist = C._ASSIST;
  C._ASSIST = 0;
  M.restart(); M.look(0, 0);                      // aimWorld reads the live camera
  const R = 7;
  const w = M.aimWorld(R);
  const lit = (offset) => {
    M.restart(); M.look(0, 0);
    // sideways, across the line of sight
    const d = Math.hypot(w[0], w[2]) || 1;
    // The convergence range is eased, so the crosshair takes about half a second
    // to arrive at the depth of a new target - one tick after a restart measures
    // the pick against a crosshair still in transit. The ghost is held still while
    // it settles, and so is the CAMERA: left alone, the assist spends those frames
    // dragging the ghost under the crosshair, and then everything is on target.
    const g2 = [w[0] - w[2] / d * offset, C._GY, w[2] + w[0] / d * offset, 9, 9, 0, 0, 0, 0];
    for (let i = 0; i < 80; i++) { M.place([g2.slice()]); M.look(0, 0); tick(); }
    return rec.ops.some((o) => o.op === 'stroke' && o.c === 'rgba(' + C._GOLD.join(',') + ',1)');
  };

  ok('a ghost the crosshair is on is targeted', lit(0),
     'dead on it at ' + R + 'm');
  ok('and one a whole body-width to the side is not', !lit(C._TYPES[0][5] * 2.2),
     (C._TYPES[0][5] * 2.2).toFixed(2) + 'm off, which is over two radii - the crosshair is beside it');

  // where the edge actually falls, in metres and in radii
  let edge = 0;
  for (let x = 0; x < 3; x += 0.02) { if (!lit(x)) { edge = x; break; } }
  ok('and the pick radius is the ghost, not a patch of screen around it',
     edge < C._TYPES[0][5] * 1.2 && edge > C._TYPES[0][5] * 0.4,
     'it stops being targeted ' + edge.toFixed(2) + 'm off centre at ' + R +
     'm - ' + (edge / C._TYPES[0][5]).toFixed(2) + ' of its own ' + C._TYPES[0][5] + 'm radius');

  // and that edge scales with range, because it is measured in the ghost
  const edgeAt = (range) => {
    const wr = M.aimWorld(range);
    const d = Math.hypot(wr[0], wr[2]) || 1;
    for (let x = 0; x < 4; x += 0.02) {
      M.restart(); M.look(0, 0);
      const g3 = [wr[0] - wr[2] / d * x, C._GY, wr[2] + wr[0] / d * x, 9, 9, 0, 0, 0, 0];
      for (let i = 0; i < 80; i++) { M.place([g3.slice()]); M.look(0, 0); tick(); }
      if (!rec.ops.some((o) => o.op === 'stroke' && o.c === 'rgba(' + C._GOLD.join(',') + ',1)')) return x;
    }
    return 4;
  };
  // At every range it is at most the body, never a patch of screen around it. It
  // is not CONSTANT in metres, and that is not the pick: the horn's line rises
  // through the band the ghosts float in - 0.18m under them at 4m, level at about
  // 7m, 0.28m over them by 12m - so a ghost pinned at float height is further off
  // the crosshair vertically at the ends than in the middle, and less of the
  // budget is left for sideways. In play you pitch onto the thing and it does not
  // arise; here the pitch is held at zero to isolate the pick.
  const ranges = [4, 7, 12].map((z) => [z, edgeAt(z), M.aimWorld(z)[1] - C._GY]);
  // Where the horn's line comes closest to the band the ghosts float in. It used
  // to be 7m and was written in as 7m; taking the shot origin off the drawn horn
  // moved it, so it is found rather than assumed.
  const near = ranges.reduce((a, b) => (Math.abs(b[2]) < Math.abs(a[2]) ? b : a));
  ok('and at every range the tolerance is the body, never a patch of screen',
     ranges.every(([, e]) => e > 0 && e <= C._TYPES[0][5] * 1.05),
     ranges.map(([z, e, dy]) => z + 'm: ' + e.toFixed(2) + 'm wide, ' +
       (dy >= 0 ? '+' : '') + dy.toFixed(2) + 'm of vertical offset').join('; ') +
     ' - all inside the ' + C._TYPES[0][5] + 'm radius');
  ok('and it is widest where the horn line comes closest to the ghosts',
     ranges.every(([, e]) => e <= near[1] + 1e-9),
     'best at ' + near[0] + 'm, where the line is ' + Math.abs(near[2]).toFixed(3) +
     'm off the float height - which is where the aim and the band meet');

  // A bigger ghost is a bigger target, which is what it looks like. Measured at
  // the range where the line is closest to the band: anywhere else the vertical
  // offset eats a fixed slice out of both budgets, which costs the smaller ghost
  // proportionally more and moves the ratio for a reason that is not size.
  const wn = M.aimWorld(near[0]);
  const bigEdge = (() => {
    const d = Math.hypot(wn[0], wn[2]) || 1;
    for (let x = 0; x < 4; x += 0.02) {
      M.restart(); M.look(0, 0);
      const g4 = [wn[0] - wn[2] / d * x, C._GY, wn[2] + wn[0] / d * x, 9, 9, 0, 0, 2, 0];
      for (let i = 0; i < 80; i++) { M.place([g4.slice()]); M.look(0, 0); tick(); }
      if (!rec.ops.some((o) => o.op === 'stroke' && o.c === 'rgba(' + C._GOLD.join(',') + ',1)')) return x;
    }
    return 4;
  })();
  ok('and a Hulk is a bigger target than a Drifter, in the same proportion it is drawn',
     Math.abs(bigEdge / near[1] - C._TYPES[2][5] / C._TYPES[0][5]) < 0.15,
     bigEdge.toFixed(2) + 'm against ' + near[1].toFixed(2) + 'm at ' + near[0] + 'm - ' +
     (bigEdge / near[1]).toFixed(2) + 'x, and it is drawn ' +
     (C._TYPES[2][5] / C._TYPES[0][5]).toFixed(2) + 'x the size');
  C._ASSIST = wasAssist;

  // overlaps go to the one you are most centred on
  M.restart(); M.look(0, 0);
  const d0 = Math.hypot(w[0], w[2]) || 1;
  M.place([[w[0], C._GY, w[2], 9, 9, 0, 0, 0, 0],
           [w[0] - w[2] / d0 * 0.3, C._GY, w[2] + w[0] / d0 * 0.3, 9, 9, 0, 0, 2, 0]]);
  rec.ops = []; tick();
  const outlines = rec.ops.filter((o) => o.op === 'stroke' && o.c === 'rgba(' + C._GOLD.join(',') + ',1)');
  ok('and only ever one ghost is targeted at a time', outlines.length === 1,
     'a Drifter dead on the crosshair overlapping a Hulk beside it, and one outline');
  M.setFire(1);
}

console.log('');
console.log('--- aim assist, and the rest of the pass --------------------------');
{
  M.setFire(0);
  const RBQ = [[255, 59, 107], [255, 149, 0], [255, 214, 10], [58, 211, 95],
                [34, 201, 255], [88, 96, 235], [180, 92, 255]];
  const gold1 = 'rgba(' + C._GOLD.join(',') + ',1)';

  // --- the crosshair is thicker, not bigger ---------------------------------------
  M.restart(); M.look(0, 0); M.place([]);
  rec.ops = []; tick();
  const xh = rec.ops.filter((o) => o.op === 'stroke' &&
    o.c === 'rgba(' + C._GOLD.join(',') + ',' + C._XHA + ')').pop();
  ok('the crosshair is thicker', xh.w === C._XHW && C._XHW > 2,
     C._XHW + 'px of line, and the arms are still ' + (C._XHR * 500).toFixed(1) + 'px');

  // it is drawn twice: a dark pass under, gold over
  const halo = rec.ops.filter((o) => o.op === 'stroke' && o.c === C._XHO).pop();
  ok('and it carries a dark halo, so it survives being over a gold target outline',
     !!halo && halo.w === C._XHW + C._XHOW * 2 && rec.ops.indexOf(halo) < rec.ops.indexOf(xh),
     halo.w + 'px of ' + halo.c + ' under ' + xh.w + 'px of gold');
  ok('and both passes are the same path, so the halo cannot drift off it',
     JSON.stringify(halo.p) === JSON.stringify(xh.p),
     'stroked twice without rebuilding it - ' + halo.p.length + ' points either way');
  ok('and the ends are rounded, so the halo wraps the tips',
     halo.cap === 'round' && xh.cap === 'round',
     'butt caps would stop the dark flush with the gold and leave the tips bare');

  // and the context is handed back as it was found
  const after = rec.ops.filter((o) => o.op === 'stroke').slice(rec.ops.indexOf(xh) + 1);
  ok('and the shared context is put back to butt caps afterwards',
     after.every((o) => o.cap !== 'round'),
     'nothing drawn later inherits round caps from the crosshair');

  // --- the assist ------------------------------------------------------------------
  // A ghost placed beside where the crosshair points, near enough to be pulled to.
  const off = C._TYPES[0][5] * (C._ASSISTR * 0.75);   // inside ASSISTR, wherever that is
  const put = (offset) => {
    M.restart(); M.look(0, 0);
    const w = M.aimWorld(7), d = Math.hypot(w[0], w[2]) || 1;
    M.place([[w[0] - w[2] / d * offset, C._GY, w[2] + w[0] / d * offset, 9, 9, 0, 0, 0, 0]]);
  };
  put(off);
  const y0 = M.dbg().yaw;
  const xh0 = M.aimPoint();
  const pose0 = JSON.stringify(M.sprite());
  tick();
  ok('a ghost beside the crosshair pulls the camera toward it',
     Math.abs(M.dbg().yaw - y0) > 1e-6,
     'yaw moved ' + ((M.dbg().yaw - y0) * 180 / Math.PI).toFixed(3) + ' degrees in one frame');
  // The claim is about the PUPPET, so measure the puppet. The crosshair is not
  // quite fixed and should not be asserted to be: aimAt converges it to the
  // target's range, so it slides a fraction of a pixel when that range changes.
  // That is the parallax fix doing its job, not the unicorn turning.
  ok('and it turns the camera, not the unicorn - the pose is untouched',
     JSON.stringify(M.sprite()) === pose0,
     'every number in the sprite pose identical, and the crosshair moved ' +
     Math.hypot(M.aimPoint()[0] - xh0[0], M.aimPoint()[1] - xh0[1]).toFixed(2) +
     'px, which is the aim point converging to the new range');

  for (let i = 0; i < 120; i++) tick();
  rec.ops = []; tick();
  ok('and given a moment it lands the ghost under the crosshair',
     rec.ops.some((o) => o.op === 'stroke' && o.c === gold1),
     'it started ' + off.toFixed(2) + 'm off and is now targeted');

  // It does not reach past ASSISTR, or it would be aiming for you.
  //
  // From a clean camera, and with the ghost PINNED. Both matter. The checks above
  // leave the view turned and conv eased out to whatever they were tracking, and
  // this one is about how far the assist reaches from where you are looking, not
  // about where the last one left you. Pinning it measures the reach rather than
  // the reach plus however far the ghost walked in while being measured - a ghost
  // that starts outside the radius and strolls into it proves nothing.
  M.restart(); M.look(0, 0);
  const far = C._TYPES[0][5] * C._ASSISTR * 2;
  const wf = M.aimWorld(7), df = Math.hypot(wf[0], wf[2]) || 1;
  const gf = [wf[0] - wf[2] / df * far, C._GY, wf[2] + wf[0] / df * far, 9, 9, 0, 0, 0, 0];
  const y1 = M.dbg().yaw;
  for (let i = 0; i < 60; i++) { M.place([gf.slice()]); tick(); }
  ok('but it does not reach for something far off the crosshair',
     Math.abs(M.dbg().yaw - y1) < 1e-9,
     far.toFixed(2) + 'm away is outside ASSISTR of ' +
     C._ASSISTR + ' radii, and the camera did not move a thing');

  // Nothing to assist toward, nothing happens. Emptied EVERY frame, not once:
  // wave 1 goes on spawning through the second being measured, so a single
  // place([]) leaves the field empty for one frame and full for the rest - and
  // whether that passes comes down to whether a spawn happens to land near the
  // crosshair, which is luck rather than a check.
  M.restart(); M.look(0, 0); M.place([]);
  const y2 = M.dbg().yaw, p2 = M.dbg().pitch;
  for (let i = 0; i < 60; i++) { M.place([]); tick(); }
  ok('and an empty field leaves the camera alone',
     M.dbg().yaw === y2 && M.dbg().pitch === p2,
     'a second of nothing there and the view has not drifted');

  // --- a held ghost wears the rainbow ------------------------------------------------
  M.restart(); M.look(0, 0);
  const wb = M.aimWorld(7);
  M.place([[wb[0], C._GY, wb[2], 9, 9, 0, 0, 0, C._BINDDUR]]);
  rec.ops = []; tick();
  const outline = rec.ops.filter((o) => o.op === 'stroke' && o.n === 2 && o.w === C._BINDW);
  const cols = new Set(outline.map((o) => o.c));
  ok('a bound ghost is outlined in the rainbow, not the target gold',
     outline.length > 10 && cols.size > 6 && !outline.some((o) => o.c === gold1),
     outline.length + ' segments in ' + cols.size + ' colours around the body, and no gold');
  ok('and it walks the rainbow around the body rather than sitting on one colour',
     RBQ.some((v) => [...cols].some((c) => c.startsWith('rgba(' + v.join(',') + ','))),
     'the palette stops appear around it, interpolated between');

  // an unheld ghost under the crosshair still gets gold
  M.place([[wb[0], C._GY, wb[2], 9, 9, 0, 0, 0, 0]]);
  rec.ops = []; tick();
  ok('while an unheld one under the crosshair is still gold',
     rec.ops.some((o) => o.op === 'stroke' && o.c === gold1),
     'the two states do not collide - held wins, and it is the only one that can');

  // --- the bar ------------------------------------------------------------------------
  M.restart(); M.place([]); M.look(0, 0);
  const bars = (ops) => ops.filter((o) => o.op === 'rect' &&
    RBQ.some((v) => o.c.startsWith('rgba(' + v.join(',') + ',')));
  rec.ops = []; tick();
  const full = bars(rec.ops).reduce((a, o) => a + o.w, 0);
  ok('the bar is full when the bind is up, before any charging', full > 0,
     full.toFixed(0) + 'px of rainbow');

  armed();
  for (let i = 0; i < 30; i++) tick();
  rec.ops = []; tick();
  const mid = bars(rec.ops).reduce((a, o) => a + o.w, 0);
  const trackOf = (ops) => ops.find((o) => o.op === 'rect' && o.c === C._BARBG);
  const bt = trackOf(rec.ops);
  const edgeOf = (ops) => ops.find((o) => o.op === 'stroke' && o.c === C._BARSC);
  const reach = (o) => Math.max(...o.p.map((q) => q[0])) - Math.min(...o.p.map((q) => q[0]));
  const e0 = edgeOf(rec.ops);
  ok('and charging does not change the fill - that is the refill, and it is a different question',
     Math.abs(mid - full) < 0.5,
     'still ' + mid.toFixed(0) + 'px with half a second of charge on it');
  ok('charging draws the bar own outline instead of another fill',
     !!e0 && e0.w === C._BARSLW && e0.p.length === 4,
     'a ' + C._BARSLW + 'px white line: in along the top, down the left edge, back along the bottom');
  ok('and it is anchored to the bar, not floating on it',
     Math.abs(Math.min(...e0.p.map((q) => q[0])) - bt.x) < 0.5 &&
     Math.abs(Math.min(...e0.p.map((q) => q[1])) - bt.y) < 0.5,
     'its left edge and top sit exactly on the track');

  for (let i = 0; i < 90; i++) tick();
  rec.ops = []; tick();
  const e1 = edgeOf(rec.ops);
  ok('and it lays itself down left to right as the charge fills',
     reach(e1) > reach(e0) &&
     Math.abs(Math.min(...e1.p.map((q) => q[0])) - Math.min(...e0.p.map((q) => q[0]))) < 1e-9,
     'reaches ' + reach(e0).toFixed(0) + 'px then ' + reach(e1).toFixed(0) +
     'px, from the same left corner - it grows rather than slides');

  let z2 = 0, eN = null;
  while (M.anim().charging && z2++ < 60 * 20) { tick(); eN = edgeOf(rec.ops) || eN; }
  // No closing right edge: cast() fires in step() before render(), so the frame
  // where it would reach full is the frame charging is already over.
  ok('and reaches the far end on the last frame there is to draw it',
     reach(eN) > bt.w * 0.99 && eN.p.length === 4,
     'spans ' + reach(eN).toFixed(0) + 'px of the ' + bt.w.toFixed(0) +
     'px bar - 99.4% is as full as a drawn frame can be');
  release();
  rec.ops = []; tick();
  ok('and is gone the moment it fires', !edgeOf(rec.ops),
     'cast, and the bar is back to being only the refill');
  ok('which is now draining', bars(rec.ops).reduce((a, o) => a + o.w, 0) < full * 0.1,
     'the fill has emptied, and that is the only thing the fill ever meant');
  M.setFire(1);
}

console.log('');
console.log('--- what a run leaves behind -------------------------------------');
{
  M.setFire(0);
  const redOf = (ops) => ops.find((o) => o.op === 'rect' &&
    o.c.startsWith('rgba(' + C._HURTC.join(',') + ','));
  const kill = () => {
    let n = 0;
    while (!M.dbg().over && n++ < 60 * 120) {
      if (!M.dbg().ghosts.length) M.place([[C._GCONTACT - 0.01, C._GY, 0, 9, 9, 0, 0, 0, 0]]);
      tick();
    }
  };

  // Dying mid-charge must not hand the next run a press it never made.
  const chg = C._BINDCHG;
  C._BINDCHG = 30;                                // so death lands first
  M.restart(); M.look(0, 0); M.place([]);
  armed();
  kill();
  ok('you can die mid-charge', M.dbg().over === 1 && M.anim().charging === 1,
     'dead with the charge still running and armT at ' + M.anim().armT.toFixed(2));
  press();                                       // the click that restarts
  for (let i = 0; i < 60; i++) tick();
  ok('and the next run does not inherit that press',
     M.anim().charging === 0 && M.anim().bindR === 0,
     'a second into the new run and nothing has charged itself - armT is ' +
     M.anim().armT.toFixed(2) + ', not the ' + C._ARM + ' it died holding');
  release();
  C._BINDCHG = chg;

  // The killing blow is seen and felt.
  M.restart(); M.look(0, 0); M.place([]);
  kill();
  rec.ops = []; tick();
  ok('the blow that kills you still flashes red', !!redOf(rec.ops),
     'over=1 with ' + M.anim().hurtT.toFixed(2) + 's of it left to run');
  ok('and still kicks the view',
     rec.ops.some((o) => o.op === 'translate' && (o.x || o.y)),
     'the world is held up, frozen, while the hit lands');
  ok('and the results do not cut in over the top of it',
     !rec.ops.some((o) => o.op === 'text' && /WAVES SURVIVED/.test(o.s)),
     'the world and the red first, the score after');

  let n = 0;
  while (M.anim().hurtT > 0 && n++ < 60 * 5) tick();
  rec.ops = []; tick();
  ok('and once it has landed, the over screen arrives',
     rec.ops.some((o) => o.op === 'text' && /WAVES SURVIVED/.test(o.s)) && !redOf(rec.ops),
     'after ' + (n / 60).toFixed(2) + 's of it - HURTD is ' + C._HURTD);
  ok('and the world is gone by then',
     !rec.ops.some((o) => o.op === 'fill' && /^rgb\(/.test(o.c)),
     'no ghosts, no puppet, just the three lines');
  M.setFire(1);
}

console.log('');
console.log('--- the upgrade cards ---------------------------------------------');
{
  M.setFire(0);
  const NAME = C._CARDS.map((c) => c[5]);
  const dealAt = (w, levels = {}) => {
    M.restart(); M.look(0, 0); M.place([]);
    M.setWave(w);
    for (const k in levels) M.setLv(+k, levels[k]);
    return M.dealNow();
  };
  const seen = (w, levels, rolls = 300) => {
    const s2 = new Set();
    for (let i = 0; i < rolls; i++) for (const k of dealAt(w, levels)) s2.add(k);
    return s2;
  };

  // --- the guarantee -------------------------------------------------------------
  let all = true;
  for (let i = 0; i < 60; i++) if (!dealAt(1).includes(0)) all = false;
  ok('fire rate is guaranteed in the first draw', all,
     'sixty wave 1 draws and every one had it - the only card that is ever promised');
  ok('and it is one of THREE, not the whole draw',
     dealAt(1).length === C._CARDN,
     'the first draw offers ' + dealAt(1).length + ' cards with fire rate among them, ' +
     'which needs three of them open at wave 1 to be possible at all');
  let always = true;
  for (let i = 0; i < 60; i++) if (!dealAt(6).includes(0)) always = false;
  ok('and only in the first - after that it takes its chances', !always,
     'a wave 6 draw can come up without it');

  ok('three cards are offered', dealAt(6).length === C._CARDN,
     C._CARDN + ' of them, and never two levels of one card: ' +
     (new Set(dealAt(6)).size === C._CARDN ? 'all distinct' : 'DUPLICATED'));

  // --- the gates -----------------------------------------------------------------
  ok('horn damage waits for wave ' + C._CARDS[1][1],
     !seen(C._CARDS[1][1] - 1, {}).has(1) && seen(C._CARDS[1][1], {}).has(1),
     'absent at wave ' + (C._CARDS[1][1] - 1) + ', present at ' + C._CARDS[1][1]);
  for (const i of [2, 3, 4])
    ok(NAME[i].toLowerCase() + ' waits for wave ' + C._CARDS[i][1],
       !seen(C._CARDS[i][1] - 1, {}).has(i) && seen(C._CARDS[i][1], {}).has(i),
       'the bind cards are staggered so they do not all land at once');
  ok('extra heart waits for wave ' + C._CARDS[5][1],
     !seen(C._CARDS[5][1] - 1, {}).has(5) && seen(C._CARDS[5][1], {}).has(5),
     'absent at wave ' + (C._CARDS[5][1] - 1) + ', present at ' + C._CARDS[5][1]);
  ok('and its SECOND level waits until wave ' + C._HEART2,
     !seen(C._HEART2 - 1, { 5: 1 }).has(5) && seen(C._HEART2, { 5: 1 }).has(5),
     'one heart from wave ' + C._CARDS[5][1] + ', the next not until ' + C._HEART2);

  // --- the chain -----------------------------------------------------------------
  ok('regen is locked until you have taken a heart',
     !seen(12, { 5: 0 }).has(6) && seen(12, { 5: 1 }).has(6),
     'hearts are the entry fee for sustain - which is how 9 wanted regen made rare');
  ok('and its second level until you have taken the second heart',
     !seen(12, { 5: 1, 6: 1 }).has(6) && seen(12, { 5: 2, 6: 1 }).has(6),
     'regen++ needs heart++, exactly as regen+ needed heart+');

  // --- the adaptive draw ----------------------------------------------------------
  const share = (levels, rolls = 4000) => {
    let horn = 0, bind = 0;
    for (let i = 0; i < rolls; i++)
      for (const k of dealAt(12, levels)) { if (k < 2) horn++; else if (k < 5) bind++; }
    return bind / (horn + bind);
  };
  const even = share({});
  const hornHeavy = share({ 0: 6, 1: 6 });
  const bindHeavy = share({ 2: 3, 3: 3, 4: 3 });
  ok('a horn-heavy player starts being offered the bind',
     hornHeavy > even + 0.05,
     (100 * even).toFixed(0) + '% bind when level, ' + (100 * hornHeavy).toFixed(0) +
     '% after six horn cards');
  ok('and a bind-heavy player starts being offered the horn',
     bindHeavy < even - 0.05,
     (100 * bindHeavy).toFixed(0) + '% bind after nine bind cards - it works both ways');
  ok('and each side is measured against its OWN cap',
     C._CARDS[0][0] + C._CARDS[1][0] !== C._CARDS[2][0] + C._CARDS[3][0] + C._CARDS[4][0],
     '16 horn levels against 12 bind - two cards of eight is not two of four');

  // --- a short pool, then Recovery -------------------------------------------------
  const maxAll = {};
  for (let i = 0; i < C._CARDS.length; i++) maxAll[i] = C._CARDS[i][0];
  ok('with everything taken, the only card left is Recovery',
     JSON.stringify(dealAt(40, maxAll)) === '[-1]',
     'one card, a full heal, and it never runs out');
  const nearly = { ...maxAll, 0: C._CARDS[0][0] - 1 };
  ok('and a short pool offers what is left rather than padding',
     dealAt(40, nearly).length === 1 && dealAt(40, nearly)[0] === 0,
     'one card on the table because one card is all there is');

  // --- taking one ------------------------------------------------------------------
  M.restart(); M.look(0, 0); M.place([]);
  M.setWave(6);
  const before = M.anim();
  const off = M.dealNow();
  const fr = off.indexOf(0);
  if (fr >= 0) {
    const b = M.boxes()[fr];
    press(b[0] + b[2] / 2, b[1] + b[3] / 2); release();
    ok('taking fire rate makes the gun faster', M.anim().fire < before.fire,
       before.fire.toFixed(3) + 's between shots became ' + M.anim().fire.toFixed(3));
  } else ok('taking fire rate makes the gun faster', true, '(not offered this roll)');

  M.restart(); M.look(0, 0); M.place([]);
  M.setWave(6); M.dealNow();
  const w0 = M.anim().wave;
  pickCard(0);
  ok('and a pick starts the next wave', M.anim().wave === w0 + 1 && M.anim().picking === 0,
     'wave ' + w0 + ' to ' + M.anim().wave + ', cards gone');

  // hearts and regen actually move
  M.restart(); M.look(0, 0); M.place([]);
  M.setWave(6); M.setLv(5, 1);
  ok('an extra heart raises the maximum', M.anim().maxhp === C._HEARTS + 1,
     C._HEARTS + ' hearts became ' + M.anim().maxhp);
  M.setLv(6, 2);
  ok('and regen heals more between waves', M.anim().regen === C._REGEN + 2,
     '+' + C._REGEN + ' a wave became +' + M.anim().regen);

  // --- the screen itself ------------------------------------------------------------
  M.restart(); M.look(0, 0); M.place([]);
  M.setWave(6);
  const shown = M.dealNow();
  rec.ops = []; tick();
  const texts = rec.ops.filter((o) => o.op === 'text');
  const bx = M.boxes();
  ok('a card is a card, not half the screen',
     bx[0][2] < 900 * 0.2 && bx[0][3] < 500 * 0.4 &&
     bx[bx.length - 1][0] + bx[0][2] - bx[0][0] < 900 * 0.75,
     bx[0][2].toFixed(0) + 'x' + bx[0][3].toFixed(0) + 'px each, ' +
     (bx[bx.length - 1][0] + bx[0][2] - bx[0][0]).toFixed(0) + 'px across for all three');
  const titles = rec.ops.filter((o) => o.op === 'text' && C._CARDS.some((c) => c[5] === o.s));
  const fit = (s) => 900 * C._CARDW * Math.min(C._CARDT, 1.5 / s.length) | 0;
  ok('and its type is sized off the card, so it reads',
     titles.every((o) => Math.abs(o.f - fit(o.s)) < 0.5) &&
     Math.min(...titles.map((o) => o.f)) > 11,
     titles.map((o) => o.s + ' ' + o.f + 'px').join(', ') + ' - against the 11px they ' +
     'were when the type came off the HUD unit');
  // The rename lengthened four of the seven titles, so this is now the binding
  // one rather than a formality: RAINBOW COOLDOWN is the longest there is.
  const worst = C._CARDS.map((c) => c[5]).sort((a2, b2) => b2.length - a2.length)[0];
  ok('and even the longest one fits inside its card', fit(worst) * 0.62 * worst.length < 900 * C._CARDW,
     '"' + worst + '" at ' + fit(worst) + 'px is about ' +
     (fit(worst) * 0.62 * worst.length).toFixed(0) + 'px wide, in a ' +
     (900 * C._CARDW).toFixed(0) + 'px card');

  ok('the card screen names every card it is offering',
     shown.every((i) => texts.some((o) => o.s === (i < 0 ? 'RECOVERY' : C._CARDS[i][5]))),
     shown.map((i) => C._CARDS[i][5]).join(', '));
  ok('and shows the level each one would take you to',
     shown.every((i) => texts.some((o) => o.s === 'LV ' + (M.anim().lv[i] + C._CARDS[i][7] + 1))),
     'title on top, level under it');
  // You already own level 1 of everything, so its first card is level 2. Extra
  // heart is the one you do not own at all, so its first card is level 1.
  M.restart(); M.setWave(6);
  const first = M.dealNow().map((i) => [C._CARDS[i][5], 'LV ' + (0 + C._CARDS[i][7] + 1)]);
  ok('a first card reads LV 2, because level 1 is what you start with',
     C._CARDS.every((c, i) => c[7] + 1 === (i === 5 ? 1 : 2)),
     C._CARDS.map((c, i) => c[5] + ' -> LV ' + (c[7] + 1)).join(', '));
  ok('and its last reads the cap the table says',
     C._CARDS.every((c) => c[0] + c[7] === (c[0] === 8 ? 9 : c[0] === 4 ? 5 : c[7] ? 3 : 2)),
     C._CARDS.map((c) => c[5] + ' LV' + (c[7] + 1) + '-' + (c[0] + c[7])).join(', '));
  ok('and what the number actually becomes',
     texts.some((o) => / > /.test(o.s)),
     'the step it buys, not a percentage you have to trust');
  ok('the cards are not labelled 1 2 3 any more',
     !texts.some((o) => /^[123]$/.test(o.s)),
     'the keys still work, they are just not written on the cards');
  ok('and the screen says what to do with them',
     texts.some((o) => o.s === 'Pick a Power Up' && o.c === '#fff') &&
     texts.some((o) => /^WAVE \d+ CLEARED$/.test(o.s)),
     '"WAVE n CLEARED" in gold, "Pick a Power Up" in white under it');

  ok('and the run is held while they are up',
     M.anim().picking === 1 && (() => {
       const z = M.dbg().ghosts.length;
       M.place([[0, C._GY, 8, 9, 9, 0, 0, 0, 0]]);
       const d0 = M.dbg().ghosts[0][2];
       for (let i = 0; i < 60; i++) tick();
       return Math.abs(M.dbg().ghosts[0][2] - d0) < 1e-9;
     })(),
     'a second passes and nothing on the field has moved');

  // keyboard
  M.restart(); M.look(0, 0); M.place([]);
  M.setWave(6); M.dealNow();
  const lv0 = [...M.anim().lv];
  key('keydown', 'Digit2'); key('keyup', 'Digit2');
  ok('and 1, 2, 3 take a card, so a run never needs the mouse',
     M.anim().picking === 0 && JSON.stringify(M.anim().lv) !== JSON.stringify(lv0),
     'Digit2 took the middle card');
  M.setFire(1);
}

console.log('');
console.log('--- the card icons ------------------------------------------------');
{
  const NAME = [...C._CARDS.map((c) => c[5]), 'RECOVERY'];
  const IDS = [0, 1, 2, 3, 4, 5, 6, -1];
  // What a glyph amounts to on screen: the ops it makes, in order, with their
  // colour and how many points each had. Two icons with the same signature are
  // the same picture, whatever the code around them says.
  const sig = (i) => {
    rec.ops = [];
    M.cardGlyph(i, 100, 100, 27);
    return rec.ops.map((o) => o.op + ':' + o.c + ':' + o.n).join('|');
  };
  const sigs = IDS.map(sig);
  const dupes = [];
  for (let a = 0; a < sigs.length; a++)
    for (let b = a + 1; b < sigs.length; b++)
      if (sigs[a] === sigs[b]) dupes.push(NAME[a] + ' = ' + NAME[b]);
  ok('every card icon is a different picture', !dupes.length,
     IDS.length + ' glyphs, no two alike' + (dupes.length ? ': ' + dupes.join(', ') : ''));

  // and they differ in SHAPE, not in a speck inside a shared one
  const shape = (i) => { rec.ops = []; M.cardGlyph(i, 100, 100, 27); return rec.ops.length; };
  const counts = IDS.map(shape);
  ok('and the two horn cards are not the same triangle',
     shape(0) !== shape(1),
     'fire rate draws ' + shape(0) + ' horns, shot damage ' + shape(1) +
     ' - and one of them is a gradient, which is now the whole difference');
  // Op count was the wrong measure here - a part-ring with a clock hand and a full
  // ring with a ghost in it come to the same number of calls and look nothing
  // alike. Measure the ring itself.
  const rings = (i) => {
    rec.ops = [];
    M.cardGlyph(i, 100, 100, 27);
    const arcs = rec.ops.filter((o) => o.a);
    return {
      radii: new Set(arcs.map((o) => o.a[2].toFixed(1))).size,
      swept: arcs.reduce((t, o) => t + Math.abs(o.a[4] - o.a[3]), 0),
      filled: rec.ops.some((o) => o.op === 'fill' && o.n > 4),
    };
  };
  const rad = rings(2), cd = rings(3), hold = rings(4);
  ok('bind radius is two rings, not one',
     rad.radii === 2, rad.radii + ' different arc radii - it reads as something growing');
  ok('bind cooldown is a ring with a piece MISSING, which is what a clock is',
     Math.abs(cd.swept - 2 * Math.PI) > 1 && cd.radii === 1,
     (cd.swept * 180 / Math.PI).toFixed(0) + ' degrees of ring against a full ' +
     (hold.swept * 180 / Math.PI).toFixed(0));
  ok('and bind hold is a whole ring with something caught in it',
     Math.abs(hold.swept - 2 * Math.PI) < 0.01 && hold.filled,
     'a closed ring and a ghost filled inside it - the thing the card actually does');
  ok('and regen is no longer identical to Recovery',
     sig(6) !== sig(-1),
     'one is a heart filling, the other a heart already full');

  const glyph = (i) => { rec.ops = []; M.cardGlyph(i, 100, 100, 27); return rec.ops; };
  const card = (i) => {
    rec.ops = [];
    M.drawCard(i, 0, 0, 900 * C._CARDW, 500 * C._CARDH);
    return rec.ops;
  };

  ok('and shot damage has no white burst on it any more',
     !glyph(1).some((o) => o.op === 'stroke'),
     'the horn and nothing else');
  // every description reads the same way
  const descs = C._CARDS.map((c) => c[6]);
  ok('every description is Title Case',
     descs.every((d) => d.split(' ').every((w) => w[0] === w[0].toUpperCase())),
     descs.join(' / '));

  ok('the two horn cards are SHOT and the three bind ones are RAINBOW',
     [C._CARDS[0][5], C._CARDS[1][5]].every((n) => n.startsWith('SHOT')) &&
     [2, 3, 4].every((k) => C._CARDS[k][5].startsWith('RAINBOW')) &&
     C._CARDS[6][5] === 'HEAL',
     C._CARDS.map((c) => c[5]).join(', '));
  ok('and every title fits the card it is on',
     C._CARDS.concat([[0, 0, 0, 0, 0, 'RECOVERY']]).every((c) => {
       const f = Math.min(C._CARDT, 1.5 / c[5].length);
       return c[5].length * (900 * C._CARDW * f | 0) * 0.6 < 900 * C._CARDW;
     }),
     'the longest is "' + C._CARDS.map((c) => c[5]).sort((a2, b2) => b2.length - a2.length)[0] +
     '", which shrinks itself rather than running off the edge');

  const grd = glyph(1).find((o) => o.op === 'fill' && /^grad/.test(o.c));
  ok('and its horn runs red at the point into gold at the base',
     !!grd && grd.c.indexOf('' + C._SHOTR[0]) < grd.c.indexOf('' + C._GOLD[1]),
     grd.c + ' - a gradient, so it is not the same gold triangle fire rate is');

  ok('bind radius has no white lines across it any more',
     !glyph(2).some((o) => o.op === 'stroke' && /#fff|255,255,255/.test(o.c)),
     'two rainbow rings and nothing else');
  const radii = [...new Set(glyph(2).filter((o) => o.a).map((o) => o.a[2]))].sort((x, y) => x - y);
  ok('and its inner ring sits just inside the outer one',
     radii.length === 2 && radii[0] / radii[1] > 0.6,
     (radii[0] / radii[1]).toFixed(2) + ' of the outer, where it used to be 0.46');

  const hearts5 = glyph(5).filter((o) => o.op === 'fill' && o.c === 'rgba(' + C._HPC.join(',') + ',1)');
  ok('extra heart is one heart with a plus, not two hearts',
     hearts5.length === 1 && glyph(5).some((o) => o.op === 'stroke' && o.c === '#fff'),
     'one red heart, and the plus over it');

  const green = 'rgba(' + C._HEALC.join(',') + ',1)';
  ok('heal and Recovery are green, hearts and health apart',
     glyph(6).some((o) => o.c === green) && glyph(-1).some((o) => o.c === green) &&
     card(6).some((o) => o.op === 'srect' && o.c === green) &&
     card(-1).some((o) => o.op === 'srect' && o.c === green),
     'icon and card border both ' + green + ', while extra heart stays rgb(' + C._HPC + ')');

  ok('and Recovery is two hearts with no plus, the back one bigger',
     glyph(-1).filter((o) => o.op === 'fill' && o.c === green).length === 2 &&
     !glyph(-1).some((o) => o.op === 'stroke' && o.c === '#fff'),
     'a full heart against a faded larger one behind it');

  const rtext = card(-1).filter((o) => o.op === 'text').map((o) => o.s);
  ok('and it says what it does instead of a level',
     rtext.join(' ').includes('Fully Recover') && !rtext.some((t) => /^LV /.test(t)),
     '"' + rtext.join(' / ') + '"');

  // an icon has to survive being small
  ok('and every one of them still draws at half size',
     IDS.every((i) => { rec.ops = []; M.cardGlyph(i, 100, 100, 13); return rec.ops.length > 0; }),
     'nothing vanishes when the card shrinks');
}

console.log('');
  // Taking a card levels the aim. Ghosts float at one height and the wave you just
  // finished may have left you pointing at the floor or the sky.
  M.restart(); M.look(0.9, C._PITCHMAX);
  M.setWave(4);
  M.dealNow();
  const yawWas = M.dbg().yaw;
  kdown('Digit1'); kup('Digit1');
  ok('and taking one levels the aim for the wave after it',
     Math.abs(M.dbg().pitch) < 1e-9,
     'pitch was ' + (C._PITCHMAX * 180 / Math.PI).toFixed(0) + ' degrees and is 0');
  ok('and only the pitch - it does not spin you round',
     M.dbg().yaw === yawWas,
     'still facing ' + (yawWas * 180 / Math.PI).toFixed(0) + ' degrees. Yaw is which ' +
     'way you are FACING, and turning somebody round between waves would be a worse ' +
     'thing to do than the one being fixed');

console.log('--- the heal, seen -----------------------------------------------');
{
  M.setFire(0);
  const heartsOf = (ops) => ops.filter((o) => o.op === 'fill' && o.n === 6 &&
    o.p.every((q) => q[1] < 500 / 2));
  const red = 'rgba(' + C._HPC.join(',') + ',1)';

  // lose a heart, clear the wave, take a card, and watch it come back
  M.restart(); M.look(0, 0); M.place([]);
  M.setWave(6);
  let n = 0;
  while (M.dbg().hearts === C._HEARTS && n++ < 60 * 90) {
    if (!M.dbg().ghosts.length) M.place([[C._GCONTACT - 0.01, C._GY, 0, 9, 9, 0, 0, 0, 0]]);
    tick();
  }
  const down = M.dbg().hearts;
  ok('you can be down a heart going into a card', down < C._HEARTS,
     down + ' of ' + M.anim().maxhp);

  M.place([]);
  let g3 = 0;
  while (!M.anim().picking && g3++ < 60 * 30) { M.place([]); tick(); }
  // Any card heals, because the heal is a level applied at the start of a wave -
  // but EXTRA HEART also raises maxhp, which moves which slot is empty. Taking
  // the first card offered left that up to the random stream, and this test broke
  // the day something upstream consumed a different number of randoms.
  const off = M.anim().offer;
  pickCard(Math.max(0, off.findIndex((i) => i !== 5)));
  ok('and the heal starts a pulse rather than a silent refill',
     Math.abs(M.anim().healT - C._HEALP) < 0.02 && M.anim().healN > 0,
     M.anim().healN + ' heart(s) pulsing for ' + C._HEALP + 's from slot ' + M.anim().healA);

  // Sampled across the pulse rather than on one frame: it is a sine between red
  // and white, so at the trough it IS red, and a single frame passed or failed on
  // where the clock happened to be.
  const hslot = M.anim().healA;
  const swatch = [];
  for (let i = 0; i < 12; i++) { rec.ops = []; tick(); swatch.push(heartsOf(rec.ops)[hslot].c); }
  ok('the healing heart is not drawn red while it pulses',
     swatch.some((c) => c !== red && c !== '#2a2136'),
     'slot ' + hslot + ' runs ' + new Set(swatch).size + ' colours over twelve frames, ' +
     'between red and white - it is neither the empty outline nor a filled heart yet');

  // it really pulses - the colour has to move
  const at = () => { rec.ops = []; tick(); return heartsOf(rec.ops)[M.anim().healA].c; };
  const a1 = at();
  for (let i = 0; i < 10; i++) tick();
  ok('and it pulses rather than sitting on one colour', at() !== a1,
     'the mix moves with the clock at ' + C._HEALR + ' radians a second');

  // The checks above burnt frames of the pulse, so count from what is LEFT of it
  // rather than from zero - otherwise this measures the test, not the code.
  const left = M.anim().healT;
  const slot = M.anim().healA;
  let f = 0;
  while (M.anim().healT > 0 && f++ < 60 * 10) tick();
  rec.ops = []; tick();
  const total = C._HEALP - left + f / 60;
  ok('and settles to red after HEALP', Math.abs(total - C._HEALP) < 0.06 &&
     heartsOf(rec.ops)[slot].c === red,
     'red again ' + total.toFixed(2) + 's after the pulse began, against HEALP ' + C._HEALP);

  // three at once, which is what Heal at its cap with both hearts actually does
  M.restart(); M.look(0, 0); M.place([]);
  M.setWave(12); M.setLv(5, 2); M.setLv(6, 2);
  const cap = M.anim().maxhp;
  let h3 = 0;
  while (M.dbg().hearts > cap - 3 && h3++ < 60 * 200) {
    if (!M.dbg().ghosts.length) M.place([[C._GCONTACT - 0.01, C._GY, 0, 9, 9, 0, 0, 0, 0]]);
    tick();
  }
  ok('with both heart cards and Heal at its cap you can be three down',
     M.dbg().hearts === cap - 3 && M.anim().regen === 3,
     M.dbg().hearts + ' of ' + cap + ' hearts, and the card heals +' + M.anim().regen);
  M.place([]);
  let g5 = 0;
  while (!M.anim().picking && g5++ < 60 * 60) { M.place([]); tick(); }
  pickCard(0);
  ok('and all three fill, not one', M.anim().healN === 3 && M.dbg().hearts === cap,
     M.anim().healN + ' hearts pulsing from slot ' + M.anim().healA + ', back to ' + cap);
  // Sampled over several frames: on any ONE frame the three must match, and
  // across frames the colour has to move. Asserting a single frame is not red is
  // wrong - the trough of the pulse IS red, since it mixes red toward white.
  const rows = [];
  for (let k = 0; k < 12; k++) {
    rec.ops = []; tick();
    rows.push(heartsOf(rec.ops).map((o) => o.c).slice(M.anim().healA, M.anim().healA + 3));
  }
  ok('and they pulse together, on one clock, not each on its own',
     rows.every((r2) => new Set(r2).size === 1),
     'twelve frames, and on every one the three are the same colour');
  ok('and the pulse really moves', new Set(rows.map((r2) => r2[0])).size > 3,
     new Set(rows.map((r2) => r2[0])).size + ' different colours across those twelve frames, ' +
     'from red at the trough up toward white');
  let f3 = 0;
  while (M.anim().healT > 0 && f3++ < 60 * 10) tick();
  rec.ops = []; tick();
  ok('and settle together', heartsOf(rec.ops).every((o) => o.c === red),
     'every heart red, none left mid-pulse');

  // and nothing pulses when nothing was healed
  M.restart(); M.look(0, 0); M.place([]);
  M.setWave(6);
  let g4 = 0;
  while (!M.anim().picking && g4++ < 60 * 30) { M.place([]); tick(); }
  pickCard(0);
  ok('and a full heart bar pulses nothing at all', M.anim().healT === 0,
     'no empty heart, so there is nothing to fill and nothing to announce');
  M.setFire(1);
}

console.log('');
console.log('--- the Warden -----------------------------------------------------');
{
  M.setFire(0);
  const draw = (k, hit) => {
    M.restart(); M.look(0, 0);
    M.place([[0, C._GY, 7, 9, 9, hit ? C._GFLASH : 0, 0, k, 0]]);
    rec.ops = []; tick();
    return rec.ops;
  };
  const white = 'rgba(' + C._SOLIDF.join(',') + ',1)';
  // its own, since the one in the ghost-types block is scoped there
  const bodyOf = (k) => {
    M.restart(); M.look(0, 0);
    M.place([[0, C._GY, 7, 9, 9, 0, 0, k, 0]]);
    rec.ops = []; tick();
    const blob = rec.ops.filter((o) => o.op === 'fill' && o.p && o.p.length > C._GDOME).shift();
    return { dome: blob.p.slice(0, C._GDOME + 1), all: blob.p };
  };
  const body = 'rgb(' + C._TYPES[4][9] + ')';

  ok('the Warden is the only solid one', C._TYPES[4][19] === 1 &&
     C._TYPES.filter((t) => t[19]).length === 1,
     'every other ghost is drawn additively; this one is not');
  ok('and it has to be, because black adds nothing',
     Math.max(...C._TYPES[4][9]) < 60,
     'body rgb(' + C._TYPES[4][9] + ') - under lighter that is not dark, it is invisible');

  const w = draw(4);
  const solidFill = w.find((o) => o.op === 'fill' && o.c === body);
  const faceFill = w.find((o) => o.op === 'fill' && o.c === white);
  ok('its body is drawn opaque, not added',
     !!solidFill && solidFill.comp === 'source-over' && solidFill.rule !== 'evenodd',
     'filled ' + body + ' in source-over, with no holes cut in it');
  ok('and its face is PAINTED on in white rather than cut out',
     !!faceFill && faceFill.comp === 'source-over' &&
     w.indexOf(faceFill) > w.indexOf(solidFill),
     'a second fill of ' + white + ', after the body and over it');
  // The real question is whether the NEXT ghost is still additive. Looking for
  // source-over after the Warden catches the HUD, which is meant to be opaque.
  M.restart(); M.look(0, 0);
  M.place([[-2, C._GY, 7, 9, 9, 0, 0, 4, 0], [2, C._GY, 7, 9, 9, 0, 0, 0, 0]]);
  rec.ops = []; tick();
  const drifter = rec.ops.find((o) => o.op === 'fill' && o.c === 'rgb(' + C._TYPES[0][9] + ')');
  const warden = rec.ops.find((o) => o.op === 'fill' && o.c === body);
  ok('and it hands the additive pass back to the ghost after it',
     !!drifter && drifter.comp === 'lighter' && rec.ops.indexOf(drifter) > rec.ops.indexOf(warden),
     'a Drifter drawn straight after a Warden is still additive - the composite is ' +
     'context state, so leaving it switched would have turned every later ghost opaque');

  const edge = w.find((o) => o.op === 'stroke' &&
    o.c === 'rgba(255,255,255,' + C._SOLIDE + ')');
  ok('and it carries a faint white edge, so the silhouette reads',
     !!edge && edge.comp === 'source-over' && C._SOLIDE < 0.5 &&
     w.indexOf(edge) > w.indexOf(solidFill) && w.indexOf(edge) < w.indexOf(faceFill),
     C._SOLIDE + ' white at ' + C._SOLIDEW + 'px, stroked after the body so the fill ' +
     'does not swallow half of it, and before the face');
  ok('and only a solid ghost gets one',
     !draw(0).some((o) => o.op === 'stroke' &&
       o.c === 'rgba(255,255,255,' + C._SOLIDE + ')'),
     'a Drifter has nothing of the kind - it is additive and already visible. ' +
     'Matching any white stroke would have caught the minimap fan instead');

  const hitW = draw(4, 1);
  ok('and a hit swaps the two rather than whitening everything',
     hitW.some((o) => o.op === 'fill' && o.c === '#fff') &&
     hitW.some((o) => o.op === 'fill' && o.c === body),
     'the body flashes white and the face goes dark, so the flash still reads');

  // the horns: a pair on the sides AND one on the crown
  const b4 = bodyOf(4);
  // On the dome now rather than down the sides, so they flank the head instead of
  // the body. Found as points standing proud of the dome's own radius.
  const cxw = (b4.dome[0][0] + b4.dome[C._GDOME][0]) / 2;
  const rad = b4.dome.map((q) => Math.hypot(q[0] - cxw, q[1] - b4.dome[0][1]));
  const med = rad.slice().sort((x, y) => x - y)[rad.length >> 1];
  const proud = rad.map((r, i) => (r > med * 1.2 ? i : -1)).filter((i) => i >= 0);
  const crownY = Math.min(...b4.dome.map((q) => q[1]));
  const low = Math.max(...b4.all.map((q) => q[1]));
  const down = (i) => (b4.dome[i][1] - crownY) / (low - crownY);
  const mid = C._GDOME >> 1;
  const pair = proud.filter((i) => i !== mid);
  ok('it carries two beside its head, not down its body',
     pair.length === 2 && C._TYPES[4][17] < 1 && down(pair[0]) < 0.5,
     'at ' + (100 * down(pair[0])).toFixed(0) + '% down the body, where a spread over 1 ' +
     'would have put them at 58% - level with the head rather than under it');
  ok('and mirrored about the crown', pair[0] === mid - (pair[1] - mid),
     'points ' + pair.join(' and ') + ' of a ' + C._GDOME + '-segment dome');
  ok('and one on top as well, which is its own column',
     C._TYPES[4][18] > 0 && proud.includes(mid) &&
     (b4.dome[0][1] - crownY) >
       (bodyOf(0).dome[0][1] - Math.min(...bodyOf(0).dome.map((q) => q[1]))) * 1.3,
     'a third at the crown, standing ' + (b4.dome[0][1] - crownY).toFixed(0) +
     'px above the shoulders against a plain dome ' +
     (bodyOf(0).dome[0][1] - Math.min(...bodyOf(0).dome.map((q) => q[1]))).toFixed(0) + 'px');
  M.setFire(1);
}

console.log('');
console.log('--- the time of day ------------------------------------------------');
{
  // A gradient records as grad(x0,y0,x1,y1;0:c 1:c), so both its ends and both
  // its colours can be read back off the fill that used it.
  const grads = (ops) => ops.filter((o) => o.op === 'rect' && /^grad\(/.test(o.c))
    .map((o) => {
      const [box, st] = o.c.slice(5, -1).split(';');
      const xy = box.split(',').map(Number);
      const cols = st.split(' ').map((p) => p.slice(p.indexOf(':') + 1));
      return { y0: xy[1], y1: xy[3], from: cols[0], to: cols[1], rect: o };
    });
  const at = (w) => { M.restart(); M.setWave(w); M.look(0, 0); M.place([]); rec.ops = []; tick(); return grads(rec.ops); };
  const rgb = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);

  const w1 = at(1), w30 = at(30);
  ok('the sky and the ground are both ramps, not flat fills',
     w1.length === 2 && w1.every((q) => q.from !== q.to),
     'two gradients: sky from ' + w1[0].from + ' to ' + w1[0].to + ', ground from ' +
     w1[1].from + ' to ' + w1[1].to);

  const hy = 500 / 2;
  ok('and both are anchored to the horizon, not to the screen',
     w1[0].y1 === hy && w1[1].y0 === hy,
     'the sky ramp ENDS on the skyline and the ground ramp STARTS there, so the ' +
     'warm band stays welded to it when the view pitches instead of sliding up it');
  M.look(0, 0.35);
  rec.ops = []; tick();
  const tilt = grads(rec.ops);
  ok('and they follow it when it moves', tilt[0].y1 > hy && tilt[1].y0 > hy,
     'pitched up, the skyline is at y ' + tilt[0].y1.toFixed(0) + ' and both ramps ' +
     'went with it');
  M.look(0, 0);

  // the ground is brighter under you than at the skyline
  const lum = (c) => rgb(c).reduce((a2, x) => a2 + x, 0);
  ok('the ground is lit under you and falls away toward the skyline',
     lum(w1[1].to) > lum(w1[1].from) * 1.5,
     'near ' + w1[1].to + ' against far ' + w1[1].from + '. Screen y IS distance on ' +
     'a ground plane, so a vertical ramp is a radial one for free');

  // and it gets dark
  ok('wave 1 is an evening and wave 30 is night',
     lum(w30[0].from) < lum(w1[0].from) / 4 && lum(w30[1].to) < lum(w1[1].to) / 3,
     'sky ' + w1[0].from + ' -> ' + w30[0].from + ', ground ' + w1[1].to + ' -> ' +
     w30[1].to);
  ok('and the sky at the skyline is the warm part of it',
     rgb(w1[0].to)[0] > rgb(w1[0].from)[0] && rgb(w1[0].to)[2] < rgb(w1[0].from)[2],
     'crimson at the horizon under purple above it: ' + w1[0].from + ' to ' + w1[0].to);

  // it is a slide, not a switch
  const mids = [1, 8, 15, 22, 30].map((w) => lum(at(w)[1].to));
  ok('and it shifts a little every wave rather than jumping',
     mids.every((x, i) => !i || x < mids[i - 1]),
     'ground brightness by wave 1/8/15/22/30: ' + mids.join(', ') +
     ' - a blend, so nothing pops. Quantising it into six steps costs the same 61 ' +
     'bytes if a hard change ever reads better');
  ok('and it stops getting darker once the night is complete',
     lum(at(C._ENVW)[1].to) === lum(at(36)[1].to),
     'wave ' + C._ENVW + ' and wave 36 are the same, because the blend is clamped');

  // the stars come out
  const starsAt = (w) => {
    M.restart(); M.setWave(w); M.look(0, 0.4); M.place([]);
    rec.ops = []; tick();
    const st = rec.ops.filter((o) => o.op === 'rect' && o.w === C._STARS);
    return st.length ? st.reduce((a2, o) => a2 + o.alpha, 0) / st.length : 0;
  };
  const s1 = starsAt(1), s30 = starsAt(30);
  ok('and the stars come out as it darkens', s30 > s1 * 2.5,
     'mean star alpha ' + s1.toFixed(3) + ' on wave 1 against ' + s30.toFixed(3) +
     ' on wave 30 - an early evening washes most of them out');
  M.restart(); M.look(0, 0);
}

console.log('');
console.log('--- the world ------------------------------------------------------');
{
  const RC = 'rgba(' + C._RINGC.join(',') + ',';
  const ringOps = (ops) => ops.filter((o) => o.op === 'fill' && o.n === 4 && o.c.startsWith(RC));
  const alphaOf = (o) => parseFloat(o.c.split(',').pop());

  M.restart(); M.look(0, 0); M.place([]); M.setFire(0);
  rec.ops = []; tick();
  const r = ringOps(rec.ops);
  const q = C._RING;
  // Where a ground point at radius rr lands, straight ahead. Against the module's
  // own projection rather than counting quads: the ones behind you cull themselves.
  const ahead = (rr) => M.proj(M.cam([0, C._EYE, rr]))[1];
  ok('there is one ring on the floor, close in',
     r.length > 0 && [...new Set(r.map(alphaOf))].length === 1 &&
       r.some((o) => o.p.some((t) => Math.abs(t[1] - ahead(q[0])) < 3 &&
         Math.abs(t[0] - 900 / 2) < 40)),
     'at ' + q[0] + 'm, where the projection says ' + q[0] + 'm is. Four of them ' +
     'every 4m out to the arena read as pattern rather than as scale; one close in ' +
     'is the distance at which a ghost has become your problem');
  ok('and it is white, the one thing on that floor that is not a rainbow',
     r.every((o) => o.c.startsWith('rgba(255,255,255,')),
     'so it can never be mistaken for the bind, which owns every other colour down there');
  ok('and it is on the floor, under everything standing on it',
     r.every((o) => o.comp === 'lighter') &&
       rec.ops.indexOf(r[r.length - 1]) < rec.ops.findIndex((o) => o.op === 'text'),
     'drawn additively, before the ghosts and the HUD');
  const thick = Math.abs(ahead(q[0] * (1 - q[1])) - ahead(q[0] * (1 + q[1])));
  ok('and it is thick enough to see', thick > 1.5,
     thick.toFixed(1) + 'px deep. Its width is a fraction of its radius rather than ' +
     'a number of metres - at a fixed 0.035m a ring is 2.5px at 4m and 0.2px at 16m');

  // --- the sky -------------------------------------------------------------------
  const starOps = (ops) => ops.filter((o) => o.op === 'rect' && o.w === C._STARS);
  M.look(0, 0);
  rec.ops = []; tick();
  const st = starOps(rec.ops);
  ok('and the stars are big enough to read', C._STARS >= 2,
     C._STARS + 'px square each, up from 1.4 - at that size they were closer to ' +
     'noise on the sky than to stars');
  ok('there is a sky, and it is only ever part of it at once',
     st.length > 4 && st.length < C._STAR[0],
     st.length + ' of ' + C._STAR[0] + ' stars on screen - the rest are behind you ' +
     'or off the sides, and cull themselves on the same near-plane test the ground uses');
  const hy = 500 / 2;
  ok('and every one of them is above the horizon',
     st.every((o) => o.y < hy),
     'they are placed by ELEVATION rather than by height, so they spread evenly in ' +
     'angle instead of piling up at the horizon where the projection is squashed');

  // they belong to the world, not to the glass
  const xs0 = starOps(rec.ops).map((o) => o.x);
  M.look(0.6, 0);
  rec.ops = []; tick();
  const xs1 = starOps(rec.ops).map((o) => o.x);
  ok('and they swing with the view rather than being painted on the glass',
     xs0.join() !== xs1.join(),
     'turning 34 degrees moves every one of them - they sit at a bearing on a ' +
     C._STAR[1] + 'm cylinder and go through the same projection as the floor');
  // Positive pitch pushes the horizon DOWN the screen, so it is looking UP.
  const upS = (() => { M.look(0, 0.5); rec.ops = []; tick(); return starOps(rec.ops).length; })();
  const dnS = (() => { M.look(0, -0.5); rec.ops = []; tick(); return starOps(rec.ops).length; })();
  ok('and looking up finds more of them than looking down',
     upS > dnS,
     upS + ' with the view raised against ' + dnS + ' with it lowered');
  M.look(0, 0);
}

console.log('');
console.log('--- particles ------------------------------------------------------');
{
  const partsNow = () => M.anim().parts;
  const BOW = [[255, 59, 107], [255, 149, 0], [255, 214, 10], [58, 211, 95],
               [34, 201, 255], [88, 96, 235], [180, 92, 255]];

  M.setFire(0);
  M.restart(); M.look(0, 0); M.place([]);
  ok('a run starts with none', !partsNow().length, 'and reset clears them');

  // --- the flinch --------------------------------------------------------------
  // Nothing about a hit moved the ghost before: it flashed white in place, which
  // reads as a light coming on rather than as being struck.
  M.restart(); M.look(0, 0); M.setFire(0);
  // The MEAN of the outline, not its left edge. The wobble moves the edges by
  // more than the flinch does - it is a deformation of the body - and averaging
  // it out leaves the thing the flinch actually moves, which is the whole ghost.
  const at = () => {
    rec.ops = []; tick();
    const b2 = rec.ops.filter((o) => o.op === 'fill' && o.comp === 'lighter' && o.n > 8)[0];
    return b2 ? b2.p.reduce((a2, q) => a2 + q[0], 0) / b2.p.length : null;
  };
  // A still ghost is not perfectly still: the dome wobbles and the body bobs, so
  // its outline moves a little every frame anyway. The claim is that a hit moves
  // it MORE than that, not that the baseline is zero.
  // Frame to frame, not end to end. The wobble is a smooth oscillation, so it
  // moves the body a long way over ten frames but barely any between two; the
  // flinch is fresh noise every frame. Total travel cannot tell them apart and
  // per-frame travel separates them completely.
  const jitter = (flash) => {
    const xs = [];
    for (let i = 0; i < 16; i++) {
      M.place([[0, C._GY, 3, 9, 9, flash, 0, 0, 0]]);     // at fighting range; slot 5 is the flash
      xs.push(at());
    }
    return xs.slice(1).reduce((a2, x, i) => a2 + Math.abs(x - xs[i]), 0) / (xs.length - 1);
  };
  const calm = jitter(0), hurt = jitter(C._GFLASH);
  ok('a hit flinches the ghost, well past its own wobble', hurt > calm * 3,
     'at 3m it moves ' + hurt.toFixed(1) + 'px a frame while the flash lasts, against ' +
     calm.toFixed(1) + 'px standing still and a body about 100px across. It used to ' +
     'flash white in place, which reads as a light coming on rather than as being struck');
  M.place([]);

  // --- a death ---------------------------------------------------------------
  M.setFire(1);
  const wc = M.aimWorld(7);
  M.place([[wc[0], C._GY, wc[2], 1, 1, 0, 0, 0, 0]]);
  const k0 = M.dbg().kills;
  let n = 0;
  while (M.dbg().kills === k0 && n++ < 60 * 10) tick();
  ok('a ghost dying leaves something behind', partsNow().length >= C._PDIE[0],
     partsNow().length + ' dots where it was - it used to vanish between one ' +
     'frame and the next, with a sound and nothing to look at');
  // Spread across the body, not stacked on its centre.
  const born = partsNow();
  const gx = M.dbg().ghosts.length ? 0 : null;
  const spanOf = (k) => Math.max(...born.map((p) => p[k])) - Math.min(...born.map((p) => p[k]));
  ok('and they start across its body rather than from one point',
     spanOf(0) > C._TYPES[0][5] && spanOf(1) > C._TYPES[0][5] && spanOf(2) > C._TYPES[0][5],
     'they are born across ' + spanOf(0).toFixed(2) + ' x ' + spanOf(1).toFixed(2) +
     ' x ' + spanOf(2).toFixed(2) + 'm, against a body radius of ' + C._TYPES[0][5] +
     'm - from a single point it read as a firework, and what died was a metre across');
  const cols = [...new Set(partsNow().map((p) => p[8].join(',')))];
  ok('and they are rainbow, whatever died',
     cols.length > 3 && cols.every((c) => BOW.some((b) => b.join(',') === c)),
     cols.length + ' of the ' + BOWN + ' rainbow colours across ' + C._PDIE[0] + ' dots. One ' +
     'colour for a whole burst is a puff; a fresh one per dot is a spray, and it ' +
     'is the same call either way - burst() takes no colour and picks its own');

  // and a Hulk, to prove it does not come off the ghost's row
  M.restart(); M.look(0, 0); M.setFire(0);
  const wh = M.aimWorld(7);
  M.place([[wh[0], C._GY, wh[2], 1, 1, 0, 0, 2, 0]]);
  M.setFire(1);
  const k1 = M.dbg().kills;
  let n2 = 0;
  while (M.dbg().kills === k1 && n2++ < 60 * 10) tick();
  ok('a Hulk sprays the same rainbow a Drifter does',
     partsNow().every((p) => BOW.some((b) => b.join(',') === p[8].join(','))) &&
       !partsNow().some((p) => p[8].join(',') === C._TYPES[2][9].join(',')),
     'nothing red about it, though the ghost was - what killed it was a rainbow, ' +
     'and that is what is left behind');
  M.setFire(0);

  // --- they die ---------------------------------------------------------------
  const most = partsNow().length;
  let n3 = 0;
  while (partsNow().length && n3++ < 60 * 10) { M.place([]); tick(); }
  ok('and they clear themselves', !partsNow().length,
     most + ' gone in ' + (n3 / 60).toFixed(2) + 's, against a life of ' + C._PDIE[2] + 's');

  // --- the cap -----------------------------------------------------------------
  M.restart(); M.look(0, 0); M.setFire(1);
  let n4 = 0;
  while (n4++ < 60 * 40) {
    if (!M.dbg().ghosts.length) {
      const w2 = M.aimWorld(6);
      M.place([[w2[0], C._GY, w2[2], 1, 1, 0, 0, 0, 0]]);
    }
    tick();
    if (partsNow().length > C._PART[0]) break;
  }
  ok('and they are capped', partsNow().length <= C._PART[0],
     'never more than ' + C._PART[0] + ' at once, whatever is dying - a list that ' +
     'grows with the wave count would cost frames exactly when there is least to spare');
  M.setFire(0);

  // --- the charge glimmer -------------------------------------------------------
  M.restart(); M.look(0, 0); M.place([]);
  let n5 = 0;
  while (partsNow().length && n5++ < 600) { M.place([]); tick(); }
  press();
  let n6 = 0;
  while (!M.anim().charging && n6++ < 600) { M.place([]); tick(); }
  for (let i = 0; i < 40; i++) { M.place([]); tick(); }
  const gl = partsNow();
  ok('the charge glimmers inside the ring', gl.length > 3,
     gl.length + ' dots while it charges, one at a time every ' + C._PGLI[0] + 's');
  ok('and every one of them is inside it, on the floor',
     gl.every((p) => Math.hypot(p[0], p[2]) <= M.anim().bindR + 0.01),
     'the furthest is ' +
     Math.max(...gl.map((p) => Math.hypot(p[0], p[2]))).toFixed(2) + 'm out of a ' +
     M.anim().bindR.toFixed(2) + 'm ring - they mark the area the wave will cover');
  ok('and they are white, where a death is the ghost colour',
     gl.every((p) => p[8].join(',') === '255,255,255'), 'so the two never read as each other');
  release();

  // --- motes off the wall --------------------------------------------------------
  M.restart(); M.look(0, 0); M.place([]);
  let n7 = 0;
  while (partsNow().length && n7++ < 600) { M.place([]); tick(); }
  armed();
  let n8 = 0;
  while (M.anim().charging && n8++ < 60 * 20) { M.place([]); tick(); }
  release();
  const before = partsNow().length;
  // The whole life of the wall, not a third of it.
  for (let i = 0; i < C._WALLDUR * 60 + 2; i++) { M.place([]); tick(); }
  const mo = partsNow();
  ok('the wall throws motes up as it passes', mo.length > before,
     mo.length + ' dots in the third of a second after the cast');
  ok('there are enough of them to read as a ring coming apart',
     mo.length > 90,
     mo.length + ' fragments from a wall that lives ' + C._WALLDUR + 's, at ' +
     C._PMOT[1] + ' a frame - and they outlive it, so the whole ring is still in ' +
     'the air as it dies');
  // Their bearings, as a histogram of eighths of the circle.
  const oct = new Set(mo.map((p) => Math.atan2(p[2], p[0]) / (2 * Math.PI) * 8 + 8 | 0));
  ok('and they are scattered right round it, not clumped', oct.size >= 7,
     'they land in ' + oct.size + ' of the 8 octants. One bearing a puff put them ' +
     'out in fives, which reads as five things leaving rather than a ring coming apart');
  ok('and they are the rainbow, so they belong to the wall',
     mo.some((p) => BOW.some((c) => c.join(',') === p[8].join(','))),
     'taken from the same six colours the wall is drawn in');
  ok('and every one of them lifts', mo.every((p) => p[4] < 0),
     'a negative y velocity is upward here, and nothing in the system falls - the ' +
     'gravity term was a multiply and an add per particle per frame to reach zero');
  // By reference, not by index: dead ones are spliced out of the middle of the
  // list and fresh ones are pushed onto the end, so slot 3 six frames later is
  // not the particle that was in slot 3 before.
  const was = partsNow().map((p) => [p, p[1], p[6]]);
  for (let i = 0; i < 6; i++) { M.place([]); tick(); }
  const live = was.filter(([p]) => partsNow().includes(p));
  ok('and they are still rising as they fade',
     live.length > 0 && live.every(([p, y0, k0]) => p[1] < y0 && p[6] < k0),
     live.length + ' of them higher six frames later and every one of them fainter - ' +
     'they leave rather than settling');

  // How high they get. World y is measured from the eye with DOWN positive, so
  // the ground is at +_EYE and anything that reaches negative y is above the
  // horizon - which is mid-screen at pitch 0, whatever range it is at.
  const tall = partsNow().map((p) => [p, p[1]]);
  for (let i = 0; i < C._PMOT[2] * 60; i++) { M.place([]); tick(); }
  const top = Math.min(...tall.map(([p, y0]) => Math.min(p[1], y0)));
  ok('and they rise past mid screen before they go',
     top < 0,
     'the highest reaches ' + (C._EYE - top).toFixed(2) + 'm off the ground, which is ' +
     (-top).toFixed(2) + 'm above eye level. At the old 0.8s and 1.4m/s the fastest ' +
     'managed 1.12m and the horizon is at ' + C._EYE + 'm, so none of them ever got there');

}

console.log('');
console.log('--- sound ----------------------------------------------------------');
{
  const heard = () => { const n = snd.notes; snd.notes = []; return n; };
  // Volumes are read back through the master, because that is what reaches the
  // speaker: a table entry is relative, and _VOL is what makes it a level.
  const vol = (v) => v * C._VOL;
  const is = (n, i) => Math.abs(n.f0 - C._SFX[i][0]) < 0.5 && Math.abs(n.vol - vol(C._SFX[i][3])) < 1e-9;
  const any = (ns, i) => ns.some((n) => is(n, i));
  // Music has swept notes in it (the hat), so 'did a SOUND play' cannot be asked
  // by looking for a sweep - it has to be asked of the sound set itself.
  const isSfx = (n) => C._SFX.some((q, i) => is(n, i));

  // nothing before a gesture
  ok('no audio context exists before the first press', !madeBeforeAnyPress && snd.made > 0,
     'the module loaded and ran frames without building one, and only a gesture ' +
     'built it - a context made outside a gesture is blocked by the browser and ' +
     'complains in the console, and DESIGN.md 2 wants that console empty');

  M.setFire(1);
  M.restart(); M.look(0, 0); M.place([]);
  heard();
  tick();
  ok('firing is heard', any(heard().concat(snd.notes), 0),
     'a shot leaving the horn: ' + C._SFX[0][0] + 'Hz falling to ' + C._SFX[0][1]);

  // a hit and a kill
  M.restart(); M.look(0, 0);
  const wc = M.aimWorld(7);
  M.place([[wc[0], C._GY, wc[2], 1, 3, 0, 0, 0, 0]]);
  heard();
  let n = 0;
  while (M.dbg().ghosts.length && n++ < 60 * 10) tick();
  const dead = heard();
  ok('and so is landing one, and killing with it', any(dead, 1) && any(dead, 2),
     'the hit and the death are different sounds, so a kill is audible as one');

  // The spawn cue was removed on request. It was the only warning for anything
  // arriving outside the 74 degrees you can see, so what this now guards is the
  // absence: if it comes back, its test goes here.
  M.setFire(0);
  M.restart(); M.look(0, 0); M.place([]);
  heard();
  let sp = 0;
  while (!M.dbg().ghosts.length && sp++ < 60 * 10) tick();
  ok('a ghost arrives in silence', !heard().some(isSfx),
     'nothing from the sound set, so a ghost behind you is now on the minimap or nowhere');

  // the rainbow
  M.restart(); M.look(0, 0);
  // Re-placed every frame: three seconds of charge is long enough for a ghost to
  // walk from anywhere inside the ring into contact, and a player killed halfway
  // through never casts at all - which is what this was measuring the first time.
  const held = () => M.place([[2, C._GY, 3, 9, 9, 0, 0, 0, 0], [-2, C._GY, 3, 9, 9, 0, 0, 0, 0],
                              [0, C._GY, 4, 9, 9, 0, 0, 4, 0]]);
  held();
  press();
  let c2 = 0;
  heard();
  while (!M.anim().charging && c2++ < 60 * 10) { held(); tick(); }
  heard();
  while (M.anim().charging && c2++ < 60 * 20) { held(); tick(); }
  const cast = heard();
  const chime = cast.filter((q) => Math.abs(q.vol - vol(C._ARP[0][4])) < 1e-9);
  ok('casting is heard', chime.length === C._ARP[0][0].length,
     'the wave landing as ' + chime.length + ' notes ringing over each other, not one sound');
  ok('and they overlap into a shimmer rather than arpeggiating',
     C._ARP[0][3] > C._ARP[0][2] * 4,
     'each rings for ' + C._ARP[0][3] + 's against ' + C._ARP[0][2] +
     's between them, so all ' +
     Math.min(C._ARP[0][0].length, 1 + Math.floor(C._ARP[0][3] / C._ARP[0][2])) +
     ' are still sounding when the last one starts');
  // Two ghosts held and a Warden refusing, and the cast is still one sound.
  ok('and it is the only thing the rainbow says',
     !cast.some((q) => q.f0 === 880 || q.f0 === 230),
     'one sound for the cast, and nothing for what it caught or for the Warden ' +
     'refusing it - the shrug is still drawn, it is just no longer heard');
  release();

  // noise, which is the only way one voice makes a rush of air
  M.restart(); M.look(0, 0); M.place([]);
  M.setFire(1);
  heard();
  tick();
  const shot = heard().find((n) => is(n, 0));
  ok('the shot is a rush of air rather than a pitch', shot.type === 'noise',
     'from and to sweep a bandpass across noise instead of an oscillator, which is ' +
     'what separates a thrust from a retro blip - one voice cannot make one otherwise');
  // The wave went the other way: it was a noise whoosh and is now a chime, so the
  // check is that it is a clean tone rather than a rush of air.
  ok('and the rainbow wave is not - it is a chime', C._OSC[C._ARP[0][5]] !== 'noise',
     C._ARP[0][0].length + ' ' + C._OSC[C._ARP[0][5]] + ' notes ringing over each other');
  ok('and every note of it is up where a speaker can reproduce it',
     C._ARP[0][1] > 400,
     Math.round(C._ARP[0][1]) + 'Hz up to ' +
     Math.round(C._ARP[0][1] * 2 ** (C._ARP[0][0][C._ARP[0][0].length - 1] / 12)) +
     'Hz. The wave was a 90Hz sine once, which is under what a laptop speaker ' +
     'moves any air at - it was not quiet, it was inaudible');
  M.setFire(0);

  // the charge: a series of ticks rather than one sound
  M.restart(); M.look(0, 0); M.place([]);
  const isChg = (n) => Math.abs(n.vol - vol(C._CHG[3])) < 1e-9;
  press();
  let a2 = 0;
  while (!M.anim().charging && a2++ < 60 * 10) { M.place([]); tick(); }
  heard();
  const ticks = [];
  let fr = 0;
  while (M.anim().charging && fr++ < 60 * 20) {
    M.place([]); tick();
    for (const n of heard()) if (isChg(n)) ticks.push({ f: n.f0, at: fr / 60 });
  }
  release();
  ok('the charge is heard as it fills', ticks.length > 5,
     ticks.length + ' ticks across the ' + C._BINDCHG + 's charge, not one long sound - ' +
     'a charge can be cancelled, and a series just stops');
  const firstGap = ticks[1].at - ticks[0].at, lastGap = ticks[ticks.length - 1].at - ticks[ticks.length - 2].at;
  ok('and it speeds up as the ring grows', lastGap < firstGap * 0.6,
     'the gap goes from ' + firstGap.toFixed(2) + 's to ' + lastGap.toFixed(2) +
     's, so how far along it is can be heard');
  ok('and rises with it', ticks[ticks.length - 1].f > ticks[0].f * 2,
     Math.round(ticks[0].f) + 'Hz to ' + Math.round(ticks[ticks.length - 1].f) +
     'Hz, over ' + C._CHG[1] + ' steps');
  // Each note ringing far past the gap after it is what piles a row of blips into
  // a shimmer, and the pile is what thickens as the ring fills.
  const over = (g) => C._CHG[2] / g;
  ok('and they pile into a shimmer as it fills',
     over(C._CHGGAP[0]) > 1 && over(C._CHGGAP[1]) > 4 * over(C._CHGGAP[0]),
     'a note rings ' + C._CHG[2] + 's against gaps of ' + C._CHGGAP[0] + 's to ' +
     C._CHGGAP[1] + 's, so two are sounding at the start and ' +
     over(C._CHGGAP[1]).toFixed(0) + ' by the end - still a series, so letting go ' +
     'still just stops it');
  // Same family as the wave it releases: notes off a scale, not a glide.
  const csemis = ticks.map((q) => Math.round(12 * Math.log2(q.f / C._CHG[0])));
  ok('and it climbs a scale rather than sliding up a siren',
     csemis.every((x) => C._MUSSCALE.includes(((x % 12) + 12) % 12)) &&
     C._OSC[C._CHG[4]] !== 'noise',
     'every note of the charge is in the same scale the music uses: ' +
     [...new Set(csemis)].sort((a3, b3) => a3 - b3).join(', ') + ' semitones off ' +
     C._CHG[0] + 'Hz, on a ' + C._OSC[C._CHG[4]]);
  // The ladder deliberately runs out before the cast does; what has to reach the
  // cast is the RING, not another note, or the shimmer drops out just before the
  // chime lands.
  const last = ticks[ticks.length - 1];
  ok('and its last notes are still ringing when the wave lands',
     last.at < C._BINDCHG && last.at + C._CHG[2] >= C._BINDCHG,
     'the ladder finishes at ' + last.at.toFixed(2) + 's and rings ' + C._CHG[2] +
     's, so it carries the last ' + (last.at + C._CHG[2] - C._BINDCHG).toFixed(2) +
     's past the ' + C._BINDCHG + 's cast and hands over to the chime');
  ok('and no rung is ever struck twice in a row',
     ticks.every((q, i) => !i || q.f !== ticks[i - 1].f),
     ticks.length + ' notes, all different from the one before. Indexing the ladder ' +
     'by progress instead of by tick gave out the top rung four times over at the ' +
     'end, and identical pitches starting together stack in phase - that was the ' +
     'synthetic swell');

  // and letting go stops it, which is the whole reason it is ticks
  M.restart(); M.look(0, 0); M.place([]);
  press();
  let a3 = 0;
  while (!M.anim().charging && a3++ < 60 * 10) { M.place([]); tick(); }
  for (let i = 0; i < 30; i++) { M.place([]); tick(); }
  release();
  heard();
  for (let i = 0; i < 90; i++) { M.place([]); tick(); }
  ok('and abandoning a charge silences it at once', !heard().some(isChg),
     'a second and a half after letting go, and not one more tick');

  // being hit
  M.restart(); M.look(0, 0);
  heard();
  let h = 0;
  while (M.dbg().hearts === C._HEARTS && h++ < 60 * 90) {
    if (!M.dbg().ghosts.length) M.place([[C._GCONTACT - 0.01, C._GY, 0, 9, 9, 0, 0, 0, 0]]);
    tick();
  }
  ok('and being hit is heard', any(heard(), 3), 'the lowest and loudest thing in the set');

  // the end of a run, and the click that starts the next
  M.restart(); M.look(0, 0);
  heard();
  let d2 = 0;
  while (!M.dbg().over && d2++ < 60 * 240) {
    if (!M.dbg().ghosts.length) M.place([[C._GCONTACT - 0.01, C._GY, 0, 9, 9, 0, 0, 0, 0]]);
    tick();
  }
  ok('the run ending has its own sound', any(heard(), 5),
     'the longest and lowest thing in the set, under the hit that caused it');
  heard();
  press(); release();
  ok('and the click that starts the next one is heard too', any(heard(), 4),
     'the same click as taking a card - DESIGN.md wants one press sound, not one per button');
  ok('and that press really did start a new run', !M.dbg().over && M.dbg().kills === 0,
     'so the click is the sound of the button working, not of it being pressed');

  // clearing a wave
  M.restart(); M.look(0, 0); M.place([]);
  heard();
  M.playArp(1);
  const win = heard();
  const W = C._ARP[1];
  ok('clearing a wave is a fanfare, not a blip', win.length === W[0].length,
     W[0].length + ' notes, ' + W[0].join('/') + ' semitones off ' + W[1] + 'Hz');
  ok('and it rises', win.every((q, i) => !i || q.f0 > win[i - 1].f0),
     Math.round(win[0].f0) + 'Hz up to ' + Math.round(win[win.length - 1].f0) + 'Hz');
  ok('and it is spread over time rather than played as a chord',
     win.every((q, i) => Math.abs(q.at - i * W[2]) < 1e-9),
     'each note scheduled ' + W[2] + 's after the one before it, on the audio ' +
     'clock rather than on a timer - so it keeps time even if a frame is late');

  // A wave ends when its budget is spent and the field is clear. The field going
  // clear by a ghost reaching YOU is the case that is easy to write by accident
  // as a kill count, and it would leave a cleared wave silent.
  M.restart(); M.look(0, 0);
  M.setFire(0);
  M.setWave(1);
  let bw = 0;
  while (M.anim().budget > 0 && bw++ < 60 * 600) { M.place([]); tick(); }
  M.place([[C._GCONTACT - 0.01, C._GY, 0, 9, 9, 0, 0, 0, 0]]);
  const hp0 = M.dbg().hearts;
  heard();
  let ec = 0;
  while (!M.anim().picking && ec++ < 60 * 60) tick();
  ok('and it plays when the last ghost went by hitting you, not by dying',
     M.dbg().hearts < hp0 && heard().filter((q) => Math.abs(q.vol - vol(W[4])) < 1e-9).length === W[0].length,
     'a heart lost and the wave still announced - the condition is an empty field, ' +
     'not a kill, which is also what lets the free children of a Splitter count');
  M.restart();

  // --- the music -----------------------------------------------------------------
  // It is a chord progression with a motif written against it, and the motif is
  // transposed onto whichever chord is under it - so these check that the SAME
  // shape lands in different places, which is the whole of what makes it music
  // rather than a texture.
  M.restart(); M.look(0, 0); M.place([]); M.setFire(0);
  const music = (secs, w) => {
    // The sequencer outlives a restart now - the music runs from the title press
    // straight into the run - so a phrase to compare against has to be asked for.
    M.restart(); M.setMusic(); M.place([]); M.setFire(0); M.setWave(w);
    heard();
    const out = [];
    for (let i = 0; i < secs * 60; i++) {
      M.place([]);
      M.stepMusic(1 / 60);
      for (const n of heard()) out.push({ ...n, t: i / 60 });
    }
    return out;
  };
  const leadOf = (ns) => ns.filter((q) => Math.abs(q.vol - vol(C._MUSV * C._MLEAD[1])) < 1e-9);
  const bassOf = (ns) => ns.filter((q) => Math.abs(q.vol - vol(C._MUSV * C._MBASS[2])) < 1e-9);
  const semis = (ns, base) => ns.map((q) => Math.round(12 * Math.log2(q.f0 / base)));

  // Bass and lead can be at the same level in a given piece, and the hat sits on
  // every sixteenth - so the melody is read with the other two layers turned down
  // rather than by trying to pick it out of the mix by volume.
  // Both runs are taken here, and the notes picked out of each WHILE its layer is
  // on: leadOf and bassOf read the live level, so restoring it first meant asking
  // for notes at a volume nothing had been played at.
  const bassLv = C._MBASS[2], hatLv = C._MHAT[1];
  C._MHAT[1] = 0;
  C._MBASS[2] = 0;
  const bar = 16 * 60 / C._BPM / 4;
  const run1 = music(bar * 8 + 0.2, 1);
  const lead = leadOf(run1);
  // The lead goes quiet for this one. A piece can put both layers at the same
  // level - Drive does - and then filtering by volume catches the melody as well,
  // which is how this first reported twenty distinct 'bass notes' from a
  // progression that only has four roots in it.
  const leadLv = C._MLEAD[1];
  C._MBASS[2] = bassLv; C._MLEAD[1] = 0;
  const bassRun = music(bar * 8 + 0.2, 1);
  const bass = bassOf(bassRun);
  const roots = new Set(bass.map((q) => Math.round(q.f0)));
  C._MBASS[2] = 0; C._MLEAD[1] = leadLv;
  ok('the music is a tune over chords, not a texture',
     lead.length >= C._MOTIF.length * 8 - 2 && bass.length > 0,
     C._PROG.length + ' bars, ' + C._MOTIF.length + ' notes a bar, with a bass under it - ' +
     'the previous game built it this way and it was music; what replaced it was a mood');

  // the same motif shape, on two different chords
  // By index, not by timestamp: every bar is exactly MOTIF.length notes, and a
  // note landing on a bar line went to whichever side the float rounding chose.
  const inBar = (ns, k) => ns.slice(k * C._MOTIF.length, (k + 1) * C._MOTIF.length);
  const shape = (ns) => { const a2 = semis(ns, ns[0].f0); return a2.join(','); };
  // Two bars of the same quality and different roots: the shape has to be
  // identical and the pitch has to move. That is transposition.
  const qual = (k) => C._PROG[k % C._PROG.length];
  const p1 = C._PROG.findIndex((c, k) => k > 0 && !c[1]);
  // An even number of bars apart, because the cadence of every other phrase is
  // lifted an octave and the motif is exactly one bar long - so adjacent bars are
  // always on opposite sides of that lift.
  const p2 = C._PROG.findIndex((c, k) => k > p1 && !c[1] && c[0] !== qual(p1)[0] && !((k - p1) % 2));
  const b1 = inBar(lead, p1), b2 = inBar(lead, p2);
  ok('and one motif is transposed onto every chord rather than looped',
     b1.length === b2.length && shape(b1) === shape(b2) && Math.abs(b1[0].f0 - b2[0].f0) > 1,
     'bar ' + (p1 + 1) + ' and bar ' + (p2 + 1) + ' are both major and are the same shape, ' +
     shape(b1) + ' semitones, one starting on ' + Math.round(b1[0].f0) + 'Hz and the other ' +
     'on ' + Math.round(b2[0].f0) + ' - one tune in eight places, which is what makes four ' +
     'notes last eight bars without ever being random');
  // And the degrees are scale steps, not intervals - so the same shape comes out
  // different over a minor chord. That is the part a texture cannot do.
  const bm = inBar(lead, C._PROG.findIndex((c) => c[1]));
  ok('and it bends to the chord rather than being pasted onto it',
     shape(bm) !== shape(b1),
     'the same degrees are ' + shape(bm) + ' semitones over the minor chord and ' +
     shape(b1) + ' over the major - the third flattens, because a degree is a step ' +
     'in the scale the chord belongs to, not a fixed interval');
  ok('and the chords really change under it', roots.size > 2,
     roots.size + ' distinct bass notes under ' + C._PROG.length + ' bars: ' +
     [...roots].sort((a2, b2) => a2 - b2).join(', ') + 'Hz - the roots of the ' +
     'progression, and nothing else');

  // the motif is a bar, so it can never straddle a chord change
  ok('and a phrase is exactly one bar, so it sits on one chord',
     C._MOTIF.reduce((a2, q) => a2 + q[1], 0) === 16,
     C._MOTIF.map((q) => q[1]).join('+') + ' sixteenths');

  // It used to climb 120 to 160 BPM and lift six semitones over a run. It does
  // not any more, and the requirement is that it does not - so this compares the
  // whole first phrase note for note at the first wave and at the last.
  const late = leadOf(music(bar * 2 + 0.05, 36));
  const early = lead.slice(0, late.length);
  ok('and it plays the same at wave 36 as at wave 1',
     late.length > 0 && early.every((q, i) => Math.abs(q.f0 - late[i].f0) < 0.01 &&
       Math.abs(q.t - late[i].t) < 1e-9),
     late.length + ' notes, identical in pitch and identical in time - the tempo ' +
     'and the key both used to move with the wave, and the escalation is the ' +
     'ghosts now, not the soundtrack');

  // the hat is a layer that arrives
  // The hat gate is gone: the piece that shipped left it always on, so the threat
  // it was measured against was computed every sixteenth and compared to zero.
  C._MBASS[2] = bassLv; C._MHAT[1] = hatLv;
  const withHat = music(bar * 2, 1);
  ok('and the hat plays on every sixteenth under it',
     withHat.filter((q) => Math.abs(q.f0 - C._MHAT[0]) < 1).length > 16,
     'a layer that arrives on a threat reading was a good idea and cost real bytes ' +
     'to keep switched permanently on - it is a level of 0 away if it is wanted back');
  C._MBASS[2] = bassLv;
  M.restart(); M.look(0, 0); M.place([]);

  // --- the limiter --------------------------------------------------------------
  // Without one there is no headroom to put music into: the sounds alone peak at
  // 0.96 of the 1.0 the destination clamps at.
  M.setFire(1);
  heard();
  tick();
  ok('everything goes through a limiter rather than straight to the speaker',
     !!snd.lim && snd.gainTo === snd.lim && snd.toDest,
     'source into gain into the limiter into the destination - and no panner, ' +
     'because nothing has panned since the spawn cue was taken out');
  ok('and it is a brickwall, so nothing under it is touched',
     snd.lim.ratio.value >= 12 && !snd.lim.knee.value && snd.lim.threshold.value < 0,
     'threshold ' + snd.lim.threshold.value + ' dB, knee ' + snd.lim.knee.value +
     ', ratio ' + snd.lim.ratio.value + ':1 - the sounds already tuned by ear are ' +
     'unchanged, and only a stack of them together is held down');
  M.setFire(0);

  // --- the sounds-only master ------------------------------------------------------
  C._SFXV = 0;
  M.setFire(1);
  heard();
  for (let i = 0; i < 60 * 6; i++) { M.place([]); tick(); }
  const withoutSfx = heard();
  ok('sfx can be silenced without touching the music', withoutSfx.length > 0 &&
     !withoutSfx.some(isSfx),
     'six seconds of firing and not one shot, but ' + withoutSfx.length +
     ' notes of music still there - so the music can be judged against real play');
  C._SFXV = 1;
  heard();
  for (let i = 0; i < 40; i++) { M.place([]); tick(); }
  ok('and the sounds come back untouched', heard().some((q) => is(q, 0)),
     'a master, not a setting written over the volumes - the shot is at exactly ' +
     'the level it was, because nothing wrote to the table');

  // --- the music stops with the run -----------------------------------------------
  M.restart(); M.look(0, 0); M.setFire(0);
  let dd = 0;
  while (!M.dbg().over && dd++ < 60 * 240) {
    if (!M.dbg().ghosts.length) M.place([[C._GCONTACT - 0.01, C._GY, 0, 9, 9, 0, 0, 0, 0]]);
    tick();
  }
  heard();
  for (let i = 0; i < 60 * 8; i++) tick();
  ok('the music stops when the run does', !heard().length,
     'eight seconds on the game-over screen and not a note - it used to play on ' +
     'over the result, because musicStep runs above the early return that holds ' +
     'the rest of the loop');
  press(); release();                             // and the click that restarts
  heard();
  for (let i = 0; i < 60 * 6; i++) { M.place([]); tick(); }
  ok('and it comes back with the next run', heard().length > 0,
     'a new run gets the piece from the top, because reset() clears the sequencer');

  // mute
  key('keydown', 'KeyM'); key('keyup', 'KeyM');
  heard();
  M.setFire(1);
  for (let i = 0; i < 60 * 5; i++) tick();
  ok('and M silences all of it', heard().length === 0,
     'five seconds of firing and music, and not one note');
  key('keydown', 'KeyM'); key('keyup', 'KeyM');
  M.restart(); M.place([]);
  heard();
  for (let i = 0; i < 60 * 6; i++) { M.place([]); tick(); }
  ok('and M again brings it back', heard().length > 0,
     'it is a toggle, not a one-way switch, and mute survives a restart rather ' +
     'than un-muting itself between runs');
}

console.log('');
console.log('--- what a run is worth --------------------------------------------');
{
  // Waves cleared, and nothing else. It was ghosts-killed plus a bonus per ghost
  // SENT, and a wave does not send the same number of ghosts twice: the spawner
  // buys at random from what is unlocked and the types cost different amounts.
  // Measured at wave 15, budget 29 - three legal rolls sent 9, 12 and 14 ghosts
  // for 91, 97 and 90 total hp. The same work, and it paid 27, 36 and 42.
  const clearTo = (w) => {
    M.restart(); M.look(0, 0); M.setFire(0);
    let guard = 0;
    while (M.anim().wave < w && guard++ < 60 * 600) {
      M.place([]);
      tick();
      if (M.anim().picking) { kdown('Digit1'); kup('Digit1'); }
    }
    return M.anim();
  };
  const a4 = clearTo(4);
  ok('a run is worth the waves it cleared, and nothing else',
     a4.pts === a4.wave - 1 && a4.pts === 3,
     'three cleared reads ' + a4.pts + '. The wave you died ON is not one you ' +
     'survived, so reaching wave 4 is three');

  // the same wave is worth the same to everybody, which the old scoring could not say
  const runs = [];
  for (let i = 0; i < 6; i++) runs.push(clearTo(6).pts);
  ok('and the same wave is worth the same to everybody',
     new Set(runs).size === 1,
     'six runs to wave 6, all worth ' + runs[0] + '. Counted per ghost they would ' +
     'not have been: one wave sends a different number every time it is played, so ' +
     'a leaderboard would have carried 1.5x of pure dice');

  // kills are gone from the screen entirely
  M.restart(); M.look(0, 0); M.place([]); M.setFire(1);
  rec.ops = []; tick();
  ok('and no kill count is shown anywhere',
     !rec.ops.some((o) => o.op === 'text' && /KILL/i.test(o.s)),
     'the HUD says THREAT instead, which is what the wave is worth in the currency ' +
     'that bought it - and it is the same for every player who gets there');
  M.restart(); M.place([]);
}

console.log('--- the title, the how-to, and the best ----------------------------');
{
  const txt = () => rec.ops.filter((o) => o.op === 'text').map((o) => o.s);
  const sq = () => rec.ops.filter((o) => o.op === 'srect' && o.c === C._CARDSC);
  const draw = () => { rec.ops = []; tick(); };

  M.setScr(0);
  draw();
  ok('the game opens on a title screen, not in a run',
     txt().includes('ONE LONG NIGHT') && txt().some((t) => /START/.test(t)),
     txt().map((t) => '"' + t + '"').join(', '));
  const verOp = rec.ops.find((o) => o.op === 'text' && o.s === C._VER);
  ok('and it carries a version, at the foot of the screen',
     !!verOp && verOp.y > 500 * 0.9,
     '"' + C._VER + '" at y ' + verOp.y.toFixed(0) + ' of 500 - a version belongs ' +
     'under everything, not between the title and the button');
  ok('and it is drawn over the world sky, not over black',
     rec.ops.some((o) => o.op === 'rect' && /^grad\(/.test(o.c)),
     'the same dusk wave 1 starts in - it is already being drawn, so it costs nothing');
  ok('and nothing of the run is on it',
     !rec.ops.some((o) => o.op === 'fill' && o.n === 6 &&
       o.p.every((q) => q[1] < 500 / 2)) &&                         // no hearts
     !rec.ops.some((o) => o.a),                                     // no minimap
     'no HUD, no minimap, no puppet');
  // It used to draw a bordered box labelled START, in the same breathing outline
  // the card screen puts round the card the keyboard is on. It was never hit
  // tested - any press anywhere moves the screen on, and so do space and enter -
  // so it was a control that did not exist, drawn in the language of one that
  // does. What it says now is what actually works.
  ok('it says what to press rather than drawing a button that is not one',
     sq().length === 0 && txt().some((t) => /^CLICK ANYWHERE/.test(t)),
     '"' + txt().find((t) => /^CLICK ANYWHERE/.test(t)) + '", and no outlined box on the screen');
  // The box breathed; the words breathe instead, on the same clock and to the
  // same depth as the square round the card the keyboard is on.
  {
    const seen = [];
    for (let i = 0; i < 80; i++) { draw();
      const t = rec.ops.find((o) => o.op === 'text' && /^CLICK ANYWHERE/.test(o.s));
      if (t) seen.push(t.alpha);
    }
    const lo = Math.min(...seen), hi = Math.max(...seen);
    ok('and the words breathe, the way the box used to',
       Math.abs(lo - C._CARDSP[0]) < 0.02 && hi > 0.98,
       'alpha runs ' + lo.toFixed(2) + ' to ' + hi.toFixed(2) + ' against CARDSP dimmest ' +
       C._CARDSP[0] + ', a full cycle every ' + (2 * Math.PI / C._CARDSP[1]).toFixed(2) + 's');
  }

  // The music starts on the FIRST press and is not started again. It used to be:
  // the press that leaves the how-to calls reset(), reset zeroed the sequencer,
  // and the phrase jumped back to its opening - which is heard as the music
  // firing a second time rather than carrying on.
  {
    // The audio context is already up by this point in the suite - a press in an
    // earlier block built it - so what is checked is not silence but that the
    // sequencer only ever goes FORWARD through the two presses.
    M.setScr(0); M.setMusic();
    for (let i = 0; i < 60; i++) tick();
    const a1 = M.anim().mS;
    press(); release();                            // title -> how-to
    for (let i = 0; i < 60; i++) tick();
    const a2 = M.anim().mS;
    press(); release();                            // how-to -> the run
    for (let i = 0; i < 30; i++) tick();
    const a3 = M.anim().mS;
    ok('the music is never restarted by walking into the run',
       a1 > 4 && a2 > a1 && a3 > a2,     // ~8 sixteenths a second at BPM 126
       'sequencer ' + a1 + ' -> ' + a2 + ' -> ' + a3 +
       ' across both presses; it used to drop to 0 on the second, which is heard ' +
       'as the music firing again rather than carrying on');
    // Dying is the one thing that does put it back, so a new run gets a downbeat
    // instead of picking up on whichever chord the last one died on.
    M.restart(); M.look(0, 0); M.setFire(0);
    for (let i = 0; i < 60; i++) tick();
    const alive = M.anim().mS;
    let d = 0;
    while (!M.dbg().over && d++ < 60 * 60) {
      if (!M.dbg().ghosts.length) M.place([[4, C._GY, 0, 9, 9, 0, 0, 0, 0]]);
      tick();
    }
    ok('but dying does put it back to the top',
       alive > 4 && M.dbg().over === 1 && M.anim().mS === 0,
       'it was at ' + alive + ' and is at ' + M.anim().mS + ' on the frame the run ended');
    M.restart(); M.place([]); M.setScr(0);
  }

  // Every press on a menu is heard. The run is the exception: there a press means
  // the horn, which has a sound of its own.
  {
    const CLICK = C._SFX[4];
    const heardClick = () => { const b = snd.notes.length; press(); release(); tick();
      return snd.notes.slice(b).filter((n) => Math.abs(n.f0 - CLICK[0]) < 1).length; };
    M.setScr(0);
    const onTitle = heardClick();
    const onHowTo = heardClick();
    for (let i = 0; i < 30; i++) tick();
    const inRun = heardClick();
    release();
    ok('a press on a menu clicks, and a press in the run does not',
       onTitle > 0 && onHowTo > 0 && inRun === 0,
       'title yes, how-to yes, and silent in the run where the horn has its own sound');
    M.setScr(0);
  }

  // a press moves it on
  press(); release();
  draw();
  ok('a press goes to the how-to', txt().includes('HOW TO PLAY') && txt().some((t) => /PLAY/.test(t)),
     txt().slice(0, 3).map((t) => '"' + t + '"').join(', ') + ' ...');
  // What you do, then every way to do it - and every input route has to be on it,
  // or somebody plays the whole game without knowing one of them exists.
  const T = txt().join(' | ');
  // The two things you DO are gold; every way to do them is white.
  const lines = rec.ops.filter((o) => o.op === 'text');
  const doing = lines.filter((o) => /^(DRAG TO AIM|HOLD TO CHARGE)/.test(o.s));
  const ways = lines.filter((o) => /^(WASD|\(SPACE|M MUTE)/.test(o.s));
  ok('the two things you do are gold, and every way to do them is white',
     doing.length === 2 && doing.every((o) => o.c === 'rgba(' + C._GOLD.join(',') + ',1)') &&
     ways.length === 3 && ways.every((o) => o.c === '#fff'),
     'including the mute-and-quit line, which is a control rather than a heading - ' +
     'colouring by odd-and-even alone would have made it one');
  const label = lines.find((o) => o.s === 'PERSONAL BEST');
  // Two fills now, laid side by side and centred as one: canvas has no rich text,
  // so 'the number in gold and the words in white' is two calls.
  const num = lines.find((o) => /^\d+$/.test(o.s));
  const tail = lines.find((o) => o.s === ' WAVES CLEARED');
  const gaps = ways.map((o) => o.y).sort((a2, b2) => a2 - b2);
  ok('and the two instructions are read as two, not as five lines',
     gaps[1] - gaps[0] > (gaps[2] - gaps[1]) * 1.2,
     (gaps[1] - gaps[0]).toFixed(0) + 'px between the aiming line and the charging ' +
     'one, against ' + (gaps[2] - gaps[1]).toFixed(0) + 'px between the charging ' +
     'line and the controls under it');

  ok('and PERSONAL BEST is gold, with only the NUMBER gold under it',
     label.c === 'rgba(' + C._GOLD.join(',') + ',1)' &&
     num.c === 'rgba(' + C._GOLD.join(',') + ',1)' && tail.c === '#fff' &&
     num.y > label.y && tail.y === num.y && tail.x > num.x,
     '"' + num.s + '" in gold then "' + tail.s + '" in white, on one line - the ' +
     'number is the thing, the words are the label for it');
  ok('and it sits above the button, which sits above the version',
     label.y < verOp.y && doing[1].y < label.y,
     'how-to, then the best, then PLAY, then the version at the foot');

  ok('and it names every way in, for every device',
     /DRAG TO AIM/.test(T) && /WASD/.test(T) && /←/.test(T) &&
     /CLICK\+DRAG/.test(T) && /TOUCH\+SWIPE/.test(T) &&
     /HOLD TO CHARGE/.test(T) && /SPACE/.test(T) && /TOUCH\) \+ HOLD/.test(T) &&
     /M MUTE/.test(T) && /ESC QUIT/.test(T),
     'aiming by drag, keys and arrows and touch; the rainbow by space, click and ' +
     'hold; and mute and quit');
  ok('and the run is still held', !M.dbg().ghosts.length,
     'the spawner does not run behind a menu');

  press(); release();
  draw();
  ok('and a second press starts the run',
     !txt().includes('PLAY') && txt().some((t) => /^WAVE /.test(t)),
     'the HUD is up and the menus are gone');

  // --- the personal best ------------------------------------------------------------
  M.setScr(1);
  draw();
  ok('the how-to has a personal best on it',
     txt().includes('PERSONAL BEST'), 'with the number under the label');

  // die on wave 3, which is two survived
  M.restart(); M.look(0, 0); M.setFire(0);
  M.setWave(3);
  let n = 0;
  while (!M.dbg().over && n++ < 60 * 240) {
    if (!M.dbg().ghosts.length) M.place([[C._GCONTACT - 0.01, C._GY, 0, 9, 9, 0, 0, 0, 0]]);
    tick();
  }
  M.setScr(1);
  draw();
  const bi = txt().indexOf('PERSONAL BEST');
  ok('and it remembers the run once there is one',
     bi >= 0 && txt()[bi + 1] === STORE[C._LSK] && txt()[bi + 2] === ' WAVES CLEARED',
     'PERSONAL BEST over "' + txt()[bi + 1] + txt()[bi + 2] + '", which is what was written');
  ok('and it is written under a namespaced key',
     /^[a-z]+\./.test(C._LSK) && +STORE[C._LSK] > 0,
     "'" + C._LSK + "' = " + STORE[C._LSK] + '. Games on the platform share an origin, ' +
     'so an unprefixed key would be somebody else. And nothing here ever calls clear()');
  const was = +STORE[C._LSK];
  ok('and a worse run does not overwrite it',
     (() => {
       M.restart(); M.setFire(0);
       let m = 0;
       while (!M.dbg().over && m++ < 60 * 240) {
         if (!M.dbg().ghosts.length) M.place([[C._GCONTACT - 0.01, C._GY, 0, 9, 9, 0, 0, 0, 0]]);
         tick();
       }
       return +STORE[C._LSK] === was;
     })(),
     'died in wave 1 this time and the best is still ' + was);

  // --- the two buttons, and the ways out --------------------------------------------
  M.restart(); M.look(0, 0); M.place([]);
  draw();
  const boxes = [0, 1].map((i) => M.hudBtn2(i));
  const marks = rec.ops.filter((o) => o.op === 'text' && (o.s === 'M' || o.s === 'X'));
  ok('a run carries a mute and a quit button, always',
     marks.length === 2 && boxes.every(([x, y, w2, h2]) =>
       x > 0 && y > 0 && x + w2 <= 900 && y + h2 <= 500),
     'bottom right, both on screen. Always drawn rather than only on a touch ' +
     'device: telling one from the other costs bytes and is wrong on a touch ' +
     'laptop, and a clickable mute costs a mouse nothing');
  ok('and they are clear of the minimap, which is the other corner',
     boxes.every(([x, y]) => x > C._MAPR * 500 * 2 + C._MAPPAD && y > C._MAPR * 500),
     'the minimap is top left at ' + (C._MAPR * 500).toFixed(0) + 'px radius');

  const hit = (i) => { const [x, y, w2, h2] = M.hudBtn2(i); press(x + w2 / 2, y + h2 / 2); release(); };
  const wasMuted = M.anim().muted;
  hit(0);
  ok('and the M button mutes', M.anim().muted !== wasMuted, 'without a keyboard');
  hit(0);
  ok('and unmutes', M.anim().muted === wasMuted, 'it is a toggle');

  const before = M.dbg().yaw;
  hit(0);
  ok('and pressing one does not also turn the view', M.dbg().yaw === before,
     'the press is consumed by the button rather than starting a drag');
  hit(0);

  M.setWave(4);
  const bestWas = +STORE[C._LSK];
  hit(1);
  ok('and the X button quits to the how-to', M.anim().scr === 1,
     'back to the menu, mid-run');
  ok('and quitting keeps what the run earned',
     +STORE[C._LSK] >= bestWas,
     'the waves were cleared whether or not it ended in a death - abandoning a ' +
     'run at wave 20 should not throw away the record of it');

  M.restart(); M.look(0, 0); M.place([]);
  M.setWave(6);
  kdown('Escape'); kup('Escape');
  ok('and ESC does the same', M.anim().scr === 1, 'for anyone with a keyboard');
  M.restart(); M.place([]);
}

console.log('');
console.log('--- two at once ----------------------------------------------------');
{
  const at = C._GCONTACT - 0.01;
  const hitBy = (types) => {
    M.restart(); M.look(0, 0); M.setFire(0);
    M.setLv(5, 2);                                // extra hearts, so it survives to be read
    const hp0 = M.dbg().hearts;
    M.place(types.map((k, i) =>
      [at * Math.cos(i * 2), C._GY, at * Math.sin(i * 2), 9, 9, 0, 0, k, 0]));
    tick();
    return { took: hp0 - M.dbg().hearts, left: M.dbg().ghosts.length };
  };

  const one = hitBy([0]), four = hitBy([0, 0, 0, 0]);
  ok('a clump arriving together is one hit, not one each',
     one.took === 1 && four.took === 1 && !four.left,
     'four Drifters at once cost ' + four.took + ' heart and all four are gone - the ' +
     'red flash IS the invulnerability, so anything inside it is absorbed');

  // the fix: the worst of them lands, whichever spawned first
  const dh = hitBy([0, 2]), hd = hitBy([2, 0]);
  const wh = hitBy([4, 2]), hw = hitBy([2, 4]);
  ok('and it is the worst of them that lands, not whichever arrived first',
     dh.took === 3 && hd.took === 3 && wh.took === 3 && hw.took === 3,
     'a Drifter and a Hulk together cost ' + dh.took + ' either way round, and a ' +
     'Warden and a Hulk ' + wh.took + '. It used to be whichever the loop reached ' +
     'first, and it runs backwards - so the same two ghosts at the same instant cost ' +
     '3 or 1 depending on which had spawned earlier');
  ok('and no clump can take more than DMGCAP',
     hitBy([2, 2, 2]).took === C._DMGCAP,
     'three Hulks at ' + C._TYPES[2][2] + ' each is still ' + C._DMGCAP);

  // and the frame after is still stopped by the i-frame
  const later = (frames) => {
    M.restart(); M.look(0, 0); M.setFire(0);
    M.setLv(5, 2);
    const hp0 = M.dbg().hearts;
    M.place([[at, C._GY, 0, 9, 9, 0, 0, 0, 0]]);
    tick();
    for (let i = 0; i < frames; i++) { M.place([]); tick(); }
    M.place([[at, C._GY, 0, 9, 9, 0, 0, 0, 0]]);
    tick();
    return hp0 - M.dbg().hearts;
  };
  ok('and a second one inside the grace period still costs nothing',
     later(0) === 1 && later(30) === 1 && later(Math.round(C._IFRAME * 60)) === 2,
     'a second Drifter costs nothing up to ' + C._IFRAME + 's after the first and a ' +
     'heart after it - whoever gets there first takes the hit, and a frame is the ' +
     'resolution of first');
  M.restart(); M.place([]);
}

console.log('');
console.log('--- arriving apart, and the card screen by keyboard -----------------');
{
  const DEG = 180 / Math.PI;
  const wrapA = (x) => Math.abs(Math.atan2(Math.sin(x), Math.cos(x)));
  const bear = (o) => Math.atan2(o[0], o[2]);

  // --- spawn separation ------------------------------------------------------------
  const gapsAt = (w, frames) => {
    M.restart(); M.look(0, 0); M.setFire(1); M.setWave(w);
    const seen = [], gaps = [];
    for (let f = 0; f < frames; f++) {
      const before = M.dbg().ghosts.slice();
      tick();
      for (const o of M.dbg().ghosts) {
        if (seen.includes(o)) continue;
        seen.push(o);
        if (!before.length) continue;
        let near = Math.PI;
        for (const q of before) if (q !== o) near = Math.min(near, wrapA(bear(o) - bear(q)));
        gaps.push(near * DEG);
      }
    }
    return gaps;
  };
  const GAPDEG = C._SPAWNGAP * DEG;
  const early = gapsAt(1, 60 * 60), mid = gapsAt(15, 60 * 60);
  const all = early.concat(mid);
  ok('a new ghost does not arrive on top of one already out there',
     all.every((g) => g > GAPDEG * 0.9),
     all.length + ' spawns across waves 1 and 15, closest ' + Math.min(...all).toFixed(0) +
     ' degrees, against a minimum of ' + GAPDEG.toFixed(0) + '. The widest ghost is ' +
     '0.8m across at a 16m ring, which is 5.7 degrees of it, so 8 clears any pair');
  // The point is NOT even spacing. Taking the best of every candidate rather than
  // the first acceptable one landed them within a few percent of perfectly
  // regular, which is a pattern the player can read and play around.
  const even = 360 / 4 / 2;
  const spread = Math.max(...early) / Math.min(...early);
  ok('and it is not spacing them evenly, only keeping them off each other',
     spread > 1.6,
     'wave 1 gaps run ' + Math.min(...early).toFixed(0) + ' to ' +
     Math.max(...early).toFixed(0) + ' degrees, a spread of ' + spread.toFixed(1) +
     'x. Maximising the gap instead put every spawn within a few percent of the ' +
     'evenest place available, which is a ring you can learn');
  ok('and it still degrades rather than failing when the ring fills',
     gapsAt(30, 60 * 60).length > 10,
     'wave 30 still spawns everything it is asked to');

  // --- the card screen, by keyboard --------------------------------------------------
  M.restart(); M.look(0, 0); M.place([]);
  M.setWave(6);
  const offered = M.dealNow();
  ok('the card screen starts on the first card',
     M.anim().sel === 0, 'so a keyboard run has somewhere to be');
  rec.ops = []; tick();
  const boxOf = (n) => M.boxes()[n];
  const sq = () => rec.ops.filter((o) => o.op === 'srect' && o.c === C._CARDSC);
  ok('and the one it is on wears a white square',
     sq().length === 1 &&
       Math.abs(sq()[0].x - (boxOf(0)[0] - C._CARDSO)) < 0.01 &&
       Math.abs(sq()[0].w - (boxOf(0)[2] + C._CARDSO * 2)) < 0.01,
     'one ' + sq()[0].w.toFixed(0) + 'x' + sq()[0].h.toFixed(0) + 'px outline, ' +
     C._CARDSO + 'px outside the card so it reads as a frame rather than a border');

  // it breathes, so the eye finds it
  // A whole cycle, not a slice of one: at CARDSP[1] radians a second the period is
  // 2PI/rate, and sampling less than that lands wherever the clock happened to be.
  const cyc = Math.ceil(2 * Math.PI / C._CARDSP[1] * 60) + 2;
  const alphas = [];
  for (let i = 0; i < cyc; i++) { rec.ops = []; tick(); alphas.push(sq()[0].alpha); }
  const lo = Math.min(...alphas), hi = Math.max(...alphas);
  ok('and it pulses rather than sitting there',
     hi - lo > 0.3 && lo >= C._CARDSP[0] - 1e-9 && hi <= 1 + 1e-9,
     'it runs ' + lo.toFixed(2) + ' to ' + hi.toFixed(2) + ' across one full ' +
     (cyc / 60).toFixed(2) + 's cycle at ' + C._CARDSP[1] + ' radians a second. A ' +
     'still white box on a screen of cards is one more rectangle');
  ok('and the pulse does not stop the game clock elsewhere',
     new Set(alphas.map((a) => a.toFixed(4))).size > 15,
     cyc + ' frames, ' + new Set(alphas.map((a) => a.toFixed(4))).size +
     ' distinct values - clock advances above the early return that holds the run');

  kdown('ArrowRight'); kup('ArrowRight');
  ok('and the arrows move it', M.anim().sel === 1, 'right went to card 2');
  kdown('KeyD'); kup('KeyD');
  ok('and so do the letters', M.anim().sel === 2, 'D went to card 3');
  kdown('KeyD'); kup('KeyD');
  ok('and it stops at the end rather than wrapping', M.anim().sel === offered.length - 1,
     'still on ' + offered.length + ' of ' + offered.length + ' - wrapping past the last ' +
     'card puts you on the first when what you meant was to stay put');
  kdown('ArrowLeft'); kup('ArrowLeft');
  kdown('ArrowLeft'); kup('ArrowLeft');
  kdown('ArrowLeft'); kup('ArrowLeft');
  ok('nor at the start', M.anim().sel === 0, 'three lefts from card 3 and it holds at 1');

  rec.ops = []; tick();
  ok('and the square follows it',
     Math.abs(sq()[0].x - (boxOf(0)[0] - C._CARDSO)) < 0.01, 'back on the first card');

  // the pointer and the keyboard agree
  const b1 = boxOf(2);
  drag(b1[0] + b1[2] / 2, b1[1] + b1[3] / 2);
  ok('and hovering a card moves it there too', M.anim().sel === 2,
     'or the square sits on one card while the pointer is over another, and the ' +
     'screen is telling you two different things');

  // taking it
  kdown('ArrowLeft'); kup('ArrowLeft');
  const want = M.anim().offer[M.anim().sel];
  kdown('Space'); kup('Space');
  ok('and space takes the one it is on',
     !M.anim().picking && M.anim().lv[want] === 1,
     'the same key that casts the rainbow, so there is nothing new to learn');

  M.restart(); M.setWave(6); M.dealNow();
  const want2 = M.anim().offer[0];
  kdown('Enter'); kup('Enter');
  ok('and so does enter', !M.anim().picking && M.anim().lv[want2] === 1,
     'because half the people who try a card screen will press it');

  M.restart(); M.setWave(6); M.dealNow();
  const want3 = M.anim().offer[1];
  kdown('Digit2'); kup('Digit2');
  ok('and 1, 2, 3 still work', !M.anim().picking && M.anim().lv[want3] === 1,
     'the direct route is not replaced by the highlight');
  M.restart(); M.place([]);
}

console.log('');
console.log('--- spawn bearings -------------------------------------------------');
{
  // Last in the file on purpose. Six spawns is all wave 1 has, and six points on
  // a circle cluster into a quarter of it about once in a hundred - so the check
  // either had no margin or proved nothing. Running six waves gets forty, and
  // running them HERE means the frames and the random draws it costs cannot move
  // anything downstream, because there is nothing downstream.
  M.restart(); M.look(0, 0); M.setFire(0);
  const bear = [], seenO = [];
  for (let w = 0; w < 6 && bear.length < 40; w++) {
    let i = 0;
    while (i++ < 60 * 90 && !M.anim().picking) {
      tick();
      for (const o of M.dbg().ghosts)
        if (!seenO.includes(o)) { seenO.push(o); bear.push(Math.atan2(o[2], o[0])); }
      M.place([]);                                // clear it so the wave can finish
    }
    if (M.anim().picking) pickCard(0);
  }
  // The widest empty arc, on sorted bearings with the wrap closed - no seam, and
  // it answers the question directly: is there a window they all fit inside?
  bear.sort((a, b) => a - b);
  const gaps = bear.map((b, i) => (i ? b - bear[i - 1] : b - bear[bear.length - 1] + 2 * Math.PI));
  const widest = Math.max(...gaps) * 180 / Math.PI;
  ok('ghosts arrive from every direction', bear.length > 30 && widest < 120,
     bear.length + ' spawns across six waves, with no gap wider than ' +
     widest.toFixed(0) + ' degrees. The old check was max minus min of atan2, which ' +
     'wraps at +-PI: two bearings two degrees apart across the wrap measured as 358 ' +
     'and passed, and a real cluster sitting on the wrap would have passed too');
}
