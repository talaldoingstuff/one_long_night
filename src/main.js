// js13kGames 2026 - stationary first-person roguelike wave shooter.
//
// Build order (DESIGN.md 15) steps 1-3. Step 2 was the renderer; step 3 is the
// core loop, ugly: camera yaw, ghosts spawning and closing, the puppet firing
// horns, collision, hearts, death, restart. No bind, no minimap, no ghost types,
// no waves, no upgrade cards, no audio - those are steps 5 to 9.
//
// CONVENTIONS, fixed here once because everything downstream depends on them:
//
//   +x right, +y DOWN, +z forward (away from the camera).
//   y-down is not a preference. DESIGN.md 5 specifies `py = y*s + h/2`, and that
//   formula only puts a model the right way up if world y already points down.
//
//   The camera sits at the origin and never translates (DESIGN.md 5). It only
//   rotates: yaw right-positive, pitch up-positive.
//
//   World units are metres. F is the focal length in metres and PX converts
//   metres to pixels, so the same scene frames identically at any window size -
//   that scale factor is the only thing added to the spec's projection.

const { min, max, abs, cos, sin, tan, atan2, hypot, random, PI } = Math;

export const C = {
  // --- Projection ------------------------------------------------------------
  F: 1.2,             // focal length, metres. With ZOOM this sets the field of
                      // view: tan(halfFOV) = W / (2 * PX * F), about 73 degrees
                      // horizontal at 16:9.
  ZOOM: 1,            // metres-to-pixels is ZOOM * screen height
  NEAR: 0.05,         // metres. Anything nearer is dropped rather than clipped.

  // --- Flat shading (DESIGN.md 5: three discrete steps, no gradients) --------
  LGT: [-0.42, -0.80, 0.43],   // above-front-left. -y is up, so this points down.
  T0: 0.18,           // dot thresholds between the three steps
  T1: 0.62,
  STEP: [0.42, 0.70, 1],       // and the three brightnesses they select

  // --- Camera (DESIGN.md 12) -------------------------------------------------
  TURN: 0.0042,       // radians per pixel of drag. THE difficulty knob: slow
                      // turning against 360 degrees of threat is the whole
                      // tension, and fast turning throws it away.
  PITCHMAX: 0.55,     // radians up and down

  // --- The world (DESIGN.md 14: dark field, dark sky, faint horizon) --------
  SKY: '#05060e',
  GND: '#0a0b10',
  HORIZ: '#1b2036',

  // --- The puppet (DESIGN.md 6) ---------------------------------------------
  // The mesh is the unicorn head and neck from the previous game, recovered from
  // git rather than redrawn: it was tuned over many rounds in a purpose-built
  // editor, and none of that work is invalidated by the genre change. Only the
  // body, legs and tail are gone - a puppet is a head and a neck.
  // Pose solved against four things at once rather than set by eye: the horn has
  // to point where the shots go, the neck's arm opening has to sit below the
  // frame so there is no hole to see into, the silhouette has to reach the right
  // side, and half the screen height has to be VISIBLE - measuring the whole
  // bounding box once scored a buried puppet at 60% tall.
  PUP: [1.4, 0.7, 0.7],        // camera-space placement, bottom-right
  PUPS: 2.3,          // scale applied to the model's own units
  PUPA: 0,            // yaw
  PUPB: -0.205,       // pitch. The pose is yours to set from the view a player
                      // sees; the servo below takes care of the aim, so nothing
                      // here has to be traded against it. The editor reads out
                      // where the neck's opening lands, as a warning, not a rule.

  // Group placement. The table is one row per part, but on a real animal the
  // head, its horn and its eyes move together - nudging the head row alone
  // leaves its own horn behind. These are applied on the way out of the table,
  // so one slider moves everything attached. Step 9 needs exactly these handles
  // anyway: recoil offsets the head group, and a blink flattens the eyes.
  HEADO: [0, -0.036, -0.064],  // head group: sideways, up, forward
  HEADS: 1,           // and its scale
  HEADR: [0, 0, 0],   // and its rotation about the joint where it meets the neck:
                      // pitch, yaw, roll. The pivot is derived from the head row
                      // rather than stored, so a retuned neck keeps the joint.
  // Eyes are discs on the flanks of the head, not rows in the table. They were
  // swept boxes, which at this size reads as a rectangular stud rather than an
  // eye. A ten-sided disc is round enough at a few pixels across and is still
  // made of the hard-edged polygons DESIGN.md 5 asks for - no rounded primitive.
  // Placed against the head rather than in model coordinates, so they stay on it
  // when the head is retuned:
  EYES: [0.028, 0.37, 0.78, 0.028, 0.005],
                      // up, how far along the head, how far out as a multiple of
                      // the head's own half-width there, radius, and how far the
                      // disc stands proud
  BODY: [246, 245, 252],       // the unicorn is white
  GOLD: [255, 214, 10],        // the horn. The brightest single thing on screen.
  IRIS: [58, 150, 255],        // blue eyes
  // The mane is placed as ONE thing: where its middle sits along the neck and how
  // much of the neck it covers. It used to be a first position and a last one,
  // which meant moving the mane took two sliders that had to be moved by the same
  // amount in the same direction, and any slip re-spread it instead.
  // The mane sits ON the top face of the neck and nowhere else. The old one was
  // swept from a point 60% of the way out from the neck's axis - inside the neck,
  // not on it - along a crest direction computed from the raw table row rather
  // than the posed one. Rebuilt: every tuft is rooted exactly on the surface the
  // neck actually has, at the width it actually has there.
  MANEN: 5,           // tufts
  MANEC: 0.45,        // where the middle of the mane sits, 0 = base, 1 = poll
  MANEW: 0.7,         // and how much of the neck it covers
  MANEH: 0.09,        // how far each tuft rises off the surface
  MANEB: 0.01,        // and how far it sweeps back while it does. A mane lies
                      // back along the neck; straight up reads as a fin.
  MANER: 0.01,        // tuft thickness - a maximum, clamped to leave a gap
  MANEG: 0.31,        // that clamp, as a fraction of a tuft's own slot
  MANEP: 0.04,        // tip thickness as a fraction of the root. Low is pointy.

  // --- Animation (DESIGN.md 6) ----------------------------------------------
  RECOIL: 0.3,        // metres the puppet kicks back along its OWN axis on firing.
                      // Measured on screen: 0.1 moves the horn tip 5px, 0.3 moves
                      // it 16px, 0.6 moves it 35px.
  RECT: 0.16,         // and the seconds it takes to ease back out
  BLINKD: 0.11,       // how long a blink lasts
  BLINK0: 2,          // and the window between them, seconds. Randomised, because
  BLINK1: 5,          // a blink on a fixed timer reads as a machine.
  BLINKS: 0.05,       // how far the eye closes: its own height, times this

  // --- Horns (DESIGN.md 6: travel time, not hitscan) ------------------------
  FIRE: 1,            // seconds between shots at fire rate level 1. The puppet
                      // fires on its own at this cadence - the trigger is not a
                      // trigger. DESIGN.md 9 makes fire rate an upgrade card, so
                      // this is the slowest the gun ever is, and the pointer is
                      // left free for aiming and, at step 5, the bind.
  HSPD: 26,           // metres per second
  HLIFE: 1.2,         // seconds before it expires
  HHIT: 0.5,          // metres, collision radius against a ghost centre
  HW: 0.035,          // the flying horn's own radius at its base
  HL: 0.3,            // and its length, metres
  HN: 7,              // sides on it. It is a cone - a horn is round - and a box
                      // swept to a point is a pyramid, which is what it was.
  CONV: 9,            // metres. Where a shot goes when nothing is under the
                      // crosshair. The muzzle sits over a metre off the camera
                      // axis - a worn puppet has to sit where a hand is - so a
                      // shot on a fixed direction crosses the crosshair's line at
                      // exactly one range. It aims at the RANGE of whatever is
                      // under the crosshair instead, and this is the fallback.
                      //
                      // The puppet itself does not move to aim. It used to turn
                      // to keep the horn on target, which worked and looked like
                      // the puppet chasing ghosts around the screen.
  AIMR: 0.2,          // how far off the middle of the screen a ghost may be and
                      // still count as the thing you are aiming at, in radians
  MUZZ: 0.9,          // metres. A viewmodel is fake-scaled: at the on-screen size
                      // this puppet wants, its horn tip is two and a half metres
                      // in front of the eye - so a ghost closer than that could
                      // not be shot AT ALL, and ghosts reach you at 1.1m. The
                      // shot starts from the point at THIS depth that projects
                      // exactly where the tip does. Simply scaling the tip toward
                      // the eye does not do that: s = F/(F+z) is a fake
                      // perspective, not a pinhole, so points on a ray through the
                      // origin do NOT share a projection - measured, that put the
                      // spawn 78px inboard of the horn.

  // --- Ghosts (DESIGN.md 7) --------------------------------------------------
  // One generator, parameters per type. Only the Drifter exists at step 3; the
  // other four are the same numbers with different values (step 7).
  ARENA: 16,          // metres. Spawn ring radius.
  GY: 0.15,           // metres below eye level they float
  GBOB: 0.09,         // bob amplitude
  GBOBR: 1.7,         // bob rate
  GCONTACT: 1.1,      // metres. Closer than this and it reaches you.
  GSEG: 22,           // segments in the blob outline
  DRIFTER: [3, 1.0, 1, 0.44, 0.16, 3, [214, 222, 240]],
                      // hp, speed, damage, radius, hem wobble, wobble freq, hue
  GFADE: 0.34,        // opacity floor: a nearly-dead ghost is this faint
  GFLASH: 0.11,       // seconds of white on a hit

  // --- Player (DESIGN.md 10) -------------------------------------------------
  HEARTS: 3,
  DMGCAP: 3,          // no single contact may take more than this
  IFRAME: 0.6,        // seconds of grace after a hit, so a clump cannot chain
  SPAWN: 1.5,         // seconds between spawns. Step 8 replaces this with waves.
};

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------
let g = document.getElementById('c').getContext('2d');
export const setCtx = (x) => (g = x);          // test seam; dropped from the app build

let W, H, PX;
const resize = () => {
  const d = min(2, devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  const cv = g.canvas;
  cv.width = W * d; cv.height = H * d;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  g.setTransform(d, 0, 0, d, 0, 0);
  PX = C.ZOOM * H;
};

// ---------------------------------------------------------------------------
// Camera. Origin-fixed; yaw then pitch, world into camera space.
// ---------------------------------------------------------------------------
let yaw = 0, pitch = 0;
let cy = 1, sy = 0, cp = 1, sp = 0;
const aim = () => { cy = cos(yaw); sy = sin(yaw); cp = cos(pitch); sp = sin(pitch); };

// Increasing yaw sends the world left, so the view turns right; increasing pitch
// sends it down, so the view looks up.
export const cam = (p) => {
  const x = p[0] * cy - p[2] * sy;
  const z = p[0] * sy + p[2] * cy;
  return [x, p[1] * cp + z * sp, z * cp - p[1] * sp];
};

// The exact inverse, for turning a camera-space point - the horn's muzzle - back
// into the world it has to fly through.
export const unCam = (p) => {
  const z = p[1] * sp + p[2] * cp;
  return [p[0] * cy + z * sy, p[1] * cp - p[2] * sp, z * cy - p[0] * sy];
};

// DESIGN.md 5: s = f/(f+z), px = x*s + w/2, py = y*s + h/2.
export const proj = (p) => {
  const s = C.F / (C.F + p[2]);
  return [p[0] * s * PX + W / 2, p[1] * s * PX + H / 2];
};

// ---------------------------------------------------------------------------
// Primitives. Each generator pushes convex polygons onto FACES.
//
// Normals are derived, never written down, and then oriented against a point the
// generator knows is inside the solid. Deriving alone is not enough: two of the
// six faces in the first box table were wound the wrong way round and came out
// facing inward, which silently inverted back-face culling. Orienting against an
// interior point makes an outward normal structural rather than something six
// hand-written vertex orders all have to get right.
// ---------------------------------------------------------------------------
export let FACES = [];
const ID = (x, y, z) => [x, y, z];             // for geometry already in the space it is wanted in

const push = (vs, col, ins) => {
  const [a, b, c] = vs;
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const L = hypot(nx, ny, nz) || 1;
  nx /= L; ny /= L; nz /= L;
  let ax = 0, ay = 0, az = 0;
  for (const v of vs) { ax += v[0]; ay += v[1]; az += v[2]; }
  const k = vs.length;
  if ((ax / k - ins[0]) * nx + (ay / k - ins[1]) * ny + (az / k - ins[2]) * nz < 0) {
    nx = -nx; ny = -ny; nz = -nz;
  }
  FACES.push([vs, nx, ny, nz, col]);
};

// A frame: an origin and three axes already scaled to the half-extents wanted.
// Every primitive takes one, so a part can be leant, twisted or squashed without
// the generator knowing anything about it.
export const frame = (o, r, u, f) => [o, r, u, f];
const at = (M, a, b, c) => [
  M[0][0] + M[1][0] * a + M[2][0] * b + M[3][0] * c,
  M[0][1] + M[1][1] * a + M[2][1] * b + M[3][1] * c,
  M[0][2] + M[1][2] * a + M[2][2] * b + M[3][2] * c,
];

const QUADS = [
  [[-1, -1, -1], [-1, 1, -1], [-1, 1, 1], [-1, -1, 1]],
  [[1, -1, -1], [1, -1, 1], [1, 1, 1], [1, 1, -1]],
  [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]],
  [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]],
  [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1]],
  [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
];
export const box = (M, col) => {
  for (const q of QUADS) push(q.map((v) => at(M, v[0], v[1], v[2])), col, M[0]);
};

// A cone: n side triangles to the apex, plus an n-gon base. Radius 1 in the
// frame's r/f plane, base at -1 along u and apex at +1, so the frame's own origin
// is inside it. Taper is the frame's job, not the generator's.
export const cone = (M, n, col, X = ID) => {
  const tip = X(...at(M, 0, 1, 0)), ring = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * PI;
    ring.push(X(...at(M, cos(a), -1, sin(a))));
  }
  const ins = X(...M[0]);
  for (let i = 0; i < n; i++) push([ring[i], tip, ring[(i + 1) % n]], col, ins);
  push(ring, col, ins);
};

// A box swept between two points with independent half-extents at each end. Taper
// one end and it is a cone; taper it almost to nothing and it is a horn. This is
// the primitive the recovered part table is expressed in, so it comes back with
// it. T maps the model's own space into the space the faces are wanted in.
//
// u is the lateral axis with the part's direction projected out of it. Building
// the cross-section from dy and dz alone was fine while every part lay in the
// sagittal plane, but a part leaning sideways then came out sheared, with side
// normals wrong for both shading and culling.
export const swept = (T, ax, ay, az, bx, by, bz, w0, h0, w1, h1, col, roll = 0) => {
  const dx = bx - ax, dy = by - ay, dz = bz - az, L = hypot(dx, dy, dz) || 1;
  const px = dx / L, py = dy / L, pz = dz / L;
  let ux = 1 - px * px, uy = -px * py, uz = -px * pz;
  const uL = hypot(ux, uy, uz) || 1;
  ux /= uL; uy /= uL; uz /= uL;
  let vx = py * uz - pz * uy, vy = pz * ux - px * uz, vz = px * uy - py * ux;
  // Roll twists the cross-section about the part's own axis. Without it the frame
  // is derived entirely from the direction, so a rolled part moves but never
  // turns - the head would lean while staying resolutely upright.
  if (roll) {
    const c2 = cos(roll), s2 = sin(roll);
    const tx = ux * c2 + vx * s2, ty = uy * c2 + vy * s2, tz = uz * c2 + vz * s2;
    vx = vx * c2 - ux * s2; vy = vy * c2 - uy * s2; vz = vz * c2 - uz * s2;
    ux = tx; uy = ty; uz = tz;
  }
  const V = (x, y, z, su, sv, w, h) => T(x + su * w * ux + sv * h * vx,
                                         y + su * w * uy + sv * h * vy,
                                         z + su * w * uz + sv * h * vz);
  const A = (su, sv) => V(ax, ay, az, su, sv, w0, h0);
  const B = (su, sv) => V(bx, by, bz, su, sv, w1, h1);
  const ins = T((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
  push([A(1, 1), A(1, -1), B(1, -1), B(1, 1)], col, ins);
  push([A(-1, 1), B(-1, 1), B(-1, -1), A(-1, -1)], col, ins);
  push([A(1, 1), B(1, 1), B(-1, 1), A(-1, 1)], col, ins);
  push([A(1, -1), A(-1, -1), B(-1, -1), B(1, -1)], col, ins);
  push([A(1, 1), A(-1, 1), A(-1, -1), A(1, -1)], col, ins);
  push([B(1, 1), B(1, -1), B(-1, -1), B(-1, 1)], col, ins);
};

// ---------------------------------------------------------------------------
// Draw. Painter's algorithm: cull what faces away, sort far to near, fill flat.
// ---------------------------------------------------------------------------
export const shade = (col, nx, ny, nz, k2 = 1) => {
  const d = nx * C.LGT[0] + ny * C.LGT[1] + nz * C.LGT[2];
  const k = C.STEP[d > C.T1 ? 2 : d > C.T0 ? 1 : 0] * k2;
  return 'rgb(' + (col[0] * k | 0) + ',' + (col[1] * k | 0) + ',' + (col[2] * k | 0) + ')';
};

// `world` false means the faces are already in camera space - the viewmodel,
// which is fixed to the camera and so is lit in camera space too. Lighting it in
// world space would make the puppet's own shading swing every time you turned,
// which is exactly the flicker DESIGN.md 6 wants avoided on the best-lit object
// in the game.
export const flush = (world = 1) => {
  const draw = [];
  for (const f of FACES) {
    const vs = world ? f[0].map(cam) : f[0];
    let near = 0, z = 0;
    for (const v of vs) { if (v[2] < C.NEAR) near = 1; z += v[2]; }
    if (near) continue;
    // Cull back faces: the camera sits at the origin, so any vertex doubles as
    // the view vector to the face.
    const n = world ? cam([f[1], f[2], f[3]]) : [f[1], f[2], f[3]];
    if (n[0] * vs[0][0] + n[1] * vs[0][1] + n[2] * vs[0][2] >= 0) continue;
    draw.push([z / vs.length, vs, shade(f[4], f[1], f[2], f[3])]);
  }
  // DESIGN.md 5 says the viewmodel is not depth sorted - meaning not sorted
  // against the world, which it never is: it is drawn afterwards, on top. Its own
  // parts still have to occlude each other, or the horn draws through the head.
  draw.sort((a, b) => b[0] - a[0]);
  for (const d of draw) {
    g.fillStyle = d[2];
    g.beginPath();
    for (const v of d[1]) {
      const p = proj(v);
      g.lineTo(p[0], p[1]);
    }
    g.fill();
  }
  FACES = [];
  return draw.length;
};

const RBV = [[255, 59, 107], [255, 149, 0], [255, 214, 10], [58, 211, 95], [34, 201, 255], [180, 92, 255]];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
// ghost: [x, y, z, hp, maxhp, flash, phase, type]
// horn:  [x, y, z, dx, dy, dz, life]
let ghosts, horns, hearts, kills, over, fireT, spawnT, inv, clock, last, shake,
    rec, blink, nextB;

const reset = () => {
  ghosts = []; horns = [];
  hearts = C.HEARTS; kills = 0; over = 0;
  fireT = 0; spawnT = 0.6; inv = 0; clock = 0; shake = 0;
  rec = 0; blink = 0; nextB = C.BLINK0;
  yaw = 0; pitch = 0; aim();
};

// ---------------------------------------------------------------------------
// Input (DESIGN.md 12). One pointer path for mouse and touch.
//
// The puppet fires by itself, so a press is not a trigger. Dragging aims; a press
// restarts a finished run; and the whole hold gesture is left for the bind at
// step 5, which no longer has to share the button with a shot.
// ---------------------------------------------------------------------------
let down = 0, lx = 0, ly = 0, auto = 1;

// How far away the thing you are aiming at is. Anything within AIMR of the middle
// of the screen counts; the nearest to the middle wins.
const targetRange = () => {
  let r = C.CONV, bd = C.AIMR;
  for (const o of ghosts) {
    const c = cam([o[0], o[1], o[2]]);
    if (c[2] < C.NEAR) continue;
    const off = hypot(c[0], c[1]) / c[2];
    if (off < bd) { bd = off; r = c[2]; }
  }
  return r;
};

const fire = () => {
  if (over || fireT > 0) return;
  fireT = C.FIRE;
  // From where the horn tip is SEEN to be, toward whatever is under the
  // crosshair. The puppet is posed, not aimed - so the shot's direction is the
  // player's, while its origin is the horn's.
  const q = eff(2);
  const c = T(q[3], q[4], q[5]);                 // the horn tip, camera space
  const k = (C.F / (C.F + c[2])) / (C.F / (C.F + C.MUZZ));
  const o = unCam(c[2] > C.MUZZ ? [c[0] * k, c[1] * k, C.MUZZ] : c);
  const p = unCam([0, 0, targetRange()]);
  const d = [p[0] - o[0], p[1] - o[1], p[2] - o[2]];
  const L = hypot(d[0], d[1], d[2]) || 1;
  horns.push([o[0], o[1], o[2], d[0] / L * C.HSPD, d[1] / L * C.HSPD, d[2] / L * C.HSPD, C.HLIFE]);
  // After the shot, so it leaves from the un-kicked muzzle. The blink goes with
  // the kick - a thing that recoils screws its eyes up - and pushes the idle
  // timer back, so a shot is never followed by a second blink a moment later.
  rec = 1;
  blink = C.BLINKD;
  nextB = C.BLINK0 + random() * (C.BLINK1 - C.BLINK0);
};

const onDown = (e) => {
  down = 1; lx = e.clientX; ly = e.clientY;
  if (over) reset();
};
const onMove = (e) => {
  if (!down) return;
  yaw += (e.clientX - lx) * C.TURN;
  pitch = min(C.PITCHMAX, max(-C.PITCHMAX, pitch - (e.clientY - ly) * C.TURN));
  lx = e.clientX; ly = e.clientY;
  aim();
};
const onUp = () => { down = 0; };

// ---------------------------------------------------------------------------
// The puppet (DESIGN.md 6). The recovered head-and-neck mesh, placed in CAMERA
// space: it is worn, not placed in the world.
//
// The table is the old rig's, verbatim. Each row is a swept box from one point to
// another with half-extents at each end, then a material:
//   [ax, ay, az,  bx, by, bz,  w0, h0,  w1, h1,  material]
// Model space is the rig's own: +y UP, the animal facing +z. The new world is
// y-down, so T flips y.
//
// One number IS changed from the recovered table: the neck ran from x=.025 to
// x=.075 while the head, horn and both eyes sit on x=.1. The old game viewed the
// animal side-on, where a lateral offset is a depth offset and invisible. Worn on
// an arm and seen from behind, it put the whole neck - and the mane that reads its
// position out of this row - down one side of the head. The neck is on the
// sagittal plane now.
//
// The horn is re-angled for the same class of reason. On the side-on animal it
// rose 74 degrees from the muzzle line, which is what a unicorn horn does when it
// is scenery. Here it is the barrel: it has to point where the shots go, and
// pitching the whole puppet 66 degrees to achieve that buried the head below the
// frame. It now leaves the forehead at 15 degrees, the same length as before.
// ---------------------------------------------------------------------------
export const PARTS = [
  [0.1, 0.11, 0.2, 0.088, 0.27, 0.364, 0.075, 0.115, 0.05, 0.085, 0],    // neck
  [0.076, 0.33, 0.346, 0.1, 0.324, 0.7, 0.06, 0.104, 0.06, 0.04, 0],     // head
  [0.1, 0.38, 0.42, 0.1, 0.53, 1, 0.03, 0.03, 0.002, 0.002, 1],          // horn
];
const MAT = [C.BODY, C.GOLD];

// A part's endpoints with its group offsets folded in. Everything that draws or
// aims reads the table through this, so the head, horn and eyes cannot drift
// apart, and the horn a shot leaves along is the horn that gets drawn.
// The head group's rotation, applied to a direction. Kept separate from the point
// version so the eyes can push out along the head's rotated flank instead of along
// model x, which is where they would stay if only positions were rotated.
const hrot = (a, b, c) => {
  const [rx, ry, rz] = C.HEADR;
  const cx = cos(rx), sx = sin(rx), cw = cos(ry), sw = sin(ry), cz = cos(rz), sz = sin(rz);
  const a2 = a * cw + c * sw, c2 = c * cw - a * sw;    // yaw, about up
  const b2 = b * cx - c2 * sx, c3 = c2 * cx + b * sx;  // pitch, about the flank
  return [a2 * cz - b2 * sz, a2 * sz + b2 * cz, c3];   // roll, about the muzzle
};
// And to a point: scaled and rotated about the joint, then moved.
const hmap = (x, y, z) => {
  const P0 = PARTS[1], k = C.HEADS;
  const v = hrot((x - P0[0]) * k, (y - P0[1]) * k, (z - P0[2]) * k);
  return [P0[0] + v[0] + C.HEADO[0], P0[1] + v[1] + C.HEADO[1], P0[2] + v[2] + C.HEADO[2]];
};

export const eff = (i) => {
  const q = PARTS[i].slice();
  if (i) {                                       // head, horn and eyes ride together
    const a = hmap(q[0], q[1], q[2]), b = hmap(q[3], q[4], q[5]);
    q[0] = a[0]; q[1] = a[1]; q[2] = a[2];
    q[3] = b[0]; q[4] = b[1]; q[5] = b[2];
    for (const k of [6, 7, 8, 9]) q[k] *= C.HEADS;
  }
  return q;
};
// The neck's base: where the forearm enters, and so what the puppet pivots about.
const PIV = [PARTS[0][0], PARTS[0][1], PARTS[0][2]];

// Model space into camera space. A rigid placement plus a uniform scale, so
// normals stay normals and push() can go on deriving them from the geometry.
const T = (x, y, z) => {
  const s = C.PUPS, ca = cos(C.PUPA), sa = sin(C.PUPA), cb = cos(C.PUPB), sb = sin(C.PUPB);
  const a = (x - PIV[0]) * s, b = -(y - PIV[1]) * s, c = (z - PIV[2]) * s;
  const a2 = a * ca + c * sa, c2 = c * ca - a * sa;
  // Recoil, back along the puppet's own axis rather than straight at the camera:
  // (sa, -ca*sb, ca*cb) is where its nose points once the pose has been applied.
  // Squared, so it snaps back and then eases the last of the way out.
  const k = rec * rec * C.RECOIL;
  return [C.PUP[0] + a2 - k * sa,
          C.PUP[1] + b * cb - c2 * sb + k * ca * sb,
          C.PUP[2] + c2 * cb + b * sb - k * ca * cb];
};

// The head lies in the sagittal plane, so its own lateral axis is exactly x and
// an eye is a shallow disc pushed out along it.
const eyes = () => {
  const q = eff(1), t = C.EYES[1];
  const ax = q[0] + (q[3] - q[0]) * t + hrot(0, C.EYES[0], 0)[0];
  const u0 = hrot(0, C.EYES[0], 0);              // "up" is the head's up, not the world's
  const ay = q[1] + (q[4] - q[1]) * t + u0[1];
  const az = q[2] + (q[5] - q[2]) * t + u0[2];
  const hw = q[6] + (q[8] - q[6]) * t;           // the head's half-width there
  const r = C.EYES[3] * C.HEADS, d = C.EYES[4] * C.HEADS;
  // Out along the head's OWN flank, which is only model x while the group is
  // unrotated. The up and forward axes of the disc follow the head too.
  const fl = hrot(1, 0, 0), up = hrot(0, 1, 0), fw = hrot(0, 0, 1);
  // A blink is the eye's own height going to almost nothing and back. Shaped with
  // a sine so it closes and opens rather than switching.
  const bk = blink > 0 ? 1 - (1 - C.BLINKS) * sin(PI * blink / C.BLINKD) : 1;
  for (const sx of [1, -1]) {
    const o = hw * C.EYES[2] * C.HEADS + d / 2;
    cone(frame([ax + sx * fl[0] * o, ay + sx * fl[1] * o, az + sx * fl[2] * o],
               [up[0] * r * bk, up[1] * r * bk, up[2] * r * bk],
               [sx * fl[0] * d / 2, sx * fl[1] * d / 2, sx * fl[2] * d / 2],
               [fw[0] * r, fw[1] * r, fw[2] * r]), 10, C.IRIS, T);
  }
};

// The mane: a row of tufts standing on the neck's top face.
//
// Rooted on the surface, not near it. swept() builds its cross-section from u,
// the lateral axis, and v = p x u - so for a neck in the sagittal plane v IS the
// direction straight out of its top face, and the row's own half-height at that
// point is exactly how far out the surface is. Reading both off the POSED neck
// means the mane follows it: retune the neck, lean it, scale it, and the mane
// stays welded to the top of it.
const mane = () => {
  const nk = eff(0);
  const dx = nk[3] - nk[0], dy = nk[4] - nk[1], dz = nk[5] - nk[2];
  const L = hypot(dx, dy, dz) || 1;
  const py = dy / L, pz = dz / L;
  // Normalised in its own plane. Built from components already divided by the 3D
  // length it came out short whenever the neck leaned sideways, and every root
  // sank a fraction into the surface it was supposed to be standing on.
  const pL = hypot(dy, dz) || 1;
  const uy = dz / pL, uz = -dy / pL;             // straight up out of the top face
  const span = C.MANEN > 1 ? (C.MANEW / (C.MANEN - 1)) * L : 1;
  const r = min(C.MANER, span * C.MANEG);
  for (let i = 0; i < C.MANEN; i++) {
    const t = C.MANEC + (C.MANEN < 2 ? 0 : C.MANEW * (i / (C.MANEN - 1) - 0.5));
    const h = nk[7] + (nk[9] - nk[7]) * t;       // the neck's half-height here
    const ax = nk[0] + dx * t, ay = nk[1] + dy * t, az = nk[2] + dz * t;
    const ry = ay + uy * h, rz = az + uz * h;    // the root, on the surface
    swept(T, ax, ry, rz,
          ax, ry + uy * C.MANEH - py * C.MANEB, rz + uz * C.MANEH - pz * C.MANEB,
          r, r, r * C.MANEP, r * C.MANEP, RBV[1 + (i % 5)]);
  }
};

const puppet = () => {
  for (let i = 0; i < PARTS.length; i++) {
    const q = eff(i);
    swept(T, q[0], q[1], q[2], q[3], q[4], q[5], q[6], q[7], q[8], q[9], MAT[q[10]], i ? C.HEADR[2] : 0);
  }
  eyes();
  flush(0);
  // The mane goes over the top, in its own pass. It sits ON the neck's surface,
  // so depth sorting puts half of every tuft behind the neck it is standing on -
  // correct, and unreadable. Painting it after the body it belongs to is the same
  // trick DESIGN.md 5 uses for the viewmodel against the world.
  mane();
  flush(0);
};

// ---------------------------------------------------------------------------
// Ghosts (DESIGN.md 7). Not solid geometry: a blob outline with a sine-deformed
// hem and two eye voids, drawn additively so overlap needs no depth sorting.
// The eyes are HOLES in the same path rather than dark fills - additive blending
// cannot darken anything, so a drawn eye would glow instead of reading as a void.
// ---------------------------------------------------------------------------
const spawn = () => {
  const a = random() * 2 * PI;
  ghosts.push([cos(a) * C.ARENA, C.GY, sin(a) * C.ARENA,
               C.DRIFTER[0], C.DRIFTER[0], 0, random() * 9, 0]);
};

const ghostAt = (o) => {
  const t = C.DRIFTER;
  const c = cam([o[0], o[1] + sin(clock * C.GBOBR + o[6]) * C.GBOB, o[2]]);
  if (c[2] < C.NEAR) return null;
  const s = C.F / (C.F + c[2]);
  return { c, s, px: c[0] * s * PX + W / 2, py: c[1] * s * PX + H / 2, r: t[3] * s * PX, t };
};

const drawGhost = (o, target) => {
  const v = ghostAt(o);
  if (!v) return;
  const t = v.t;
  // Opacity is the health bar (DESIGN.md 7): a nearly-dead ghost is visibly faint.
  const k = C.GFADE + (1 - C.GFADE) * (o[3] / o[4]);
  const hit = o[5] > 0;
  g.globalAlpha = min(1, k * 0.85);
  g.fillStyle = hit ? '#fff' : 'rgb(' + t[6] + ')';
  g.beginPath();
  for (let i = 0; i <= C.GSEG; i++) {
    const a = (i / C.GSEG) * 2 * PI;
    // The hem is the bottom: wobble grows toward it, so the top stays a head and
    // the skirt does the moving.
    const hem = max(0, sin(a));
    const rr = v.r * (1 + t[4] * hem * sin(a * t[5] + clock * 2.2 + o[6])) * (1 + 0.16 * hem);
    g.lineTo(v.px + cos(a) * rr * 0.86, v.py - sin(a) * rr);
  }
  g.closePath();
  const er = v.r * 0.17;
  for (const ex of [-0.3, 0.3]) {                 // eye voids, wound as holes
    g.moveTo(v.px + (ex + 0.12) * v.r, v.py - v.r * 0.28);
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * 2 * PI;
      g.lineTo(v.px + ex * v.r + cos(a) * er, v.py - v.r * 0.28 + sin(a) * er * 1.5);
    }
  }
  g.fill('evenodd');
  g.globalAlpha = 1;
  if (target === o) {                             // the one under the crosshair
    g.strokeStyle = '#fff';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(v.px, v.py, v.r * 1.15, 0, 7);
    g.stroke();
  }
};

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------
const step = (dt) => {
  clock += dt;
  if (over) return;
  fireT = max(0, fireT - dt);
  rec = max(0, rec - dt / C.RECT);
  blink = max(0, blink - dt);
  nextB -= dt;
  if (nextB <= 0) { blink = C.BLINKD; nextB = C.BLINK0 + random() * (C.BLINK1 - C.BLINK0); }
  inv = max(0, inv - dt);
  shake = max(0, shake - dt * 4);
  if (auto && !fireT) fire();                     // it fires on its own, at FIRE

  spawnT -= dt;
  if (spawnT <= 0) { spawnT = C.SPAWN; spawn(); }

  for (let i = horns.length; i--;) {
    const h = horns[i];
    h[0] += h[3] * dt; h[1] += h[4] * dt; h[2] += h[5] * dt;
    h[6] -= dt;
    if (h[6] <= 0) { horns.splice(i, 1); continue; }
    for (let j = ghosts.length; j--;) {
      const o = ghosts[j];
      if (hypot(o[0] - h[0], o[1] - h[1], o[2] - h[2]) > C.HHIT + C.DRIFTER[3]) continue;
      o[3]--; o[5] = C.GFLASH;
      horns.splice(i, 1);
      if (o[3] <= 0) { ghosts.splice(j, 1); kills++; }
      break;
    }
  }

  for (let i = ghosts.length; i--;) {
    const o = ghosts[i];
    o[5] = max(0, o[5] - dt);
    const d = hypot(o[0], o[2]) || 1;
    if (d < C.GCONTACT) {                         // reached you: hits and is gone
      ghosts.splice(i, 1);
      if (!inv) {
        hearts -= min(C.DMGCAP, C.DRIFTER[2]);
        inv = C.IFRAME; shake = 1;
        if (hearts <= 0) { hearts = 0; over = 1; }
      }
      continue;
    }
    const v = C.DRIFTER[1] * dt / d;
    o[0] -= o[0] * v; o[2] -= o[2] * v;
  }
};

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
const hud = () => {
  const u = min(W, H) * 0.036;
  for (let i = 0; i < C.HEARTS; i++) {            // hearts, top-right
    g.fillStyle = i < hearts ? '#ff3b6b' : '#2a2136';
    g.beginPath();
    const x = W - 16 - u - i * (u * 1.35), y = 18;
    g.moveTo(x + u / 2, y + u);
    g.lineTo(x, y + u * 0.38);
    g.lineTo(x + u * 0.25, y);
    g.lineTo(x + u / 2, y + u * 0.26);
    g.lineTo(x + u * 0.75, y);
    g.lineTo(x + u, y + u * 0.38);
    g.fill();
  }
  g.fillStyle = '#8b93b8';
  g.font = (u * 0.62 | 0) + 'px monospace';
  g.fillText('KILLS ' + kills, 16, 16 + u * 0.62);

  if (!over) {                                    // crosshair
    g.strokeStyle = '#ffffff88';
    g.lineWidth = 1.5;
    const c = min(W, H) * 0.012;
    g.beginPath();
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      g.moveTo(W / 2 + dx * c, H / 2 + dy * c);
      g.lineTo(W / 2 + dx * c * 2.2, H / 2 + dy * c * 2.2);
    }
    g.stroke();
  } else {
    g.fillStyle = '#000b';
    g.fillRect(0, H / 2 - u * 2.2, W, u * 4.4);
    g.fillStyle = '#fff';
    g.font = (u * 1.5 | 0) + 'px monospace';
    g.fillText(kills + ' KILLS', 24, H / 2);
    g.font = (u * 0.7 | 0) + 'px monospace';
    g.fillStyle = '#8b93b8';
    g.fillText('click to go again', 24, H / 2 + u * 1.4);
  }
};

// The one ghost nearest the middle of the screen, so the player can tell what
// they are aimed at (DESIGN.md 7).
const underCrosshair = () => {
  let best = null, bd = min(W, H) * 0.09;
  for (const o of ghosts) {
    const v = ghostAt(o);
    if (!v) continue;
    const d = hypot(v.px - W / 2, v.py - H / 2);
    if (d < bd + v.r) { bd = d - v.r; best = o; }
  }
  return best;
};

const render = () => {
  // Sky, ground, and the horizon between them. Every horizontal direction shares
  // the same vanishing height, so the horizon is one straight line whose only
  // input is pitch.
  const hy = H / 2 + tan(pitch) * C.F * PX + (shake ? (random() - 0.5) * shake * 14 : 0);
  g.fillStyle = C.SKY;
  g.fillRect(0, 0, W, H);
  g.fillStyle = C.GND;
  g.fillRect(0, hy, W, H - hy);
  g.fillStyle = C.HORIZ;
  g.fillRect(0, hy - 1, W, 2);

  const target = underCrosshair();
  g.globalCompositeOperation = 'lighter';
  for (const o of ghosts) drawGhost(o, target);
  g.globalCompositeOperation = 'source-over';

  // A horn in flight is a cone, apex forward, built in the world and put through
  // the same pipeline as everything else. It was a swept box tapered to a point,
  // which is a pyramid; a horn is round.
  for (const h of horns) {
    const L = hypot(h[3], h[4], h[5]) || 1;
    const px = h[3] / L, py = h[4] / L, pz = h[5] / L;
    // Any two axes across the flight direction. Same construction swept() uses,
    // so a horn flying straight up does not collapse its own cross-section.
    let ux = 1 - px * px, uy = -px * py, uz = -px * pz;
    const uL = hypot(ux, uy, uz) || 1;
    ux /= uL; uy /= uL; uz /= uL;
    const vx = py * uz - pz * uy, vy = pz * ux - px * uz, vz = px * uy - py * ux;
    const r = C.HW, k = C.HL / 2;
    cone(frame([h[0] - px * k, h[1] - py * k, h[2] - pz * k],
               [ux * r, uy * r, uz * r],
               [px * k, py * k, pz * k],
               [vx * r, vy * r, vz * r]), C.HN, C.GOLD);
  }
  flush();

  puppet();                                       // viewmodel last, on top
  hud();
};

const loop = (t) => {
  const dt = min(0.05, (t - last) / 1000) || 0;
  last = t;
  step(dt);
  render();
  requestAnimationFrame(loop);
};

// ---------------------------------------------------------------------------
export const dbg = () => ({ W, H, PX, yaw, pitch, ghosts, horns, hearts, kills, over, clock });
export const look = (y, p) => { yaw = y; pitch = p; aim(); };
export const place = (gs) => { ghosts = gs; };
export const restart = reset;
// Test and editor seams. Dropped from the app build, so they cost nothing.
export const drawPuppet = () => puppet();
// What a pose has to satisfy, measured rather than eyeballed: how far the horn
// points from the line a shot to a 10m target takes, and where the neck's arm
// opening lands relative to the bottom of the frame.
export const poseCheck = () => {
  const q = eff(2), b = T(q[0], q[1], q[2]), t = T(q[3], q[4], q[5]);
  const d = [t[0] - b[0], t[1] - b[1], t[2] - b[2]], dl = hypot(d[0], d[1], d[2]);
  const w = [-t[0], -t[1], 10 - t[2]], wl = hypot(w[0], w[1], w[2]);
  const k = eff(0);
  const capY = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([su, sv]) => {
    const P2 = T(k[0] + su * k[6], k[1], k[2] + sv * k[7]);
    return P2[1] * (C.F / (C.F + P2[2])) * PX + H / 2;
  });
  return {
    aim: Math.acos(max(-1, min(1, (d[0] * w[0] + d[1] * w[1] + d[2] * w[2]) / (dl * wl)))) * 180 / PI,
    cap: min(...capY) - H,
    // Where the horn tip lands on screen, through the real transform rather than
    // a rebuilt copy of it.
    tip: proj(t),
  };
};
export const setFire = (v) => { auto = v; };   // editor: stop it firing to look at it
export const anim = () => ({ rec, blink, nextB });

addEventListener('resize', resize);
addEventListener('pointerdown', onDown);
addEventListener('pointermove', onMove);
addEventListener('pointerup', onUp);
addEventListener('pointercancel', onUp);

resize();
reset();
last = 0;
requestAnimationFrame(loop);
