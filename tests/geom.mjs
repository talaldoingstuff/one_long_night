// Geometry checks for the octahedral prism and the rainbow sheet. These verify
// the maths, which a "did it throw" test cannot.
const C = { PCY: 0.77, PCZ: 0.64, PR: 0.22, RW: 0.5, RD: 1.8, RH: 0.22, RY: 0.42, RU: 1.6, RV: 5.2 };
const ok = (l, c, x = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${x ? '  ' + x : ''}`);

// --- prism: how many faces survive the cull, across a full turn ------------
const counts = new Set();
let areaMin = 1e9, areaMax = 0;
for (let deg = 0; deg < 360; deg += 5) {
  const a = (deg * Math.PI) / 180, co = Math.cos(a), si = Math.sin(a), r = 40, cx = 0, cy = 0;
  let n = 0, area = 0;
  for (let i = 0; i < 8; i++) {
    const sx = i & 1 ? 1 : -1, sy = i & 2 ? 1 : -1, sz = i & 4 ? 1 : -1;
    const nx = sx * co - sz * si, nz = sx * si + sz * co;
    if (nz * C.PCY >= sy * C.PCZ) continue;
    n++;
    const P = [
      [cx + sx * r * co, cy - sx * r * si * C.PCZ],
      [cx, cy - sy * r * C.PCY],
      [cx - sz * r * si, cy - sz * r * co * C.PCZ],
    ];
    if (!P.every((p) => p.every(Number.isFinite))) { console.log('FAIL non-finite vertex'); process.exit(1); }
    area += Math.abs((P[1][0]-P[0][0])*(P[2][1]-P[0][1]) - (P[2][0]-P[0][0])*(P[1][1]-P[0][1])) / 2;
  }
  counts.add(n);
  areaMin = Math.min(areaMin, area); areaMax = Math.max(areaMax, area);
}
const cs = [...counts].sort((a, b) => a - b);
ok('prism: a convex solid shows about half its faces', cs.every((n) => n >= 3 && n <= 5),
   `visible face counts across a full turn: ${cs.join(', ')}`);
// The drawn faces must tile the silhouette, so total area should barely change as it spins.
ok('prism: silhouette area stays stable while spinning', areaMax / areaMin < 1.6,
   `area ${areaMin.toFixed(0)} .. ${areaMax.toFixed(0)} px2 (ratio ${(areaMax/areaMin).toFixed(2)})`);

// --- prism: the bottom vertex must rest exactly on the lane ---------------
{
  const s = 84, r = s * C.PR, gy = 500, cy = gy - r * C.PCY;
  const bottom = cy - -1 * r * C.PCY, top = cy - 1 * r * C.PCY;
  ok('prism: bottom vertex sits on the ground line', Math.abs(bottom - gy) < 1e-9,
     `bottom ${bottom.toFixed(1)} vs lane ${gy}`);
  ok('prism: height is a sane fraction of object size', (gy - top) / s > 0.2 && (gy - top) / s < 0.6,
     `${((gy - top) / s).toFixed(2)} x object size`);
}

// --- rainbow sheet: no degenerate or inverted quads ------------------------
{
  const s = 84, cx = 200, gy = 500, w = s * C.RW, d = s * C.RD, top = gy - s * C.RY, amp = C.RH * s;
  const NX = 6, NZ = 12;
  let bad = 0, minA = 1e9, rows = [];
  for (let ph = 0; ph < 12; ph += 0.37) {
    const SY = (u, v) => top - amp * Math.sin(v * C.RV + ph + u * C.RU) * C.PCY - v * d * C.PCZ;
    for (let j = 0; j < NZ; j++) {
      const v0 = 0.5 - j / NZ, v1 = v0 - 1 / NZ;
      for (let i = 0; i < NX; i++) {
        const u0 = i / NX - 0.5, u1 = u0 + 1 / NX;
        const P = [[cx+u0*w,SY(u0,v0)],[cx+u1*w,SY(u1,v0)],[cx+u1*w,SY(u1,v1)],[cx+u0*w,SY(u0,v1)]];
        if (!P.every((p) => p.every(Number.isFinite))) bad++;
        let A = 0;
        for (let k = 0; k < 4; k++) { const a = P[k], b = P[(k+1)%4]; A += a[0]*b[1] - b[0]*a[1]; }
        minA = Math.min(minA, Math.abs(A / 2));
      }
    }
    if (ph === 0) for (let j = 0; j < NZ; j++) rows.push(SY(0, 0.5 - j / NZ).toFixed(0));
  }
  ok('sheet: every quad has finite corners', bad === 0, `${bad} bad quads`);
  ok('sheet: no collapsed quads', minA > 4, `smallest quad ${minA.toFixed(1)} px2`);
  ok('sheet: rows step away from the camera in order',
     rows.every((y, i) => i === 0 || +y >= +rows[i - 1]),
     `row screen-y: ${rows.join(' -> ')}`);
  // it must stay inside its lane
  const laneW = 2 * 0.44 * 420 / 3;
  ok('sheet: fits within a lane', w <= laneW,
     `sheet ${w.toFixed(0)}px vs lane ${laneW.toFixed(0)}px`);
}

// --- horse: 3D skeleton ----------------------------------------------------
{
  const YAW = 3.3, co = Math.cos(YAW), si = Math.sin(YAW);
  const s = 44, cx = 200, gy = 500;
  const P = (x, y, z) => {
    const rx = x * co - z * si, rz = x * si + z * co;
    return [cx + rx * s, gy - (y * 0.77 + rz * 0.64) * s];
  };
  // hooves must reach the ground somewhere in the stride, and never sink far below
  let minFy = 9, maxFy = -9;
  for (let d = 0; d < 360; d += 6) {
    const t = (d * Math.PI) / 180;
    for (const [lz, p, sg] of [[0.24,0.12,-1],[-0.28,0.62,1],[0.24,0,-1],[-0.28,0.5,1]]) {
      const th = t + p * 2 * Math.PI;
      const a = Math.sin(th) * 0.85, b = (1 - Math.cos(th)) * 0.5 * sg, L = 0.26;
      const hy = 0.58 - 0.06, ky = hy - Math.cos(a) * L;
      const fy = ky - Math.cos(a + b) * L;
      minFy = Math.min(minFy, fy); maxFy = Math.max(maxFy, fy);
    }
  }
  ok('horse: hooves touch the lane during the stride', Math.abs(minFy) < 0.03,
     `closest hoof gets ${minFy.toFixed(3)} of body height from the lane`);
  ok('horse: no hoof sinks through the lane', minFy > -0.03,
     `lowest hoof ${minFy.toFixed(3)}`);
  ok('horse: legs actually lift, so the gallop reads', maxFy > 0.15,
     `peak lift ${maxFy.toFixed(3)} of body height`);

  // near and far legs must actually separate on screen, or the 3D is doing nothing
  const [nx2, ny2] = P(0.15, 0.5, 0.24), [fx, fy2] = P(-0.15, 0.5, 0.24);
  const sep = Math.hypot(nx2 - fx, ny2 - fy2);
  ok('horse: near and far legs separate on screen', sep > 4,
     `${sep.toFixed(1)} px apart (${(ny2 - fy2).toFixed(1)} of it vertical, which is the depth cue)`);
  // facing: the animal's forward axis must come toward the camera
  const fwdRz = Math.cos(YAW);
  ok('horse: faces the camera', fwdRz < -0.9,
     `forward axis depth ${fwdRz.toFixed(2)} (negative is toward the viewer)`);
  // front legs must sit nearer the camera than hind legs
  const rzHip = (side, hipZ) => side * 0.15 * Math.sin(YAW) + hipZ * Math.cos(YAW);
  ok('horse: front legs are nearer than hind legs', rzHip(1, 0.24) < rzHip(1, -0.28),
     `front ${rzHip(1,0.24).toFixed(2)} vs hind ${rzHip(1,-0.28).toFixed(2)}`);

  // footprint must stay inside a lane at the player's depth
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (const [x, y, z] of [[0,0.62,-0.6],[0,1.2,0.74],[0.12,0,0.24],[-0.12,0,-0.28],[0,0.58,0.28]]) {
    const [px2, py2] = P(x, y, z);
    minX = Math.min(minX, px2); maxX = Math.max(maxX, px2);
    minY = Math.min(minY, py2); maxY = Math.max(maxY, py2);
  }
  const laneW = 2 * 0.229 * 420 / 3;
  ok('horse: fits inside its lane', maxX - minX <= laneW,
     `${(maxX - minX).toFixed(0)} px wide vs ${laneW.toFixed(0)} px lane`);
  ok('horse: sane height', (maxY - minY) / s > 0.6 && (maxY - minY) / s < 1.6,
     `${((maxY - minY) / s).toFixed(2)} x object size`);
}
