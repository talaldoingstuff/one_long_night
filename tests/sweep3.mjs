import { run, POL, CFG, setAdd } from './playtest.mjs';
const P=(x,n)=>String(x).padEnd(n), R=(x,n)=>String(x).padStart(n);
const med=(a)=>a.sort((x,y)=>x-y)[a.length>>1];
const fh=(r)=>{const l=r.log.find(x=>x.lost>0);return l?l.wave:99;};
const trial=(o)=>{const cfg={...CFG,...o};const w=[],h=[],sw=[],len=[];
  for(let s=1;s<=40;s++){const r=run(cfg,POL.optimal,s*7919,90);w.push(r.wave);h.push(fh(r));
    const l=r.log[Math.min(r.log.length-1,25)];if(l)len.push(l.t);}
  for(let s=1;s<=40;s++)sw.push(run(cfg,POL.spread,s*7919,90).wave);
  return{die:med(w),hit:med(h),sdie:med(sw),len:med(len)};};
setAdd(false);   // the user's compounding cards, as specified
console.log('');
console.log('=== compounding cards + geometric demand =========================');
console.log('  '+P('BUDR',7)+P('SPAWNR',9)+R('first hit',11)+R('perfect dies',14)+R('spread dies',13)+R('w26 lasts',11));
for (const BUDR of [1.09, 1.12, 1.15])
  for (const SPAWNR of [0.98, 0.96, 0.94]) {
    const t = trial({ BUDR, SPAWNR });
    console.log('  '+P(BUDR,7)+P(SPAWNR,9)+R(t.hit===99?'never':'w'+t.hit,11)+
      R(t.die>=90?'never':'w'+t.die,14)+R('w'+t.sdie,13)+R(t.len+'s',11));
  }
