import { run, POL, CFG } from './playtest.mjs';
const P = (x,n) => String(x).padEnd(n), R = (x,n) => String(x).padStart(n);
const med = (a) => a.sort((x,y)=>x-y)[a.length>>1];
const firstHit = (r) => { const l = r.log.find(x => x.lost > 0); return l ? l.wave : '-'; };
const trial = (o) => {
  const cfg = { ...CFG, ...o, T: (o.T || CFG.T) };
  const w = [], fh = [];
  for (let s = 1; s <= 40; s++) { const r = run(cfg, POL.optimal, s*7919, 90); w.push(r.wave); fh.push(firstHit(r) === '-' ? 99 : firstHit(r)); }
  const sw = [], sf = [];
  for (let s = 1; s <= 40; s++) { const r = run(cfg, POL.spread, s*7919, 90); sw.push(r.wave); sf.push(firstHit(r) === '-' ? 99 : firstHit(r)); }
  return { die: med(w), hit: med(fh), sdie: med(sw) };
};
console.log('');
console.log('=== how steep does the spawn curve need to be? ===================');
console.log('  ' + P('SPAWNG',9) + R('first hit',11) + R('perfect dies',14) + R('spread dies',13));
for (const g of [0.05, 0.08, 0.12, 0.16, 0.20, 0.26, 0.34]) {
  const t = trial({ SPAWNG: g });
  console.log('  ' + P(g,9) + R(t.hit === 99 ? 'never' : 'wave '+t.hit, 11) +
    R(t.die >= 90 ? 'never' : 'wave '+t.die, 14) + R('wave '+t.sdie, 13));
}
console.log('');
console.log('=== and with the ghosts faster still =============================');
const faster = (m) => CFG.T.map(t => [t[0], +(t[1]*m).toFixed(2), t[2], t[3], t[4]]);
console.log('  ' + P('speed x',9) + P('SPAWNG',9) + R('first hit',11) + R('perfect dies',14) + R('spread dies',13));
for (const m of [1.0, 1.15, 1.3]) for (const g of [0.16, 0.26]) {
  const t = trial({ T: faster(m), SPAWNG: g });
  console.log('  ' + P(m,9) + P(g,9) + R(t.hit === 99 ? 'never' : 'wave '+t.hit, 11) +
    R(t.die >= 90 ? 'never' : 'wave '+t.die, 14) + R('wave '+t.sdie, 13));
}
