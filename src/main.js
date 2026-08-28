// Rainbowed - js13kGames 2026.
// One module, no abstraction layers (DESIGN.md 3).

// ---------------------------------------------------------------------------
// TUNING. Every constant from DESIGN.md 7 lives here. Flip and reload.
// ---------------------------------------------------------------------------
export const C = {
  // --- Economy -------------------------------------------------------------
  // The bar is the RAINBOW's charge, not a survival clock. It only falls while
  // the ray is channelling, and only a rainbow sphere puts it back. Runs end by
  // collision, not by the bar emptying - an empty bar means you cannot open the
  // next gate, and it is the gate that kills you.
  //
  // Denominated in SECONDS, and so is everything else. One bar is one second of
  // the beam, which is legible in a way a per-unit cost never was: count the
  // cells and you know how long you can hold the trigger.
  //
  // Mixing the two denominations is what broke twice. Charge per unit and demand
  // per unit, and the run is speed-invariant but the numbers are unreadable.
  // Charge per SECOND while spacing demand by DISTANCE, and income scales with
  // speed while cost does not - the bar stops constraining anything at the 3x
  // cap, exactly when the game should bite hardest. There is no third option
  // that keeps both, so the whole run is on the clock now and speed is only a
  // reaction-time knob.
  //
  // BEAMC is therefore the ceiling on how much shooting the game may ASK for:
  // one second of beam per second is all a player can physically supply, so the
  // block rate (SP_OBST_HI) cannot outrun it. That one line sets the late game.
  BAR: 7,             // bar capacity, in bars. One bar = one second of channelling.
  BEAMC: 1,           // bars spent per SECOND while channelling
  RGEN: 0.1667,       // and trickled back per second, always: one bar every 6s.
  RBFILL: 2,          // a rainbow sphere is worth two bars.
  RELOAD: 0.5,        // Run the bar to nothing and the ray cuts out until this
                      // much has come back. Without it, holding the trigger on an
                      // empty bar restarts the beam the instant the trickle lands
                      // a fraction of a bar, and it strobes on and off every
                      // frame - 30 times a second, measured.

  // --- Spawn spacing, in SECONDS -------------------------------------------
  // The whole game is denominated in time now: the beam costs per second, damage
  // lands per second, and things arrive per second. Nothing silently changes
  // value when the run speeds up, in either direction.
  SP_LIGHT: 2.8,      // reflector prisms
  SP_RB: 6.4,         // rainbow spheres. Flat for the whole run on purpose: income
                      // per second must not drift, or the bar means something
                      // different late than it does early. Escalation is the block
                      // rate's job, not the sphere rate's.
  SP_BOOST: 17.6,     // mystery spheres, also flat
  SP_OBST: 2.08,      // obstacles
  SP_OBST_HI: 1.4,    // and how fast they come once escalation is complete. This
                      // is THE difficulty knob now, and it did NOT move when the
                      // opening was sped up 25%: clearing one late block already
                      // takes 1.27s of beam, so anything under that is unclearable
                      // by arithmetic rather than by skill. The opening moved
                      // toward a fixed ceiling, which is what shortens the climb.
  SP_GATE: 20.8,      // gates
  SPIKE: 0.3,         // fraction of obstacles that are spiked

  // --- Speed ----------------------------------------------------------------
  SPEED: 1,           // base units per second
  STEP: 0.00606,      // LINEAR, per SECOND elapsed. Never compound.
  ENDL: 0.0016,       // extra speed per second once escalation is complete, and
  CAP2: 2.2,          // where even that stops. Past CAP the spawner divides every
                      // interval by the speed, so density holds and only the
                      // reaction window closes. CAP2 is set by the economy, not by
                      // taste: income is RGEN + RBFILL * speed / SP_RB, which
                      // reaches the 1 bar/s the beam costs at about 2.6x. Beyond
                      // that the bar would stop constraining anything again.
  CAP: 1.4,           // Deliberately low, and it is a consequence, not a taste.
                      // Spawns are spaced in seconds now, so an object crosses
                      // the screen in VIEW/speed seconds: raise the cap and the
                      // arrival rate stays put while each object clears faster,
                      // which EMPTIES the late screen. Density has to come from
                      // the interval instead, and the interval is itself capped
                      // by the bar - see BEAMC. Raising CAP thins the late game.

  // --- The world (landscape, 2D play) --------------------------------------
  // Play is flat: the unicorn moves freely in screen x and y while the level
  // scrolls right to left. Objects are still solids, but nothing is at a
  // "depth" any more - there is no lane grid, no tier and no horizon.
  VIEW: 5,            // how many track units span the screen width
  PX0: 0.16,          // where the unicorn starts, fraction of width
  PSPD: 0.75,         // player speed, fractions of screen height per second
  PAD: 0.07,          // keep-out margin at every edge, fraction of height
  OBJ: 0.22,          // object size, fraction of screen HEIGHT (landscape)
  PSZ: 0.195,         // the unicorn's own size
  // Collision is an ELLIPSE around each thing's REAL drawn extent. Using the
  // object slot (OS) as the radius made a prism's hitbox 2.7x the prism, so
  // pickups fired 31px from anything visible.
  SEP: 0.16,          // nothing spawns within this of another, fraction of height.
                      // Three spawners fire off independent distance markers, so
                      // without it two can land on the same frame at the same y.
  HITR: 0.82,         // forgiveness: fraction of the summed visual radii
  PW: 0.5,            // the unicorn's half-width, as a fraction of its size
  PH: 0.42,           // and half-height

  // --- Solid objects (DESIGN.md 5) -----------------------------------------
  // Play is flat, but each OBJECT is real geometry: vertices in its own local
  // space, projected and shaded by face normal. These two are the pitch that
  // projection uses, roughly 40 degrees.
  PCY: 0.77,          // a unit of object height, as screen-y   (cos of the pitch)
  PCZ: 0.64,          // a unit of object depth,  as screen-y   (sin of the pitch)
  // Depth foreshortening WITHIN a solid. A true 40-degree pitch (0.64) spreads
  // an animal's own length across as much screen-y as its height: the barrel is
  // 0.58 long, which at 0.64 became 27px of vertical spread against 28px of
  // actual height. The rump then sat above the head, the horn could not clear
  // the body, and the front hooves - being nearer the camera - punched 9px
  // through the lane. DESIGN.md 5 already compresses depth for the track and for
  // exactly this reason; solids get the same treatment.
  PCD: 0.32,
  LEGL: 0.225,        // length of each leg segment
  LEGY: -0.1,         // hip height relative to the barrel line
  FHZ: 0.225,          // front hip, along the body
  HHZ: -0.24,         // hind hip
  // Which way the hind knee folds, relative to FOLD. -1 matches the front legs.
  // +1 was the anatomical hock, and it threw the lower leg 74 degrees forward
  // mid-stride against the front leg's 25 - which is what read as a spider.
  HFOLD: -1,
  PHH: 0.4,           // hind pair's phase offset from the front pair, in strides
  PHS: 0.15,          // and the left/right split within each pair
  // Flying pose. horse() takes a 0..1 blend, so an animal can leave the ground
  // and return to the gallop without a visible switch.
  FLYF: 1.15,         // front legs reach forward, radians from vertical
  FLYB: -1.05,        // hind legs stream back
  FLYK: 0.12,         // how much knee fold survives. 0 is dead straight.
  // Flight was completely still - legs pinned, bob and nod switched off. It now
  // moves exactly as it does on the ground, 50% faster. Bigger amplitudes and a
  // 3x beat read as thrashing, not flying.
  FLYR: 2.25,            // flight beats per stride
  FLYW: 0.03,         // how far the legs flutter around the flying pose, radians
  FBOB: 0.01,        // body rise and fall in flight
  FBOBR: 2.25,           // ...per stride
  FNOD: 0.012,         // head nod in flight
  FNODR: 2.25,           // ...per stride
  // Bounce. The barrel bob lifts the whole animal and the head nods on top of
  // it, so the head carries both and reads as twice the motion the body has.
  // Rates are cycles per stride: the body beats twice, the head nods once.
  // The mane is generated along the neck rather than placed by hand, so it
  // follows the neck wherever the neck goes instead of being left behind.
  MANEN: 5,           // how many tufts
  MANE0: 0.3,        // where the first sits along the neck, 0 = shoulder, 1 = poll
  MANE1: 1.2,        // and the last
  MANEL: 0.1,       // how far each stands off the crest
  MANER: 0.026,        // tuft thickness
  MANEX: 0.01,           // sideways flop
  MANEP: 0.1,        // tip thickness as a fraction of the root. Low is pointy.
  FOLD: 0.5,          // how hard the knee folds mid-swing
  LEGR: [.1, .06, .04, .045, .05, .032],      // hip w,h - knee w,h - hoof w,h
  OUTL: 0.009,        // face outline width, as a fraction of the animal's scale.
                      // At this setting it is sub-pixel everywhere except the
                      // spawn edge, so canvas antialiases it into a hairline
                      // rather than a drawn border. 0 turns it off entirely.
  OUTA: 0.45,         // and its opacity. Width and alpha are separate because a
                      // thin opaque line still reads as heavy.
  ASC: 0.9,         // animals only. Compressing PCD removed the fake vertical
                      // spread that was padding their height. This is the scale
                      // that looked right in the lab, not a derived number.
  // The animal's heading, radians, about the vertical axis.
  //   0     tail-on, running directly away from the camera
  //   PI    head-on, running directly at it
  //   PI+/-0.9   three-quarter front - the face and chest read, and the body
  //              still has width. Anything near PI exactly is a narrow silhouette.
  // DEGREES of turn away from head-on. The animal is 1.27 long and 0.36 wide,
  // so its LENGTH projects length*sin(YAW) onto screen x while its WIDTH
  // projects width*cos(YAW) - and it only reads as front-facing while width
  // wins. That crossover is at 16 degrees. At 30 the length contributed 2.4x
  // more screen width than the width did, which is why it kept reading side-on
  // however far the depth cue was pushed.
  YAW: 90,
  STANCE: 0.175,       // half the distance between the left and right legs. Wider
                      // also lifts the crossover above, so it earns twice.
  // --- Obstacles, gates and the ray -----------------------------------------
  OBW: 0.12,          // obstacle width range, fractions of screen height
  OBW2: 0.255,
  OBH: 0.09,          // and height range
  OBH2: 0.315,
  OBSC: 1.32,         // and how much bigger they grow by the end. Size is the one
                      // escalation lever the beam does not cap: a wider block is
                      // harder to fly around but still takes HP hits to clear, so
                      // it adds pressure without adding energy demand. With the
                      // rate pinned at SP_OBST_HI this is what keeps the late run
                      // climbing at all. 1.32 rather than a round number: it is the
                      // point where growing blocks exactly cancel the screen the
                      // rising speed empties, so the covered area never dips. It
                      // still leaves a full-size block 111px of slot for an 82px
                      // unicorn.
  GATEW: 0.07,        // gate column width
  GATESQ: 0.11,       // panel HEIGHT; its width is the gate's, so it fills the column
  GFADE: 0.6,         // seconds a struck gate takes to clear
  GTOL: 1.7,          // how forgiving the panel is: a graze past it counts
  GCLR: 0.35,         // corridor a gate reserves either side, fraction of height
  GLEAD: 2.6,         // and the run-up it holds clear before it, in track units
  BOUNCE: 4,          // how many times the ray may turn
  PROT: 2.667,        // seconds for a prism's output to sweep a full circle
  HITT: 0.5,          // seconds between hits, so 2 a second
  FLASHHZ: 4,         // white flashes per second on whatever the ray is on. It is
                      // deliberately NOT tied to HITT or to hit points: the flash
                      // says "the ray is on this", and a steady beat reads better
                      // than a blip whose rhythm changes with what you are shooting.
  FLASHA: 0.72,       // and how white the top of each flash gets
  // --- Environment ---------------------------------------------------------
  // Three ridge layers, back to front: [base y, peak height, peak spacing,
  // scroll fraction, haze]. All four of the first numbers are fractions - of
  // screen height, height, width, and the world's own scroll. Haze is how far
  // the brown is mixed toward the sky, so distance reads as colour, not just as
  // speed: the back layer barely separates from the air behind it.
  MT: [[0.48, 0.13, 0.23, 0.10, 0.74],
       [0.66, 0.17, 0.17, 0.24, 0.44],
       [0.86, 0.23, 0.13, 0.48, 0.12]],
  MSGT: 1.1,          // how long a booster's name floats before it is gone
  MSGR: 46,           // and how far it rises while it fades, in pixels
  HP: [2, 3],         // hits to break an obstacle: plain, spiked
  // Hits land on a timer, not continuously - discrete so each one can flash.
  // Per SECOND, as specified, where the rest of the economy is per unit: at the
  // speed cap you cover 3x the ground while burning through the same slab, so
  // the ray is relatively weaker late. HITT is the constant that fixes it.
  RBS: 0.172,         // rainbow sphere radius, matched to the mystery sphere

  PR: 0.103,          // prism radius across, in object-size units
  PRY: 2.6,           // and its vertical stretch. A regular octahedron reads as
                      // wide, because height foreshortens by PCY and width does
                      // not; stretching y is what makes it a standing crystal.
  ORB: 0.172,          // mystery sphere radius - just over the prism's width

  // --- Feel and the beam ---------------------------------------------------
  GALLOP: 1.5,        // stride cycles per unit of track, so the gait tracks speed
  PARTS: 90,          // particle cap
  GRAV: 900,          // particle gravity, px/s^2
  // The beam is denominated in seconds, like everything else. What it is FOR is
  // clearing blocks and opening gates, and both are paid for out of the same bar
  // that has to be full when the next gate arrives.
  BEAMH: 0.026,        // beam half-height, fraction of screen height
  BEAMY: 0.014,        // where it leaves, relative to the unicorn centre
  BW: [2, 3, 2, 1],   // refill, slow, clear, spikes. Bad luck rarest.
  SLOW_S: 5,          // time slow: seconds
  SLOW_F: 0.55,       // speed multiplier while slowed
  LUCK_S: 8,          // spiked-everything window, seconds

  // --- Difficulty past the speed cap (DESIGN.md 7) -------------------------
  // Speed stops early and low. Escalation is spawn rate and block size instead,
  // so difficulty shifts from reflex to decision-making.
  HARD_TO: 159,       // seconds to full escalation, ramping from the first one
  // Light prisms thin out, but must stay under LIGHT/DRAIN = 3.0 or perfect play
  // goes energy-negative and the run becomes unsurvivable by arithmetic rather
  // than by skill. At 2.9 the surplus drops from +0.5 to +0.1 a lap: still
  // sustainable, with no margin left for a single mistake.
  SP_LIGHT_HI: 2.1,

  // --- Audio (DESIGN.md 9) -------------------------------------------------
  // Separate buses. One shared gain made SFX and music impossible to balance,
  // and stacking a 0.3 master under 0.3 notes is why everything was inaudible.
  VOL: 0.75,          // master
  MUS: 0.6,           // music bus
  SFX: 0.95,          // sfx bus
  BPM: 126,
};

const { min, max, round, sin, cos, abs, hypot, random, PI } = Math;
let g = document.getElementById('c').getContext('2d');
// Test seam: tools/model-lab.html redirects drawing onto its own canvases so
// it can show the real horse() at real sizes without a second copy of it.
// App-build exports are dropped, so this costs the bundle nothing.
export const setCtx = (c) => (g = c);
const cv = g.canvas;
let W, H, sky;

const resize = () => {
  const d = devicePixelRatio || 1;
  W = innerWidth; H = innerHeight;
  cv.width = W * d | 0; cv.height = H * d | 0;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  g.setTransform(d, 0, 0, d, 0, 0);
  // Landscape sky, built once per resize rather than per frame.
  sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#d3eafc');
  sky.addColorStop(0.55, '#89c0e9');
  sky.addColorStop(1, '#2f6db2');
};

// ---------------------------------------------------------------------------
// Screen mapping. Play is 2D now, so there is no depth ramp, no lane grid and
// no horizon - just pixels. The 3D that remains lives INSIDE each object, in
// the solid renderer below.
// ---------------------------------------------------------------------------
const LERP = (a, b, t) => a + (b - a) * t;
const PPU = () => W / C.VIEW;          // pixels per track unit
const OS = () => C.OBJ * H;            // object size
const PAD = () => C.PAD * H;

// ---------------------------------------------------------------------------
// State. Entities are arrays, not objects (DESIGN.md 3):
//   [x, y, type, phase, extra, w, h, fade, hp]
//   type 0 destroyed, 1 reflector prism, 2 rainbow sphere, 3 mystery sphere,
//   4 obstacle, 5 gate. Spawns push at the right edge and scroll left.
// ---------------------------------------------------------------------------
let ents, parts, dist, energy, over, px, py, vx, vy, fire, flash,
    bSlow, bLuck, nL, nR, nB, nO, nG, last, clock, dry,
    msg, msgT, msgC, msgX, msgY;                 // the floating booster name

// Personal best, in namespaced localStorage (DESIGN.md 4). Never
// localStorage.clear() - js13k entries share an origin. Private mode throws on
// access, hence the guards.
// mm:ss.mmm. The key changed with the denomination: a stored distance would
// otherwise come back as a nonsense personal best.
const MMSS = (t) => ('0' + (t / 60 | 0)).slice(-2) + ':' + ('0' + (t % 60).toFixed(3)).slice(-6);
const BEST = 'rbwd.bt';
let best = 0;
try { best = +localStorage[BEST] || 0; } catch (e) {}

const reset = () => {
  ents = []; parts = [];
  dist = 0; clock = 0; energy = C.BAR; over = 0; flash = 0; fire = 0;
  bSlow = bLuck = msgT = dry = 0;
  px = C.PX0 * W; py = H / 2; vx = vy = 0;
  SEG = [];
  nL = C.SP_LIGHT; nR = C.SP_RB; nB = C.SP_BOOST; nO = C.SP_OBST; nG = C.SP_GATE;
};

// ---------------------------------------------------------------------------
// Audio (DESIGN.md 9). ZzFX: parameter arrays, no sample data.
// The context is created on the first input, never at load - constructing one
// before a user gesture logs a warning in Chrome, and a warning is a console
// message we do not get to have.
// ---------------------------------------------------------------------------
let zzfxX;
const zzfxR = 44100;

const AC = () => { if (!zzfxX) try { zzfxX = new AudioContext(); } catch (e) {} };

const zzfxG = (q = 1, k = .05, c = 220, e = 0, t = 0, u = .1, r = 0, F = 1, v = 0, z = 0, w = 0, A = 0, l = 0, B = 0, x = 0, G = 0, d = 0, y = 1, m = 0, C2 = 0) => {
  let b = 2 * PI, H = v *= 500 * b / zzfxR ** 2, D = c *= (1 + 2 * k * random() - k) * b / zzfxR,
      Z = [], h, g2 = 0, E = 0, a = 0, n = 1, J = 0, K = 0, f = 0, p;
  e = 99 + zzfxR * e; m *= zzfxR; t *= zzfxR; u *= zzfxR; d *= zzfxR;
  z *= 500 * b / zzfxR ** 3; x *= b / zzfxR; w *= b / zzfxR; A *= zzfxR; l = zzfxR * l | 0;
  for (h = e + m + t + u + d | 0; a < h; Z[a++] = f)
    ++K % (100 * G | 0) || (
      f = r ? 1 < r ? 2 < r ? 3 < r ? sin((g2 % b) ** 3)
        : max(min(Math.tan(g2), 1), -1)
        : 1 - (2 * g2 / b % 2 + 2) % 2
        : 1 - 4 * abs(round(g2 / b) - g2 / b)
        : sin(g2),
      f = (l ? 1 - C2 + C2 * sin(2 * PI * a / l) : 1) * (0 < f ? 1 : -1) * abs(f) ** F * q *
          (a < e ? a / e : a < e + m ? 1 - (a - e) / m * (1 - y) : a < e + m + t ? y : a < h - d ? (h - a - d) / u * y : 0),
      f = d ? f / 2 + (d > a ? 0 : (a < h - d ? 1 : (h - a) / d) * Z[a - d | 0] / 2) : f
    ),
    // x is modulation, A is pitchJumpTime. Swapping these two is silent-ish
    // death for every preset with a pitch jump, and it still produces finite,
    // non-zero samples - so only an ear or a frequency test catches it.
    p = (c += v += z) * cos(x * E++),
    g2 += p + p * B * sin(a ** 5),
    n && ++n > A && (c += w, D += w, n = 0),
    !l || ++J % l || (c = D, v = H, n = n || 1);
  return Z;
};

// Exported for the frequency tests only. App-build exports are dropped, so this
// costs nothing in the bundle - verified against npm run size.
// ents and SEG are exported for the mechanics tests: reflection and gate-opening
// cannot be observed from the outside, and "it did not crash" is not a check.
export { zzfxG, horse, PARTS, LEGS };
export const dbg = () => ({ ents, SEG, energy, over, px, py });
export const place = (e) => { ents.length = 0; ents.push(...e); };

// Buses. p[0] is the preset's own volume; the bus and master scale it.
const snd = (p, bus) => {
  if (!zzfxX) return;
  const q = p.slice();
  q[0] = (q[0] ?? 1) * C.VOL * bus;
  const d = zzfxG(...q), s = zzfxX.createBufferSource(), b = zzfxX.createBuffer(1, d.length, zzfxR);
  b.getChannelData(0).set(d);
  s.buffer = b;
  s.connect(zzfxX.destination);
  s.start();
};
const sfx = (p) => snd(p, C.SFX);
const mus = (p) => snd(p, C.MUS);
const seq = (list) => list.forEach(([p, ms]) => setTimeout(() => sfx(p), ms));

// A plain sine note: the shape both the game-over fall and the conversion rise
// are built from, so the two read as inversions of one another.
const N = (f, rel = .3, dly = .2) => [1, .02, f, , .06, rel, , 1.6, , , , , , , , , dly];

const S_LIGHT = [1.1, .02, 1100, , .03, .2, , 2, , , 300, .03, , , , , .15];   // rises a third
const S_BOOST = [1.3, .02, 440, .01, .1, .3, , 1.8, , , 220, .04, .06, , , , .2];
const S_OVER  = [[N(440), 0], [N(349), 160], [N(262, .9, .35), 320]];          // three notes falling

// ---------------------------------------------------------------------------
// Music (DESIGN.md 9). Three layers: triangle bass, hat, staccato melody.
// The melody is a motif developed rather than looped - transposed onto each
// chord of an 8-bar progression, its cadence lifted an octave on alternate
// passes. Recognisable, never twice the same.
// ---------------------------------------------------------------------------
const MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10];
const PROG = [[0, 1], [10, 0], [8, 0], [10, 0], [0, 1], [8, 0], [3, 0], [7, 0]];
const MOTIF = [[4, 2], [3, 1], [2, 1], [4, 4], [7, 2], [4, 2], [2, 4]];
let mT = 0, mS = 0, mI = 0, mW = 0, mP = 0;

const nf = (ch, d, base) => {
  const sc = ch[1] ? MIN : MAJ;
  const s = sc[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
  // The key used to climb with the unicorn count; distance is the run length now.
  return base * 2 ** ((ch[0] + s + min(12, dist / 30 | 0)) / 12);
};

const music = (dt) => {
  if ((mT -= dt) > 0) return;
  const st = 60 / C.BPM / 4;                         // seconds per 16th, fixed tempo
  mT = st;
  const i = mS++, ch = PROG[(i >> 4) % 8];
  // No kick, no snare. Triangle rather than the sawtooth, at a little over half
  // the level: the saw was the part that read as synthetic.
  if (i % 4 === 0) mus([.45, .02, nf(ch, 0, 55), .01, .07, .22, 1, 1.2]);  // bass
  mus([i % 2 ? .07 : .14, .02, 7500, , .004, .03, 4, 1.8]);               // hat
  if (mW > 0) mW--;
  else {
    let [d, dur] = MOTIF[mI];
    // Each phrase is exactly one bar, so it sits on one chord. Inverting every
    // fourth phrase (d = -d) is inversion by the book, but negating around
    // degree zero drops the line under the tonic and reads as a wrong note
    // against the three phrases before it. The chord changes carry the variety.
    if (mP % 2 === 1 && mI === MOTIF.length - 1) d += 7;
    // A note has to last as long as it is written for. With one fixed envelope
    // the two four-step notes ended 0.18s early, and since the second of them
    // closes the bar, every phrase finished with a hole in it.
    const L = dur * st;
    mus([.55, .02, nf(ch, d, 440), .004, L * .25, L * .35, 1, 1.5, , , , , , , , , .13, 1, , .06]);
    mW = dur - 1;
    if (++mI >= MOTIF.length) { mI = 0; mP++; }
  }
};


// ---------------------------------------------------------------------------
// Input. Arrows or WASD to fly, Space to fire; mouse steers and the left button
// fires. Both routes write the same vx/vy/fire, so there is one movement path
// downstream however you are playing.
// ---------------------------------------------------------------------------
const KEYS = {};
const AXIS = (neg, pos) => (KEYS[pos] ? 1 : 0) - (KEYS[neg] ? 1 : 0);
let mx = 0, my = 0, mouse = 0;

const KD = (e, down) => {
  AC();
  const k = e.key.toLowerCase();
  // Swallow BEFORE the restart check. Behind it, space on the game-over screen
  // both restarted the run and scrolled the page.
  if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
  if (down && over) return reset();
  KEYS[k] = down;
};

const PT = (e) => {
  AC();
  mx = e.clientX; my = e.clientY;
  if (e.type === 'pointerdown') {
    if (over) return reset();
    mouse = 1;
  }
  if (e.type === 'pointerup') mouse = 0;
};

// ---------------------------------------------------------------------------
// Particles. [x, y, vx, vy, life, span, colour]
// ---------------------------------------------------------------------------
// One palette, held as numbers so faces can be shaded, and derived once into
// strings for everything that just needs a flat colour.
const RBV = [[255, 59, 107], [255, 149, 0], [255, 214, 10], [58, 211, 95], [34, 201, 255], [180, 92, 255]];
const CH = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
const shade = (c, k) => 'rgb(' + CH(c[0] * k) + ',' + CH(c[1] * k) + ',' + CH(c[2] * k) + ')';
const RB = RBV.map((c) => shade(c, 1));

const burst = (x, y, n, spread, col) => {
  for (let i = 0; i < n && parts.length < C.PARTS; i++)
    parts.push([
      x, y,
      (random() - 0.5) * spread,
      (random() - 0.7) * spread,
      0, 0.25 + random() * 0.35,
      col || RB[random() * 6 | 0],
    ]);
};

// ---------------------------------------------------------------------------
// Simulation. The economy still advances on DISTANCE, not wall time, so every
// cost is charged per second, and so is everything it is spent on.
// ---------------------------------------------------------------------------
const HARD = () => min(1, clock / C.HARD_TO);

const BSUM = C.BW.reduce((a, b) => a + b, 0);
const pickBoost = () => {
  let r = random() * BSUM, i = 0;
  while ((r -= C.BW[i]) >= 0) i++;
  return i;
};

// Named, because a mystery sphere that just silently changes the run tells you
// nothing about which of the four you got.
const BN = ['FULL CHARGE', 'SLOW TIME', 'PATH CLEARED', 'BAD LUCK'];

const applyBoost = (b, x, y) => {
  if (b === 0) energy = C.BAR;                            // refill the rainbow
  else if (b === 1) bSlow = C.SLOW_S;                     // slow time
  else if (b === 2) {                                     // clear the field
    for (const o of ents) if (o[2] === 4) o[2] = 0;
  } else {                                                // bad luck: spike everything
    bLuck = C.LUCK_S;
    for (const o of ents) if (o[2] === 4) o[4] = 1;
  }
  msg = BN[b]; msgT = C.MSGT; msgX = x; msgY = y;
  msgC = b === 3 ? '#ff9a9a' : '#fff';           // bad luck reads as a warning
  burst(x, y, 16, OS() * 5);
  sfx(S_BOOST);
};

// ---------------------------------------------------------------------------
// The ray. It leaves the horn travelling right and turns 90 degrees at every
// reflector prism it crosses - which is the whole point of the prisms, and the
// answer to what the beam was ever for. A gate only opens when a ray segment
// reaches the rainbow panel set into it, so a panel out of the straight line has
// to be reached around a corner.
// ---------------------------------------------------------------------------
let SEG = [];

const segDist = (sx, sy, ex, ey, qx, qy) => {
  const vx = ex - sx, vy = ey - sy, L2 = vx * vx + vy * vy || 1;
  const t = max(0, min(1, ((qx - sx) * vx + (qy - sy) * vy) / L2));
  return hypot(qx - sx - t * vx, qy - sy - t * vy);
};

// A prism's output SWEEPS - a full circle every PROT seconds, each prism at its
// own offset - so the ray leaves at any angle, not one of four. That costs the
// axis-aligned shortcut the slab test used to enjoy: it is a real slab-method
// ray-box intersection now.
let BURN = 0;                          // whatever the ray is currently resting on
const pang = (o) => (clock / C.PROT + o[3]) * 2 * PI;

// Distance along a ray to an axis-aligned box grown by the beam's half-height,
// or -1 for a miss.
const rayBox = (x, y, ux, uy, cx, cy, ex, ey) => {
  let t0 = -1e9, t1 = 1e9;
  for (const [p, d, c, e] of [[x, ux, cx, ex], [y, uy, cy, ey]]) {
    if (abs(d) < 1e-6) { if (abs(c - p) > e) return -1; continue; }
    const a = (c - e - p) / d, b = (c + e - p) / d;
    t0 = max(t0, min(a, b)); t1 = min(t1, max(a, b));
  }
  return t1 >= max(t0, 0) ? max(t0, 0) : -1;
};

const trace = () => {
  SEG = [];
  BURN = 0;
  if (!fire) return;
  const hh = C.BEAMH * H, pr = C.PR * OS();
  let x = px, y = py + C.BEAMY * H, ux = 1, uy = 0, last2 = 0;
  for (let n = 0; n < C.BOUNCE; n++) {
    let hit = 0, bd = 1e9, solid = 0;
    for (const o of ents) {
      const t = o[2];
      if (t === 1) {                                        // reflector
        if (o === last2) continue;                          // do not re-enter the one just left
        const rx = o[0] - x, ry = o[1] - y;
        const a2 = rx * ux + ry * uy, p2 = abs(ry * ux - rx * uy);
        if (a2 > pr && p2 < hh + pr && a2 < bd) { bd = a2; hit = o; solid = 0; }
      } else if ((t === 4 || t === 5) && !o[7]) {            // obstacle or gate
        const d2 = rayBox(x, y, ux, uy, o[0], t === 5 ? H / 2 : o[1],
                          o[5] / 2 + hh, o[6] / 2 + hh);
        if (d2 >= 0 && d2 < bd) { bd = d2; hit = o; solid = 1; }
      }
    }
    const far = hit ? bd : W + H;
    SEG.push([x, y, x + ux * far, y + uy * far]);
    if (!hit) break;
    if (solid) { BURN = hit; break; }                       // stopped, and burning
    x += ux * bd; y += uy * bd;
    const a3 = pang(hit);                                   // out along the prism's sweep
    ux = cos(a3); uy = sin(a3);
    last2 = hit;
  }
};

// ---------------------------------------------------------------------------
// Simulation. Entities are [x, y, type, phase, extra, w, h, fade, hp].
//   1 light prism  - reflector. extra is +1 or -1, the way it turns the ray.
//                    No collision at all; it passes behind the unicorn.
//   2 rainbow sphere - recharges the bar
//   3 mystery sphere - extra is the booster id
//   4 obstacle     - extra is the spiked flag, w/h its size. Solid.
//   5 gate         - a full column. extra is the panel's y, fade counts it out.
// ---------------------------------------------------------------------------
const step = (dt) => {
  const raw = min(C.CAP2, min(C.CAP, 1 + C.STEP * clock) + max(0, clock - C.HARD_TO) * C.ENDL);
  const spd = C.SPEED * raw * (bSlow > 0 ? C.SLOW_F : 1);
  const dd = spd * dt;
  dist += dd;
  clock += dt;

  fire = (KEYS[' '] || mouse) && !dry ? 1 : 0;
  energy = min(C.BAR, max(0, energy + dt * (C.RGEN - (fire ? C.BEAMC : 0))));
  // Latched, not a threshold: it stays out until RELOAD is back, so an empty bar
  // is a clean silence rather than a stutter.
  dry = energy <= 0 ? 1 : energy >= C.RELOAD ? 0 : dry;
  bLuck = max(0, bLuck - dt);
  bSlow = max(0, bSlow - dt);
  msgT = max(0, msgT - dt);
  flash = max(0, flash - dt * 3);
  music(dt);

  let ax = AXIS('arrowleft', 'arrowright') + AXIS('a', 'd');
  let ay = AXIS('arrowup', 'arrowdown') + AXIS('w', 's');
  if (!ax && !ay && mouse) { ax = (mx - px) / (W * 0.25); ay = (my - py) / (H * 0.25); }
  const al = hypot(ax, ay);
  if (al > 1) { ax /= al; ay /= al; }
  const sp = C.PSPD * H;
  px = min(W - PAD(), max(PAD(), px + ax * sp * dt));
  py = min(H - PAD(), max(PAD(), py + ay * sp * dt));

  const dx = dd * PPU(), os = OS(), os2 = os, ps = C.PSZ * H;
  const prx = ps * C.PW, pry = ps * C.PH;
  for (const o of ents) o[0] -= dx;
  msgX -= dx;                                    // the toast rides the world it popped in

  trace();

  // The ray burns through whatever it is resting on. Plain slabs take 2 hits,
  // spiked ones 3, at DPS a second - so cover has to be cleared, not dodged.
  if (BURN && BURN[2] === 4) {
    BURN[3] += dt;
    if (BURN[3] >= C.HITT) {
      BURN[3] -= C.HITT;
      if (--BURN[8] <= 0) {
        burst(BURN[0], BURN[1], 20, os2 * 5, '#ffe9a0');
        sfx(S_BOOST);
        BURN[2] = 0;
      } else sfx(S_LIGHT);
    }
  }

  // Gates open where a ray segment reaches the panel.
  const pr2 = C.GATESQ * H * 0.5 * C.GTOL + C.BEAMH * H;
  for (const o of ents) {
    if (o[2] !== 5 || o[7]) continue;
    if (SEG.some((g) => segDist(g[0], g[1], g[2], g[3], o[0], o[4]) < pr2)) {
      o[7] = C.GFADE;
      burst(o[0], o[4], 18, os * 5);
      sfx(S_LIGHT);
    }
  }

  for (let i = ents.length; i--;) {
    const o = ents[i], t = o[2];
    if (o[7]) { o[7] -= dt; if (o[7] <= 0) { ents.splice(i, 1); continue; } }
    if (o[0] < -W * 0.2) { ents.splice(i, 1); continue; }
    if (t === 1 || t === 0) continue;              // prisms never collide

    if (t === 4 || (t === 5 && !o[7])) {           // solid: block, do not absorb
      const hw = o[5] / 2 + prx, hy = o[6] / 2 + pry;
      const ex = px - o[0], ey = py - (t === 5 ? H / 2 : o[1]);
      if (abs(ex) < hw && abs(ey) < hy) {
        // Only spikes kill on contact. A shut gate blocks like any other slab -
        // it is being pinned against the left edge that finishes you.
        if (t === 4 && (o[4] || bLuck > 0)) { over = 1; flash = 1; }
        else {
          const ox = hw - abs(ex), oy = hy - abs(ey);
          // Push out along the shallower axis, then clamp. Being shoved into the
          // left edge is the loss: separating the boxes first left them merely
          // touching, so a later overlap test could never see the pin.
          if (ox < oy) {
            px += ex > 0 ? ox : -ox;
            if (px < PAD()) { px = PAD(); over = 1; flash = 1; }
          } else py = min(H - PAD(), max(PAD(), py + (ey > 0 ? oy : -oy)));
        }
      }
      continue;
    }
    // spheres are collected on contact
    const r = (t === 2 ? C.RBS : C.ORB) * os;
    const cx2 = (o[0] - px) / ((r + prx) * C.HITR), cy2 = (o[1] - py) / ((r + pry) * C.HITR);
    if (cx2 * cx2 + cy2 * cy2 < 1) {
      if (t === 3) applyBoost(o[4], o[0], o[1]);
      else { energy = min(C.BAR, energy + C.RBFILL); burst(o[0], o[1], 12, os * 4, '#ffe9a0'); sfx(S_LIGHT); }
      ents.splice(i, 1);
    }
  }

  for (let i = parts.length; i--;) {
    const p = parts[i];
    p[0] += p[2] * dt - dx;
    p[1] += p[3] * dt;
    p[3] += C.GRAV * dt;
    if ((p[4] += dt) > p[5]) parts.splice(i, 1);
  }

  const h = HARD(), sx = W + os, lo = PAD() + os, hi = H - PAD() - os, sep = C.SEP * H;
  const ds = min(1, C.CAP / raw);              // keeps the field's spacing fixed in SPACE
  // Half-extents each object wants kept clear. A gate owns its whole column, so
  // it reserves a corridor instead: nothing spawns beside it at any height.
  const ew = (o) => (o[2] === 5 ? C.GCLR * H : o[2] === 4 ? o[5] / 2 : o[2] === 1 ? os * C.PR : os * C.ORB);
  const eh = (o) => (o[2] === 5 ? H : o[2] === 4 ? o[6] / 2 : o[2] === 1 ? os * C.PR : os * C.ORB);
  const gLead = clock >= nG - C.GLEAD;         // hold the run-up to a gate empty
  const put = (t, b, w, hgt) => {
    if (gLead) return;
    const hw = t === 4 ? w / 2 : t === 1 ? os * C.PR : os * C.ORB;
    const hh = t === 4 ? hgt / 2 : hw;
    for (let k = 0; k < 8; k++) {
      const y = lo + random() * (hi - lo);
      if (ents.some((o) => abs(o[0] - sx) < ew(o) + hw + sep &&
                           abs((o[2] === 5 ? H / 2 : o[1]) - y) < eh(o) + hh + sep)) continue;
      ents.push([sx, y, t, random(), b, w, hgt, 0, C.HP[b ? 1 : 0]]);
      return;
    }
  };
  while (clock >= nL) { nL += LERP(C.SP_LIGHT, C.SP_LIGHT_HI, h) * ds; put(1, random() < 0.5 ? 1 : -1); }
  while (clock >= nR) { nR += C.SP_RB * ds; put(2); }
  while (clock >= nB) { nB += C.SP_BOOST * ds; put(3, pickBoost()); }
  while (clock >= nO) {
    nO += LERP(C.SP_OBST, C.SP_OBST_HI, h) * ds;
    const sc = LERP(1, C.OBSC, h) * H;
    put(4, random() < LERP(C.SPIKE, C.SPIKE * 1.8, h) ? 1 : 0,
        LERP(C.OBW, C.OBW2, random()) * sc, LERP(C.OBH, C.OBH2, random()) * sc);
  }
  while (clock >= nG) {
    nG += C.SP_GATE * ds;
    const gy = lo + random() * (hi - lo);
    ents.push([sx, H / 2, 5, 0, gy, C.GATEW * H, H * 2, 0, 0]);
  }

  if (over) {
    seq(S_OVER);
    if (clock > best) { best = clock; try { localStorage[BEST] = best; } catch (e) {} }
  }
};

// ---------------------------------------------------------------------------
// Solid renderer (DESIGN.md 5).
//
// The camera projection already existed - PCY/PCZ map an object's local 3D
// space onto the screen, and prism() culls its own back faces. What did not
// exist is a face-level painter's algorithm: prism gets away with culling alone
// because it is one convex solid, but an animal built from a dozen boxes has
// parts that occlude each other, so faces have to be sorted.
//
// Faces are gathered in world space, culled against the view direction, sorted
// far-to-near and filled flat. Hard polygon edges, no curves, no gradients.
// ---------------------------------------------------------------------------
let CO = 1, SI = 0, SX = 0, SY = 0, SS = 1, FQ = [];

const R3 = (x, y, z) => [x * CO - z * SI, y, x * SI + z * CO];   // yaw about vertical
const DEP = (p) => p[2] * C.PCY - p[1] * C.PCD;                  // distance into the screen
const PRJ = (p) => [SX + p[0] * SS, SY - (p[1] * C.PCY + p[2] * C.PCD) * SS];

// Light from above, front and left. Shading is quantised to exactly three
// steps: a smooth ramp on a low-poly solid reads as a smudge, not as facets.
const LD = [-0.5, 0.68, -0.54];

const face = (n, pts, col) => {
  if (n[2] * C.PCY - n[1] * C.PCD >= 0) return;         // pointing away from the camera
  const d = n[0] * LD[0] + n[1] * LD[1] + n[2] * LD[2];
  let z = 0;
  for (const q of pts) z += DEP(q);
  FQ.push([z, shade(col, d > 0.45 ? 1 : d > -0.12 ? 0.66 : 0.4), pts.map(PRJ)]);
};

// One primitive covers everything: a box swept along an arbitrary axis in the
// animal's sagittal plane, with independent half-width and half-height at each
// end. Taper one end to nothing and it is a cone; taper neither and it is a box.
const solid = (ax, ay, az, bx, by, bz, w0, h0, w1, h1, col) => {
  const dx = bx - ax, dy = by - ay, dz = bz - az, L = hypot(dx, dy, dz) || 1;
  const px = dx / L, py = dy / L, pz = dz / L;           // the part's own axis
  // Orthonormal frame: u is the lateral axis with the part's direction projected
  // out. Building the cross-section from dy and dz alone was fine while every
  // part lay in the sagittal plane, but a part that leans sideways then came out
  // sheared, with side-face normals that were wrong for both shading and
  // culling. For an unleaned part this reduces to exactly (1,0,0).
  let ux = 1 - px * px, uy = -px * py, uz = -px * pz;
  const uL = hypot(ux, uy, uz) || 1;
  ux /= uL; uy /= uL; uz /= uL;
  const vx = py * uz - pz * uy, vy = pz * ux - px * uz, vz = px * uy - py * ux;
  const V = (x, y, z, su, sv, w, h) => R3(x + su * w * ux + sv * h * vx,
                                          y + su * w * uy + sv * h * vy,
                                          z + su * w * uz + sv * h * vz);
  const A = (su, sv) => V(ax, ay, az, su, sv, w0, h0);
  const B = (su, sv) => V(bx, by, bz, su, sv, w1, h1);
  face(R3(ux, uy, uz), [A(1, 1), A(1, -1), B(1, -1), B(1, 1)], col);
  face(R3(-ux, -uy, -uz), [A(-1, 1), B(-1, 1), B(-1, -1), A(-1, -1)], col);
  face(R3(vx, vy, vz), [A(1, 1), B(1, 1), B(-1, 1), A(-1, 1)], col);
  face(R3(-vx, -vy, -vz), [A(1, -1), A(-1, -1), B(-1, -1), B(1, -1)], col);
  face(R3(-px, -py, -pz), [A(1, 1), A(-1, 1), A(-1, -1), A(1, -1)], col);
  face(R3(px, py, pz), [B(1, 1), B(1, -1), B(-1, -1), B(-1, 1)], col);
};

const flush = () => {
  FQ.sort((a, b) => b[0] - a[0]);
  // A dark edge on every face. It separates same-coloured parts - head from
  // neck, neck from barrel - which shading alone cannot do, and it also draws
  // each box's own three visible faces apart.
  const lw = SS * C.OUTL;
  g.lineWidth = lw;
  g.strokeStyle = 'rgba(18,14,24,' + C.OUTA + ')';
  g.lineJoin = 'round';
  for (const [, c, p] of FQ) {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) g.lineTo(p[i][0], p[i][1]);
    g.closePath();
    g.fill();
    if (lw > 0.06) g.stroke();
  }
  FQ = [];
};

// ---------------------------------------------------------------------------
// Horse / unicorn. Boxes and cones in the animal's own space: x across it, y up,
// z forward. The wild horse is desaturated grey and carries colour only in its
// mane, so conversion has somewhere to go - the unicorn gains a rainbow mane
// and a gold horn long enough to break the body silhouette.
// ---------------------------------------------------------------------------
const bd = [246, 245, 252];                        // the unicorn is white
                              // the unicorn's rainbow mane is a clear step up
const GOLD = [255, 214, 10], EYE = [58, 150, 255];        // horn gold, eyes blue

// [side, hind]. The gait pattern itself lives in C: PHH offsets the hind pair
// from the front, PHS splits left from right. 0.5 / 0.12 is a transverse gallop;
// PHH 0 bounds both pairs together, PHS 0.5 walks them alternately.
const LEGS = [[-1, 0], [-1, 1], [1, 0], [1, 1]];

// The model, as data rather than code, so tools/horse-editor.html can move a
// joint and see it immediately instead of another round of guesswork.
//   [ax,ay,az, bx,by,bz, w0,h0, w1,h1, mat, nodA,nodB, flags]
// y is measured from the barrel line and follows its bob. nodA/nodB scale the
// head nod at each end. mat: 0 body, 7 horn, otherwise RBV[mat-1] on a unicorn
// and the muted mane colour on a horse. flags: 1 = full detail only, 2 = unicorn only.
const PARTS = [
  [0, .06, -.27, 0, .12, -.55, .04, .045, .014, .015, 6, 0, 0],           // tail
  [0, 0, -.3, 0, 0, .28, .15, .16, .16, .17, 0, 0, 0],                    // barrel
  [.025, .105, .2, .075, .2737, .365, .1, .11, .075, .085, 0, 0, 1],      // neck
  [.1, .345, .345, .1, .2546, .5834, .085, .099, .055, .061, 0, 1, 1],    // head
  [.1, .3927, .4239, .1, .6829, .5077, .03, .03, .002, .002, 7, 1, 1],    // horn
  [.148, .3319, .4239, .156, .3187, .4724, .02, .02, .013, .013, 8, 1, 1],   // eye near
  [.052, .3319, .4239, .044, .3187, .4724, .02, .02, .013, .013, 8, 1, 1],   // eye far
];

const horse = (cx, gy, s, ph) => {
  const A = PI + C.YAW * PI / 180;
  CO = cos(A); SI = sin(A); SX = cx; SY = gy; SS = s * C.ASC;
  const th = ph * 2 * PI, R = C.LEGR;
  // The unicorn only ever flies, so there is one rig, not a blend between a
  // gallop and a flight pose. The gallop constants and the blend they fed went
  // with it - nothing had set fly to anything but 1 since the genre changed.
  const by = 0.56 + sin(th * C.FBOBR) * C.FBOB;
  const hb = sin(th * C.FNODR + 1) * C.FNOD;

  for (const [side, hind] of LEGS) {                // four legs, two segments each
    const L = C.LEGL;
    const t = th + ((hind ? C.PHH : 0) + (side < 0 ? C.PHS : 0)) * 2 * PI;
    // The hip angle is a fixed reach plus a flutter; the knee stays straightened
    // by FLYK off the fold the stride would otherwise have given it.
    const gb = (1 - cos(t)) * C.FOLD * (hind ? C.HFOLD : -1);
    // The flying pose flutters rather than holding rigid, with the two sides
    // offset so the pair is not in lockstep.
    const fa = (hind ? C.FLYB : C.FLYF) + sin(th * C.FLYR + (side < 0 ? 1.6 : 0)) * C.FLYW;
    const a = fa;
    const b = gb * C.FLYK;
    const lz = hind ? C.HHZ : C.FHZ;
    const x = side * C.STANCE, hy = by + C.LEGY;
    const kz = lz + sin(a) * L, ky = hy - cos(a) * L;
    solid(x, hy, lz, x, ky, kz, R[0], R[1], R[2], R[3], bd);
    solid(x, ky, kz, x, ky - cos(a + b) * L, kz + sin(a + b) * L, R[2], R[3], R[4], R[5], bd);
  }
  // Mane, swept along the neck. Reading the neck out of PARTS means moving the
  // neck carries the mane with it, which placing tufts by hand never did.
  const nk = PARTS[2];
  const ny = nk[4] - nk[1], nz = nk[5] - nk[2], nL = hypot(ny, nz) || 1;
  const vy = nz / nL, vz = -ny / nL;                 // up the crest
  // MANER is the tuft's maximum thickness, not its actual one: a tuft can never
  // be wider than the gap it has, or the mane merges into one lump. On a short
  // neck five tufts at .03 were 70% wider than their spacing.
  const gap = C.MANEN > 1 ? (C.MANE1 - C.MANE0) / (C.MANEN - 1) * nL : 1;
  const mr = min(C.MANER, gap * 0.48);
  for (let i = 0; i < C.MANEN; i++) {
    const t = C.MANEN < 2 ? 0.5 : LERP(C.MANE0, C.MANE1, i / (C.MANEN - 1));
    // One lateral line for every tuft. Lerping the neck's own x made the mane
    // fan sideways whenever the neck leaned, instead of running straight.
    const ax = (nk[0] + nk[3]) / 2;
    const ay = LERP(nk[1], nk[4], t), az = LERP(nk[2], nk[5], t);
    const h = LERP(nk[7], nk[9], t), o = h * 0.6, e = h + C.MANEL;
    solid(ax, by + ay + o * vy + hb * t, az + o * vz,
          ax - C.MANEX, by + ay + e * vy + hb * t, az + e * vz,
          mr, mr, mr * C.MANEP, mr * C.MANEP,
          RBV[1 + i % 5]);
  }

  // Order does not matter here: flush() sorts every face by depth.
  for (const q of PARTS) {
    const m = q[10];
    solid(q[0], by + q[1] + hb * q[11], q[2], q[3], by + q[4] + hb * q[12], q[5],
          q[6], q[7], q[8], q[9], m ? (m === 7 ? GOLD : m === 8 ? EYE : RBV[m - 1]) : bd);
  }
  flush();
};

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
// DESIGN.md 5: the single most important depth cue. `r` is the caster's own
// screen radius - a prism and a rainbow are nothing like the same size, and one
// shadow width for both is what made them look unmoored.
const LGT = [-0.42, 0.76, -0.5];                  // light direction, unit-ish
const PCOL = [255, 255, 255];                     // reflector prisms are white

const prism = (cx, cy, s, a) => {
  const co = cos(a), si = sin(a), r = s * C.PR, q = C.PRY, c = PCOL;
  const nl = (2 * q * q + 1) ** 0.5;
  for (let i = 0; i < 8; i++) {
    const sx = i & 1 ? 1 : -1, sy = i & 2 ? 1 : -1, sz = i & 4 ? 1 : -1;
    // Stretching y makes the face normal (sx*q, sy, sz*q). The sign-vector
    // shortcut is only exact for a REGULAR octahedron, and this is a crystal.
    const nx = sx * q * co - sz * q * si, nz = sx * q * si + sz * q * co;
    if (nz * C.PCY >= sy * C.PCZ) continue;                 // faces away from the camera
    g.fillStyle = shade(c, 0.34 + 0.66 * max(0, (nx * LGT[0] + sy * LGT[1] + nz * LGT[2]) / nl));
    g.beginPath();
    g.moveTo(cx + sx * r * co, cy - sx * r * si * C.PCZ);   // (sx, 0, 0)
    g.lineTo(cx,               cy - sy * r * q * C.PCY);    // (0, sy, 0) - stretched
    g.lineTo(cx - sz * r * si, cy - sz * r * co * C.PCZ);   // (0, 0, sz)
    g.fill();
  }
};

// A mystery sphere: a rainbow-rimmed orb with a question mark, per DESIGN.md 8.
const orb = (cx, cy, s) => {
  g.fillStyle = '#0d1b3a';
  g.beginPath(); g.arc(cx, cy, s * C.ORB, 0, 7); g.fill();
  g.lineWidth = s * 0.05;
  g.strokeStyle = RB[(dist * 4 | 0) % 6];
  g.stroke();
  g.fillStyle = '#fff';
  g.font = 'bold ' + s * 0.26 + 'px monospace';
  g.textAlign = 'center';
  // textBaseline 'middle' centres the EM BOX, and '?' has no descender, so its
  // ink ends up sitting low in the sphere. Centre the glyph's own box instead.
  const m = g.measureText('?');
  g.fillText('?', cx, cy + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
  g.textAlign = 'left';
};

// The ray, drawn a band at a time along every traced segment. One continuous
// polygon per band per segment: a row of rects put each piece at its own wave
// offset, and every boundary showed as a step.
const beam = () => {
  const hh = C.BEAMH * H, n = 6;
  for (const [sx, sy, ex, ey] of SEG) {
    const L = hypot(ex - sx, ey - sy) || 1;
    const ux = (ex - sx) / L, uy = (ey - sy) / L;      // along
    const nx = -uy, ny = ux;                           // across
    const seg = 20, dl = L / seg;
    for (let b = 0; b < n; b++) {
      const oA = -hh + (b * 2 * hh) / n, oB = oA + (2 * hh) / n * 1.08;
      g.fillStyle = shade(RBV[b], 0.7 + 0.3 * cos(dist * 12 + b));
      g.globalAlpha = 0.55 + 0.45 * (1 - b / n);
      g.beginPath();
      for (let i = 0; i <= seg; i++) {
        const d = i * dl, w = sin(d / H * 9 - dist * 14) * hh * 0.18;
        const X = sx + ux * d + nx * (oA + w), Y = sy + uy * d + ny * (oA + w);
        i ? g.lineTo(X, Y) : g.moveTo(X, Y);
      }
      for (let i = seg; i >= 0; i--) {
        const d = i * dl, w = sin(d / H * 9 - dist * 14) * hh * 0.18;
        g.lineTo(sx + ux * d + nx * (oB + w), sy + uy * d + ny * (oB + w));
      }
      g.fill();
    }
  }
  g.globalAlpha = 1;
};

// An obstacle: a slab with a lit top and a shaded right face, so it reads as
// solid rather than as a flat rectangle. Spiked ones grow teeth.
const OBC = [[92, 100, 128], [150, 60, 74]];
const GATEC = [34, 72, 46];                       // dark green

// A plated block: frame plates with nail heads, two plates crossed inside, and
// teeth on every edge when it is spiked. Obstacles and gates share it, so they
// read as the same material.
const plated = (x, y, w, h, c, spiked, fl) => {
  const pl = min(w, h) * 0.17, sz = min(w, h) * 0.15;
  g.fillStyle = shade(c, 0.5);
  g.fillRect(x, y, w, h);

  g.fillStyle = shade(c, 0.72);                   // the X, corner to corner
  const bar = (ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay, L = hypot(dx, dy) || 1;
    const nx = (-dy / L) * pl * 0.5, ny = (dx / L) * pl * 0.5;
    g.beginPath();
    g.moveTo(ax + nx, ay + ny); g.lineTo(bx + nx, by + ny);
    g.lineTo(bx - nx, by - ny); g.lineTo(ax - nx, ay - ny);
    g.fill();
  };
  bar(x + pl, y + pl, x + w - pl, y + h - pl);
  bar(x + w - pl, y + pl, x + pl, y + h - pl);

  g.fillStyle = shade(c, 1);                      // frame plates over the X ends
  g.fillRect(x, y, w, pl); g.fillRect(x, y + h - pl, w, pl);
  g.fillStyle = shade(c, 0.82);
  g.fillRect(x, y, pl, h); g.fillRect(x + w - pl, y, pl, h);

  g.fillStyle = shade(c, 1.45);                   // nail heads
  const nr = max(0.6, pl * 0.2);
  const nails = (ax, ay, dx, dy, len) => {
    const n = max(1, (len / (pl * 2.6)) | 0);
    for (let i = 0; i <= n; i++) {
      g.beginPath();
      g.arc(ax + dx * (i / n) * len, ay + dy * (i / n) * len, nr, 0, 7);
      g.fill();
    }
  };
  nails(x + pl / 2, y + pl / 2, 1, 0, w - pl);
  nails(x + pl / 2, y + h - pl / 2, 1, 0, w - pl);
  nails(x + pl / 2, y + pl / 2, 0, 1, h - pl);
  nails(x + w - pl / 2, y + pl / 2, 0, 1, h - pl);

  // Every edge gets the same tooth size and the same spacing rule, so the top row
  // cannot end up a different shape from the other three. Hoisted out of the
  // spiked branch so the flash can repaint them: a white body still wearing grey
  // spikes reads as a rendering bug.
  const edge = (ex, ey, dx, dy, len) => {
    const n = max(2, round(len / (sz * 2))), st = len / n;
    for (let i = 0; i < n; i++) {
      g.beginPath();
      g.moveTo(ex + dx * i * st, ey + dy * i * st);
      g.lineTo(ex + dx * (i + 0.5) * st + dy * sz, ey + dy * (i + 0.5) * st - dx * sz);
      g.lineTo(ex + dx * (i + 1) * st, ey + dy * (i + 1) * st);
      g.fill();
    }
  };
  const teeth = () => {
    edge(x, y, 1, 0, w);
    edge(x + w, y, 0, 1, h);
    edge(x + w, y + h, -1, 0, w);
    edge(x, y + h, 0, -1, h);
  };
  if (spiked) { g.fillStyle = shade(c, 1.25); teeth(); }
  if (fl > 0) {                                   // the ray is resting on this
    // Restore the caller's alpha rather than assuming 1. A gate stacks several
    // of these inside one fade, so resetting to 1 here left the top segment
    // faded and every segment below it fully opaque - and the flash itself has
    // to be scaled by the fade too, or it stays bright on a vanishing gate.
    const a = g.globalAlpha;
    g.globalAlpha = a * fl;
    g.fillStyle = '#fff';
    g.fillRect(x, y, w, h);
    if (spiked) teeth();
    g.globalAlpha = a;
  }
};

// A sawtooth: snaps to full white and falls away, FLASHHZ times a second.
const PULSE = () => C.FLASHA * (1 - ((clock * C.FLASHHZ) % 1));

const slab = (o) => {
  const w = o[5], h = o[6], sp = o[4] || bLuck > 0;
  plated(o[0] - w / 2, o[1] - h / 2, w, h, OBC[sp ? 1 : 0], sp, o === BURN ? PULSE() : 0);
};

// The rainbow sphere: concentric bands, no question mark. It was being drawn by
// orb() - same shape, same size, same '?' - so it was invisible as a distinct
// pickup even though it was there all along.
const rsphere = (cx, cy, s) => {
  const r = s * C.RBS;
  for (let i = 0; i < 6; i++) {
    g.fillStyle = shade(RBV[i], 0.8 + 0.25 * sin(clock * 4 - i));
    g.beginPath(); g.arc(cx, cy, r * (1 - i / 6.5), 0, 7); g.fill();
  }
};

// A gate is a column of the same plated blocks, in dark green, with one rainbow
// panel set into it. Stacking keeps the block proportions rather than stretching
// one plate the whole height of the screen.
const gate = (o) => {
  const w = o[5], q = C.GATESQ * H;
  g.globalAlpha = o[7] ? o[7] / C.GFADE : 1;
  const n = max(3, (H / (w * 1.7)) | 0), sh = H / n, fl = o[7] ? PULSE() : 0;
  for (let i = 0; i < n; i++) plated(o[0] - w / 2, i * sh, w, sh, GATEC, 0, fl);
  for (let i = 0; i < 6; i++) {
    g.fillStyle = shade(RBV[i], o[7] ? 1.4 : 0.9);
    g.fillRect(o[0] - w / 2, o[4] - q / 2 + (i * q) / 6, w, q / 6 + 1);
  }
  g.globalAlpha = 1;
};

const drawParts = () => {
  for (const p of parts) {
    g.globalAlpha = 1 - p[4] / p[5];
    g.fillStyle = p[6];
    g.fillRect(p[0] - 2, p[1] - 2, 4, 4);
  }
  g.globalAlpha = 1;
};

// Ridges. Peaks sit on a fixed lattice so a given peak keeps its height as it
// scrolls - drawing from a per-frame random would boil the whole range.
// Wrapped into [0,1). Taking the plain fractional part keeps the SIGN, so half
// the lattice came out negative - which inverted those peaks into notches cut
// downward out of the ground line and collapsed their width to almost nothing.
// That, not the noise, was what made the ranges look like scattered triangles.
const HSH = (i) => { const v = sin(i * 12.9898) * 43758.5 % 1; return v < 0 ? v + 1 : v; };
// Fading toward the SKY is what atmospheric perspective actually does, but it
// desaturates brown through grey: at 0.74 the back ridge came out blue-grey and
// stopped being a brown mountain at all. Fading toward a pale WARM grey keeps
// every layer brown and lets distance read as paleness instead.
const MTC = [124, 88, 62], HAZE = [178, 160, 150];

const ridges = () => {
  for (let L = 0; L < 3; L++) {
    const [by, amp, sp, spd, hz] = C.MT[L];
    const step = sp * W, base = by * H, off = dist * PPU() * spd;
    g.fillStyle = shade(MTC.map((v, k) => v + (HAZE[k] - v) * hz), 1);
    g.fillRect(0, base, W, H - base);           // the range's own ground
    // Peaks rise from that one line and overlap each other, which reads as a
    // range. Alternating a random high point with a random low one - the first
    // attempt - just made a row of unrelated triangles.
    const i0 = (off / step | 0) - 1;
    for (let i = i0; (i - i0) * step < W + step * 3; i++) {
      const x = i * step - off, hh = HSH(i + L * 17), wh = HSH(i + L * 53);
      const w = step * (0.7 + 0.7 * wh);
      g.beginPath();
      g.moveTo(x - w, base);
      g.lineTo(x + w * (wh - 0.5) * 0.7, base - amp * H * (0.4 + 0.6 * hh));
      g.lineTo(x + w, base);
      g.fill();
    }
  }
};

// Outlined, because the sky and the ridges behind the HUD are now light enough
// to swallow white text. The game-over panel has its own dark backing and does
// not need it.
const TXT = (v, x, y) => { g.strokeText(v, x, y); g.fillText(v, x, y); };

const hud = () => {
  const bw = (W - 24) / 2;
  g.strokeStyle = '#000';
  g.lineWidth = 3;
  g.lineJoin = 'round';
  g.fillStyle = '#000';
  g.fillRect(12, 12, bw, 14);
  const cw = bw / C.BAR;                  // one cell per bar, so it is countable
  for (let i = 0; i < C.BAR; i++) {
    const f = min(1, energy - i);
    if (f <= 0) break;
    g.fillStyle = RB[i % 6];
    g.fillRect(13 + cw * i, 12, cw * f - 2, 14);
  }
  // The bar says what it is, in the colours it is made of. Letters are placed one
  // at a time: that buys the wide tracking and the per-letter colour at once.
  g.font = '16px monospace';
  const LBL = 'RAINBOW ENERGY';
  for (let i = 0; i < LBL.length; i++) {
    g.fillStyle = RB[i % 6];
    TXT(LBL[i], 13 + i * 16, 44);
  }
  g.fillStyle = '#fff';
  TXT('TIME ' + MMSS(clock), 12, 72);
  if (best) { g.fillStyle = '#8a93b8'; TXT('BEST ' + MMSS(best), 12, 92); }

  if (msgT > 0) {                                // the booster you just picked up
    const f = msgT / C.MSGT;
    g.globalAlpha = min(1, f * 2.5);
    g.fillStyle = msgC;
    g.font = 'bold 22px monospace';
    g.textAlign = 'center';
    TXT(msg, msgX, msgY - (1 - f) * C.MSGR);
    g.textAlign = 'left';
    g.globalAlpha = 1;
  }

  let bx = W - 12;
  const chip = (t, span, col) => {
    if (t <= 0) return;
    bx -= 38;
    g.fillStyle = '#0006'; g.fillRect(bx, 38, 34, 6);
    g.fillStyle = col;     g.fillRect(bx, 38, 34 * min(1, t / span), 6);
  };
  chip(bSlow, C.SLOW_S, '#4af');
  chip(bLuck, C.LUCK_S, '#a4f');

  if (flash > 0) {
    g.globalAlpha = flash * 0.25;
    g.fillStyle = '#7b3ab6';
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
  }
  if (over) {
    g.fillStyle = '#000c';
    g.fillRect(0, H / 2 - 50, W, 100);
    g.fillStyle = '#fff';
    g.font = '28px monospace';
    const won = clock >= best && clock >= 1;
    g.fillText(MMSS(clock), 20, H / 2 - 8);
    g.font = '16px monospace';
    g.fillStyle = won ? '#ffd60a' : '#8a93b8';
    g.fillText(won ? 'NEW BEST' : 'BEST ' + MMSS(best), 20, H / 2 + 14);
    g.fillStyle = '#fff';
    g.fillText('press any key or click to run again', 20, H / 2 + 36);
  }
};

const render = () => {
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  ridges();
  const s = OS();
  for (const o of ents) {
    if (o[2] === 4) slab(o);
    else if (o[2] === 5) gate(o);
  }
  if (fire) beam();
  for (const o of ents) {
    if (o[2] === 1) prism(o[0], o[1], s, pang(o));
    else if (o[2] === 2) rsphere(o[0], o[1], s);
    else if (o[2] === 3) orb(o[0], o[1], s);
  }
  // The player: a unicorn in the flying pose, facing the way it travels.
  horse(px, py + C.PSZ * H * 0.45, C.PSZ * H, dist * C.GALLOP);
  drawParts();
  hud();
};

const frame = (t) => {
  requestAnimationFrame(frame);
  const dt = min(0.05, (t - last) / 1000) || 0;
  last = t;
  if (!over) step(dt);
  render();
};

addEventListener('resize', resize);
addEventListener('pointerdown', PT);
addEventListener('pointermove', PT);
addEventListener('pointerup', PT);
addEventListener('keydown', (e) => KD(e, 1));
addEventListener('keyup', (e) => KD(e, 0));
resize();
reset();
last = 0;
requestAnimationFrame(frame);
