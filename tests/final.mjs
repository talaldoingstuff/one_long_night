import { run, POL, CFG } from './playtest.mjs';
const NAMES=['Drifter','Darter','Hulk','Splitter','Warden'];
const T=CFG.T, BUD0=6, BUDR=1.12, SPAWN=1.5, SPAWNR=0.96, SPLIT=3;
const P=(x,n)=>String(x).padEnd(n), R=(x,n)=>String(x).padStart(n);
const realHp=(k)=>T[k][0]+(k===SPLIT?2*T[0][0]:0);
let seed=77; const rnd=()=>(seed=(seed*1103515245+12345)&0x7fffffff)/0x7fffffff;
const sample=(w)=>{let n=0,hp=0;const R2=600;
  for(let r=0;r<R2;r++){let b=Math.round(BUD0*BUDR**(w-1));
    for(;;){const l=[];for(let k=0;k<5;k++)if(T[k][4]<=w&&T[k][3]<=b)l.push(k);
      if(!l.length)break;const k=l[rnd()*l.length|0];b-=T[k][3];n++;hp+=realHp(k);}}
  return{n:n/R2,hp:hp/R2};};
console.log('');
console.log('=== FINAL CURVE:  budget 6 x 1.12^w   spawn 1.5s x 0.96^w =========');
console.log('  '+P('wave',6)+R('budget',8)+R('every',7)+R('ghosts',8)+R('hp',7)+
  R('lasts',7)+R('hp/s',7)+R('vs prev',9)+'  ');
let prev=0;
for(let w=1;w<=36;w++){
  const iv=SPAWN*SPAWNR**(w-1), s=sample(w), lasts=s.n*iv, rate=s.hp/lasts;
  const j=prev?((rate/prev-1)*100):0;
  const nu=T.findIndex(t=>t[4]===w);
  console.log('  '+P(w,6)+R(Math.round(BUD0*BUDR**(w-1)),8)+R(iv.toFixed(2)+'s',7)+
    R(s.n.toFixed(1),8)+R(s.hp.toFixed(0),7)+R(lasts.toFixed(0)+'s',7)+R(rate.toFixed(1),7)+
    R(prev?(j>=0?'+':'')+j.toFixed(0)+'%':'-',9)+
    (nu>=0?'  <<< '+NAMES[nu]:''));
  prev=rate;
}
