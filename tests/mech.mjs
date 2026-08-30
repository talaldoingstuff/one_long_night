// The new mechanics, checked directly: reflection, gate opening, spikes, blocking.
const noop = () => {};
const anyObj = new Proxy({ width: 10 }, { get: (t, k) => (k in t ? t[k] : () => anyObj) });
const ctx = new Proxy({ canvas: { style: {} } }, { get: (t, k) => (k in t ? t[k] : () => anyObj), set: (t, k, v) => ((t[k] = v), true) });
let rafCb = null;
const L = Object.create(null);
globalThis.document = { getElementById: () => ({ getContext: () => ctx }) };
globalThis.devicePixelRatio = 1; globalThis.innerWidth = 900; globalThis.innerHeight = 500;
globalThis.localStorage = Object.create(null);
globalThis.addEventListener = (t, f) => { (L[t] ||= []).push(f); };
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; };
globalThis.AudioContext = function () { return { destination: {}, createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }), createBufferSource: () => ({ connect: noop, start: noop }) }; };

const M = await import('../src/main.js');
const C = M.C;
const fire = (t, e) => (L[t] || []).forEach((f) => f(e));
const key = (k, d) => fire(d ? 'keydown' : 'keyup', { key: k, preventDefault() {} });
let t = 0;
const tick = (n) => { for (let i = 0; i < n; i++) { t += 1000 / 60; rafCb(t); } };
const ok = (l, c, x = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${x ? '  ' + x : ''}`);
// Release the button. Leaving it down kept `fire` on for every later test.
const restart = () => {
  fire('pointerdown', { type: 'pointerdown', clientX: 10, clientY: 10 });
  fire('pointerup', { type: 'pointerup', clientX: 10, clientY: 10 });
  tick(2);
};
rafCb(0); tick(2);
const H = 500, W = 900;

// --- 1. the ray turns at a prism ------------------------------------------
{
  const d0 = M.dbg();
  // a prism dead ahead of the unicorn, turning +1
  M.place([[d0.px + 300, d0.py + C.BEAMY * H, 1, 0, 1, 0, 0, 0, 0, 0]]);
  key(' ', true); tick(2);
  const seg = M.dbg().SEG;
  key(' ', false);
  ok('the ray reaches the prism and turns', seg.length >= 2, `${seg.length} segments`);
}

// --- 1b. the world still scrolls ------------------------------------------
// bundle-test used to prove this by watching the DISTANCE readout climb. The
// gauge is a clock now, and a clock ticks whether or not the field moves, so
// the check belongs here where entity positions are visible.
{
  restart();
  const d = M.dbg();
  M.place([[800, 250, 4, 0, 0, 60, 60, 0, C.HP[0], 0]]);
  const x0 = M.dbg().ents[0][0];
  tick(30);
  const e = M.dbg().ents[0];
  ok('the field scrolls right to left', e && e[0] < x0 - 20,
     'a block moved ' + (x0 - e[0]).toFixed(0) + 'px left in 0.5s');
}

// --- 2. the outgoing direction sweeps a full circle -----------------------
{
  const dirAt = () => {
    const g2 = M.dbg().SEG;
    if (g2.length < 2) return null;
    return Math.atan2(g2[1][3] - g2[1][1], g2[1][2] - g2[1][0]);
  };
  restart();
  const d = M.dbg();
  // parked far enough right that it stays in range for a whole sweep
  const pr = [d.px + 700, d.py + C.BEAMY * H, 1, 0, 1, 0, 0, 0, 0, 0];
  M.place([pr]);
  key(' ', true); tick(2);
  const samples = [];
  // 9 samples, not 8: n samples bracket n-1 intervals, and reading 315 degrees
  // off 8 of them looked like a short sweep when it was an off-by-one.
  for (let i = 0; i < 9; i++) {
    // Re-place every sample: the spawner keeps filling the field, and one slab
    // between the unicorn and the prism blocks the ray and empties SEG.
    pr[0] = M.dbg().px + 700;
    M.place([pr]);
    tick(Math.round(60 * C.PROT / 8));
    M.place([pr]);
    tick(1);
    samples.push(dirAt());
  }
  key(' ', false);
  const good = samples.every((v) => v !== null);
  let turned = 0;
  for (let i = 1; i < samples.length && good; i++) {
    let d2 = samples[i] - samples[i - 1];
    while (d2 > Math.PI) d2 -= 2 * Math.PI;
    while (d2 < -Math.PI) d2 += 2 * Math.PI;
    turned += d2;
  }
  ok('the ray keeps leaving the prism at every angle', good, `${samples.length} samples`);
  ok(`the output sweeps a full circle in ${C.PROT}s`,
     good && Math.abs(Math.abs(turned) - 2 * Math.PI) < 1.2,
     `turned ${(turned * 180 / Math.PI).toFixed(0)} degrees over ${C.PROT}s`);
}

// --- 3. a gate opens only when the ray reaches its panel -------------------
{
  const shoot = (panelY) => {
    const d = M.dbg();
    M.place([[d.px + 400, H / 2, 5, 0, panelY, C.GATEW * H, H * 2, 0, 0, 0]]);
    key(' ', true); tick(6); key(' ', false);
    const g = M.dbg().ents.find((o) => o[2] === 5);
    return g ? g[7] > 0 : true;   // gone or fading counts as opened
  };
  const d = M.dbg();
  ok('a panel in the ray path opens the gate', shoot(d.py + C.BEAMY * H));
  ok('a panel well off the path does not', !shoot(d.py + C.BEAMY * H - H * 0.35));
}

// --- 4. obstacles block, spikes kill --------------------------------------
{
  const run = (spiked) => {
    fire('pointerdown', { type: 'pointerdown', clientX: 10, clientY: 10 });  // restart
    tick(2);
    const d = M.dbg();
    M.place([[d.px + 60, d.py, 4, 0, spiked, 120, 120, 0, C.HP[spiked ? 1 : 0], 0]]);
    tick(60);
    return M.dbg();
  };
  const blocked = run(0);
  ok('a plain obstacle blocks rather than kills', !blocked.over, 'still alive after 1s against it');
  const spiked = run(1);
  ok('a spiked obstacle ends the run on contact', spiked.over);
}

// --- 5. prisms never collide ----------------------------------------------
{
  restart();
  const d = M.dbg();
  M.place([[d.px, d.py, 1, 0, 1, 0, 0, 0, 0, 0]]);      // sitting exactly on the unicorn
  tick(30);
  const after = M.dbg();
  ok('a prism passes through the unicorn untouched',
     !after.over && after.ents.some((o) => o[2] === 1), 'not collected, not fatal');
}

// --- 6. the ray stops at solids and burns them down -----------------------
{
  const burn = (spiked) => {
    restart();
    const d = M.dbg();
    // Watch THIS slab, not "any obstacle": the spawner keeps adding more, so
    // waiting for the field to empty never terminates and the cap passes as a
    // result that looks like a measurement.
    const slab = [d.px + 620, d.py + C.BEAMY * H, 4, 0, spiked, 100, 140, 0, C.HP[spiked ? 1 : 0], 0];
    M.place([slab]);
    key(' ', true);
    let secs = 0;
    while (slab[2] === 4 && !M.dbg().over && secs < 6) { tick(6); secs += 0.1; }
    key(' ', false);
    return slab[2] === 4 ? -1 : secs;   // -1 = never broke
  };
  const plain = burn(0), spike = burn(1);
  ok('the ray breaks a plain slab in about a second', plain > 0.7 && plain < 1.5,
     `${plain.toFixed(1)}s, expected ${(C.HP[0] * C.HITT).toFixed(1)}s`);
  ok('a spiked slab takes half again as long', spike > 0 && spike > plain * 1.3 && spike < 2.2,
     `${spike.toFixed(1)}s vs ${plain.toFixed(1)}s, expected ${(C.HP[1] * C.HITT).toFixed(1)}s`);
}

// --- 7. a solid blocks the ray until it breaks ----------------------------
{
  restart();
  const d = M.dbg();
  M.place([[d.px + 250, d.py + C.BEAMY * H, 4, 0, 0, 100, 140, 0, 99, 0],
           [d.px + 600, H / 2, 5, 0, d.py + C.BEAMY * H, C.GATEW * H, H * 2, 0, 0, 0]]);
  key(' ', true); tick(30); key(' ', false);
  const st = M.dbg();
  const g2 = st.ents.find((o) => o[2] === 5);
  ok('a slab shields the gate behind it', g2 && !g2[7], 'gate still shut with cover in the way');
  const reach = Math.max(...st.SEG.map((v) => v[2]));
  ok('the ray stops at the slab', reach < d.px + 260, `reaches x=${reach.toFixed(0)}, slab at ${(d.px + 250).toFixed(0)}`);
}

// --- 8. charge trickles back on its own -----------------------------------
{
  restart();
  M.place([]);
  key(' ', true); tick(180); key(' ', false);      // burn some down
  const low = M.dbg().energy;
  tick(600);
  const back = M.dbg().energy;
  ok('the bar refills slowly with nothing collected', back > low,
     `${low.toFixed(2)} -> ${back.toFixed(2)} over 10s`);
  // Judge the rate against the beam, not against wall time: regen is per UNIT,
  // so at the speed cap you cover three times the ground in the same ten seconds
  // and it looks fast. The ratio is what stays fixed.
  ok('regen is a trickle next to what the ray costs', C.RGEN < C.BEAMC * 0.25,
     `${C.RGEN} per unit back vs ${C.BEAMC} per unit spent - ${(100 * C.RGEN / C.BEAMC).toFixed(0)}%`);
}

// --- 9. a gate is fatal, not just an obstruction ---------------------------
{
  restart();
  const d = M.dbg();
  M.place([[d.px + 40, H / 2, 5, 0, 40, C.GATEW * H, H * 2, 0, 0, 0]]);
  tick(6);
  const mid = M.dbg();
  ok('a shut gate blocks rather than killing on contact', !mid.over, 'still alive while touching it');
  ok('but it shoves you left', mid.px < d.px - 4, `x ${d.px.toFixed(0)} -> ${mid.px.toFixed(0)}`);
  let n = 6;
  while (!M.dbg().over && n < 900) { tick(2); n += 2; }
  const end = M.dbg();
  ok('and pins you against the edge in the end', end.over, `after ${(n / 60).toFixed(2)}s of being pushed`);
  ok('and never gets shoved off-screen doing it', end.px >= 0, `final x ${end.px.toFixed(1)}, left pad is ${(C.PAD * H).toFixed(0)}`);
}
