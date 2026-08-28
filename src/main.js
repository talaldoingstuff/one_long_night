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
  // Camera-space placement: bottom-right of the frame, an arm's length away.
  PUP: [0.3, 0.34, 0.78],
  PUPS: 0.115,        // overall scale, metres
  PUPA: -0.34,        // yaw of the whole puppet, radians - it faces slightly in
  PUPB: -0.22,        // and tips its muzzle up
  SKIN: [232, 228, 244],
  MANE: [255, 59, 107],
  HORNC: [255, 196, 64],       // amber. The brightest single thing on screen.
  IRIS: [26, 20, 38],

  // --- Horns (DESIGN.md 6: travel time, not hitscan) ------------------------
  FIRE: 0.26,         // seconds between shots
  HSPD: 26,           // metres per second
  HLIFE: 1.2,         // seconds before it expires
  HR: 0.13,           // metres, half-length of the drawn sliver
  HHIT: 0.42,         // metres, collision radius against a ghost centre

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
export const cone = (M, n, col) => {
  const tip = at(M, 0, 1, 0), ring = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * PI;
    ring.push(at(M, cos(a), -1, sin(a)));
  }
  for (let i = 0; i < n; i++) push([ring[i], tip, ring[(i + 1) % n]], col, M[0]);
  push(ring, col, M[0]);
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

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
// ghost: [x, y, z, hp, maxhp, flash, phase, type]
// horn:  [x, y, z, dx, dy, dz, life]
let ghosts, horns, hearts, kills, over, fireT, spawnT, inv, clock, last, shake;

const reset = () => {
  ghosts = []; horns = [];
  hearts = C.HEARTS; kills = 0; over = 0;
  fireT = 0; spawnT = 0.6; inv = 0; clock = 0; shake = 0;
  yaw = 0; pitch = 0; aim();
};

// ---------------------------------------------------------------------------
// Input (DESIGN.md 12). One pointer path for mouse and touch.
//
// A press fires immediately rather than on release. Release-to-fire is the only
// way to tell a tap from a hold, but it puts the shot behind the input, and the
// bind (step 5) can charge from the same press without stealing the shot.
// ---------------------------------------------------------------------------
let down = 0, lx = 0, ly = 0;

const fire = () => {
  if (over || fireT > 0) return;
  fireT = C.FIRE;
  // Out of the horn tip, along the way the camera is looking at this instant.
  const o = unCam(MUZZLE()), d = unCam([0, 0, 1]);
  horns.push([o[0], o[1], o[2], d[0] * C.HSPD, d[1] * C.HSPD, d[2] * C.HSPD, C.HLIFE]);
};

const onDown = (e) => {
  down = 1; lx = e.clientX; ly = e.clientY;
  if (over) { reset(); return; }
  fire();
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
// The puppet (DESIGN.md 6). Built in CAMERA space: it is worn, not placed.
// ---------------------------------------------------------------------------
// One frame for the whole puppet, so every part is authored in its local space
// and the arm's pose is a single change here rather than in seven places.
const rig = () => {
  const s = C.PUPS, ca = cos(C.PUPA), sa = sin(C.PUPA), cb = cos(C.PUPB), sb = sin(C.PUPB);
  return [
    C.PUP,
    [ca * s, 0, -sa * s],
    [sa * sb * s, cb * s, ca * sb * s],
    [sa * cb * s, -sb * s, ca * cb * s],
  ];
};
// A sub-frame inside the puppet: offset in puppet units, then scaled.
const part = (M, ox, oy, oz, rx, ry, rz) => [
  at(M, ox, oy, oz),
  [M[1][0] * rx, M[1][1] * rx, M[1][2] * rx],
  [M[2][0] * ry, M[2][1] * ry, M[2][2] * ry],
  [M[3][0] * rz, M[3][1] * rz, M[3][2] * rz],
];

// Where a horn leaves, in camera space.
const MUZZLE = () => at(rig(), 0, -1.55, 3.9);

const puppet = () => {
  const M = rig();
  box(part(M, 0, 0.5, -0.9, 0.62, 0.95, 1.15), C.SKIN);        // neck over the forearm
  box(part(M, 0, -0.35, 0.85, 0.55, 0.6, 1.3), C.SKIN);        // muzzle
  box(part(M, 0, -0.95, 0.15, 0.5, 0.32, 0.62), C.SKIN);       // brow
  for (let i = 0; i < 4; i++)                                   // mane, one strip
    box(part(M, -0.5 + i * 0.33, -0.62 - i * 0.06, -0.55, 0.17, 0.42, 0.3), C.MANE);
  box(part(M, 0.42, -0.72, 0.9, 0.16, 0.2, 0.16), C.IRIS);      // eye
  box(part(M, -0.42, -0.72, 0.9, 0.16, 0.2, 0.16), C.IRIS);
  cone(part(M, 0, -1.05, 1.5, 0.17, 0.62, 0.17), 6, C.HORNC);   // the horn
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
  inv = max(0, inv - dt);
  shake = max(0, shake - dt * 4);
  if (down && !fireT) fire();                     // holding keeps firing at the cap

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

  for (const h of horns) {                        // horns in flight
    const a = cam([h[0], h[1], h[2]]);
    if (a[2] < C.NEAR) continue;
    const b = cam([h[0] - h[3] * 0.012, h[1] - h[4] * 0.012, h[2] - h[5] * 0.012]);
    const p = proj(a), q = proj(b);
    g.strokeStyle = 'rgb(' + C.HORNC + ')';
    g.lineWidth = max(1.5, C.HR * (C.F / (C.F + a[2])) * PX);
    g.beginPath();
    g.moveTo(p[0], p[1]);
    g.lineTo(q[0], q[1]);
    g.stroke();
  }

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

addEventListener('resize', resize);
addEventListener('pointerdown', onDown);
addEventListener('pointermove', onMove);
addEventListener('pointerup', onUp);
addEventListener('pointercancel', onUp);

resize();
reset();
last = 0;
requestAnimationFrame(loop);
