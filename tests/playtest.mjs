// How far does a run actually get?
//
// This DRIVES THE GAME rather than modelling it. The old version re-implemented
// the spawner, the roster and the cards in its own arithmetic, and then the real
// ones were tuned underneath it - so it kept answering confidently about numbers
// that had not existed for weeks. Nothing here knows a rule; it presses keys,
// points the camera and reads the same dbg() the tests read.
//
// Math.random is DESTRUCTURED at the top of main.js, so it has to be replaced
// before the import and cannot be swapped afterwards. The generator below closes
// over a mutable seed instead, which is what lets each run differ.
let seed = 1;
Math.random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

const anyObj = new Proxy({ width: 10 }, { get: (t, k) => (k in t ? t[k] : () => anyObj) });
const ctx = new Proxy({ canvas: { style: {} } }, {
  get: (t, k) => (k in t ? t[k] : () => anyObj), set: () => true,
});
globalThis.document = { getElementById: () => ({ getContext: () => ctx, style: {} }) };
globalThis.devicePixelRatio = 1; globalThis.innerWidth = 900; globalThis.innerHeight = 500;
let rafCb = null;
const L = Object.create(null);
globalThis.addEventListener = (t, f) => { (L[t] ||= []).push(f); };
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; };

// A press builds an AudioContext, and there is not one here. Silence rather than
// a recorder: this probe is about survival, and the sound tests already cover the
// sound.
const noop = () => {};
const param = { value: 0, setValueAtTime: noop, linearRampToValueAtTime: noop,
                exponentialRampToValueAtTime: noop };
const node = { frequency: param, gain: param, pan: param, Q: param, type: '', buffer: null,
               connect: () => node, start: noop, stop: noop,
               threshold: param, knee: param, ratio: param, attack: param, release: param };
globalThis.AudioContext = function () {
  return {
    currentTime: 0, sampleRate: 44100, state: 'running', destination: node, resume: noop,
    createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }),
    createGain: () => node, createStereoPanner: () => node, createOscillator: () => node,
    createBufferSource: () => node, createBiquadFilter: () => node,
    createDynamicsCompressor: () => node,
  };
};

const M = await import('../src/main.js');
const C = M.C;

let clock = 0;
const tick = () => { clock += 1000 / 60; rafCb(clock); };
const key = (type, code) => (L[type] || []).forEach((f) => f({ type, code, preventDefault() {} }));

// Off the table, not retyped. It was a literal list and went stale the moment the
// three rainbow cards became two, so every build readout below printed card names
// the game no longer has.
const NAMES = C._CARDS.map((c) => c[5]);

// --- how a player picks cards ------------------------------------------------------
// An order of preference over the seven. Whichever of the three on offer comes
// first in the list is taken.
const PLANS = {
  'all guns':   [0, 1, 4, 5, 2, 3],
  'balanced':   [4, 5, 0, 2, 1, 3],
  'rainbow':    [2, 3, 4, 5, 0, 1],
  'careless':   null,                             // takes whatever is in slot 1
};

// --- how a player aims -------------------------------------------------------------
// Three of them, because the first pass had only 'instant' and 'keyboard' and the
// truth is neither: most people will play this with a mouse, and a flick is far
// faster than KTURN. Reporting a keyboard median as THE median would have been
// the same mistake the old probe made, one level up.
const AIMS = {
  perfect:  1e9,      // turns instantly. An upper bound nobody reaches
  mouse:    9,        // radians a second - about a flick
  keyboard: 0,        // filled from C._KTURN below - a copy of it went stale the
                      // first time the real one was retuned, and the probe then
                      // reported a keyboard nobody has

};
const REACT = 0.25;   // seconds before it accepts that the nearest has changed
// Runs per (plan, aim) for the roster soak below. 'node tests/playtest.mjs 40'
// for a heavy one - the default is what a check run can afford.
const SOAK = Math.max(1, +(process.argv[2] || 7));
AIMS.keyboard = C._KTURN;

const bearing = (o) => Math.atan2(o[0], o[2]);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const run = (plan, aim, s) => {
  seed = s;
  M.restart();
  M.setFire(1);
  M.look(0, 0);
  let yaw = 0, want = 0, react = 0, held = 0;
  // What the run actually MET. Counted by object identity, because a ghost is an
  // array that lives until it dies and dbg() hands back the same one every frame -
  // counting rows would count each of them once per frame it was alive for.
  const met = new Set(), seen = [0, 0, 0, 0, 0];
  let shrugs = 0, reached15 = 0, reached20 = 0;
  // A run that hits this stopped because the clock ran out, not because it died,
  // and reporting the wave it reached as 'died at' would be a lie. The first pass
  // capped at twelve sim-minutes and every strong build reported exactly 33.
  const CAP = 60 * 60 * 40;
  let f = 0;
  for (; f < CAP && !M.dbg().over; f++) {
    const d = M.dbg(), a = M.anim();

    for (const o of d.ghosts) {
      if (!met.has(o)) { met.add(o); seen[o[7]]++; }
      // The Warden's whole rule, caught in the act: a negative hold is the ring
      // failing on it, and it is the only thing in the game that can be one.
      if (o[7] === C._WARDEN && o[8] < 0) shrugs++;
    }
    if (a.wave >= 15) reached15 = 1;
    if (a.wave >= 20) reached20 = 1;

    if (a.picking) {
      const n = PLANS[plan]
        ? Math.max(0, a.offer.findIndex((i) => i === PLANS[plan]
            .find((p) => a.offer.includes(p))))
        : 0;
      key('keydown', 'Digit' + (n + 1));
      key('keyup', 'Digit' + (n + 1));
      continue;                                   // the pick advances the wave itself
    }

    // Aim at whatever is closest: with no way to retreat, the nearest thing is
    // always the most urgent, whatever else is on the field.
    let near = null, nd = 1e9;
    for (const o of d.ghosts) {
      if (o[8] > 0) continue;                     // held by the rainbow, not a threat
      const q = Math.hypot(o[0], o[2]);
      if (q < nd) { nd = q; near = o; }
    }
    if (near) {
      if ((react -= 1 / 60) <= 0) { want = bearing(near); react = REACT; }
      const e = wrap(want - yaw);
      yaw += Math.sign(e) * Math.min(Math.abs(e), AIMS[aim] / 60);
      M.look(yaw, 0);
    }

    // The rainbow, on the one rule that matters: cast it when it is worth casting.
    // Two loose inside the ring it WILL have at full charge, or one nearly on you.
    // The game's own formula. This was BINDR * RADG ** lv - a power where the game
    // adds - which at five levels called the ring 68m instead of 16.5m, so the bot
    // thought everything on the field was inside it and cast on a condition that
    // was always true. It was not casting when it was worth casting, it was casting
    // whenever the cooldown allowed.
    const maxR = C._BINDR + C._RADG * a.lv[2];
    const inside = d.ghosts.filter((o) => o[8] <= 0 && Math.hypot(o[0], o[2]) <= maxR).length;
    if (!held && !a.bindT && (inside >= 2 || (near && nd < 4))) { key('keydown', 'Space'); held = 1; }
    if (held && a.bindT) { key('keyup', 'Space'); held = 0; }

    tick();
  }
  // wave lives on anim(), not dbg() - reading it off dbg() gave NaN for every run.
  return { waves: M.anim().wave - 1, kills: M.dbg().kills, lv: M.anim().lv.slice(),
           alive: f >= CAP, seen, shrugs, reached15, reached20 };
};

const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
const P = (x, n) => String(x).padEnd(n);
const R = (x, n) => String(x).padStart(n);

console.log('');
console.log('=== HOW FAR A RUN GETS, against the roster as it stands now ========');
console.log('');
console.log('  Driving the real loop: the real spawner, the real roster, the real');
console.log('  cards. The player aims at whatever is nearest and casts the rainbow');
console.log('  when two are inside the ring or one is within 4m.');
console.log('');
console.log('  ' + P('cards taken', 14) + P('aim', 10) + R('worst', 7) + R('median', 8) +
            R('best', 7) + R('kills', 8) + R('alive', 9) + '   what it ended up with');
for (const plan of Object.keys(PLANS)) {
  for (const aim of Object.keys(AIMS)) {
    const runs = [];
    for (let i = 0; i < 7; i++) runs.push(run(plan, aim, 1000 + i * 7919));
    const w = runs.map((r) => r.waves);
    const best = runs[w.indexOf(Math.max(...w))];
    console.log('  ' + P(plan, 14) + P(aim, 10) +
      R(Math.min(...w), 7) + R(med(w), 8) + R(Math.max(...w), 7) +
      R(med(runs.map((r) => r.kills)), 8) +
      R(runs.filter((r) => r.alive).length + '/' + runs.length, 9) + '   ' +
      best.lv.map((v, i) => (v ? NAMES[i].toLowerCase().replace('rainbow ', 'rb ') +
        ' ' + (v + C._CARDS[i][7]) : null)).filter(Boolean).join(', '));
  }
}
console.log('');
console.log('  waves = waves CLEARED, so dying in wave 2 is 1. All three take ' + REACT + 's');
console.log('  to notice that something else is now nearest; they differ only in how');
console.log('  fast they can turn to face it.');

console.log('');
console.log('  alive = runs still going when the forty-minute sim clock ran out, so');
console.log('  their wave is a floor rather than where they died.');

// --- does anybody ever meet the roster? --------------------------------------
// The reason the unlocks moved to 5/10/15/20. Content gated past where runs end
// is content nobody has, and the Warden is the one type carrying a RULE rather
// than a stat line - the bind fails on it, and DESIGN.md 7 says that has to be
// learned by watching. So the number that matters is not how many spawn, it is
// how many runs got far enough to watch one.
console.log('');
console.log('=== DOES A RUN EVER MEET THE ROSTER? ===============================');
console.log('');
const ALL = [];
for (const plan of Object.keys(PLANS))
  for (const aim of Object.keys(AIMS))
    for (let i = 0; i < SOAK; i++) ALL.push({ plan, aim, r: run(plan, aim, 50000 + ALL.length * 7919) });
const pc = (n) => (100 * n / ALL.length).toFixed(0) + '%';
console.log('  ' + ALL.length + ' runs, every card plan against every aim.');
console.log('');
console.log('    reached wave 15 (Splitter): ' + pc(ALL.filter((x) => x.r.reached15).length).padStart(5) +
            '   of runs');
console.log('    reached wave 20 (Warden):   ' + pc(ALL.filter((x) => x.r.reached20).length).padStart(5) +
            '   of runs');
console.log('    saw at least one Warden:    ' + pc(ALL.filter((x) => x.r.seen[4]).length).padStart(5) +
            '   of runs');
console.log('    SAW ONE SHRUG OFF THE RING: ' + pc(ALL.filter((x) => x.r.shrugs).length).padStart(5) +
            '   of runs - the rule being taught');
console.log('');
console.log('  ' + P('cards taken', 14) + P('aim', 10) + R('to 15', 7) + R('to 20', 7) +
            R('wardens', 9) + R('shrugs', 8));
for (const plan of Object.keys(PLANS)) {
  for (const aim of Object.keys(AIMS)) {
    const g = ALL.filter((x) => x.plan === plan && x.aim === aim).map((x) => x.r);
    console.log('  ' + P(plan, 14) + P(aim, 10) +
      R(g.filter((r) => r.reached15).length + '/' + g.length, 7) +
      R(g.filter((r) => r.reached20).length + '/' + g.length, 7) +
      R(med(g.map((r) => r.seen[4])), 9) +
      R(g.filter((r) => r.shrugs).length, 8));
  }
}
console.log('');
console.log('  wardens = the MEDIAN number one run met, so a 0 there means half the');
console.log('  runs on that line never saw one at all.');
