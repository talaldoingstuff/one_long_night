import { run, POL, CFG, setAdd } from './playtest.mjs';
const P=(x,n)=>String(x).padEnd(n), R=(x,n)=>String(x).padStart(n);
const med=(a)=>a.sort((x,y)=>x-y)[a.length>>1];
const fh=(r)=>{const l=r.log.find(x=>x.lost>0);return l?l.wave:99;};
const trial=(o)=>{const cfg={...CFG,...o};const w=[],h=[],sw=[];
  for(let s=1;s<=40;s++){const r=run(cfg,POL.optimal,s*7919,90);w.push(r.wave);h.push(fh(r));}
  for(let s=1;s<=40;s++)sw.push(run(cfg,POL.spread,s*7919,90).wave);
  return{die:med(w),hit:med(h),sdie:med(sw)};};
const show=(label,t)=>console.log('  '+P(label,22)+R(t.hit===99?'never':'w'+t.hit,10)+
  R(t.die>=90?'never':'w'+t.die,12)+R('w'+t.sdie,10));
console.log('');
console.log('=== additive cards (x7.8 dps ceiling instead of x25.6) ===========');
console.log('  '+P('budget / spawn curve',22)+R('first hit',10)+R('perfect dies',12)+R('spread dies',10));
setAdd(true);
for (const BUDG of [3, 4])
  for (const SPAWNG of [0.03, 0.05, 0.08, 0.12])
    show('BUDG '+BUDG+', SPAWNG '+SPAWNG, trial({ BUDG, SPAWNG }));
console.log('');
console.log('=== the same, compounding, for contrast =========================');
setAdd(false);
show('BUDG 3, SPAWNG 0.05', trial({ BUDG: 3, SPAWNG: 0.05 }));
