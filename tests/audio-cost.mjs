// Throwaway: measure what the audio block actually costs, packed through the real
// pipeline on top of the real game. DESIGN.md 2 budgets 1,000 for ZzFX + SFX and
// 300 for generative music. This replaces both with measurements.
import { build } from 'vite';
import { mkdirSync, readFileSync, writeFileSync, rmSync, statSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packConfig } from '../tools/config.js';

// Off the module, not off this machine: an absolute path here breaks the day
// the folder is renamed or the repo is cloned anywhere else.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TMP = join(ROOT, '.audio-cost');

async function pack(name, mainJs) {
  const root = join(TMP, name);
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, 'main.js'), mainJs);
  copyFileSync(join(ROOT, 'sdk', 'index.html'), join(root, 'index.html'));
  const log = console.log;
  console.log = () => {};
  try {
    await build({ ...packConfig({ root, outDir: join(root, 'dist') }), logLevel: 'silent' });
  } finally { console.log = log; }
  return statSync(join(root, 'dist', 'index.zip')).size;
}

const game = readFileSync(join(ROOT, 'src', 'main.js'), 'utf8');

// --- ZzFX micro ------------------------------------------------------------
const ZZFX = `
let zzfxV=.3,zzfxR=44100,zzfxX,
zzfxG=(q=1,k=.05,c=220,e=0,t=0,u=.1,r=0,F=1,v=0,z=0,w=0,A=0,l=0,B=0,x=0,G=0,d=0,y=1,m=0,C=0)=>{
let b=2*Math.PI,H=v*=500*b/zzfxR**2,I=(0<x?1:-1)*b/4,D=c*=(1+2*k*Math.random()-k)*b/zzfxR,Z=[],g=0,E=0,a=0,n=1,J=0,K=0,f=0,p,h;
e=99+zzfxR*e;m*=zzfxR;t*=zzfxR;u*=zzfxR;d*=zzfxR;z*=500*b/zzfxR**3;x*=b/zzfxR;w*=b/zzfxR;A*=zzfxR;l=zzfxR*l|0;
for(h=e+m+t+u+d|0;a<h;Z[a++]=f)++K%(100*G|0)||(f=r?1<r?2<r?3<r?Math.sin((g%b)**3):Math.max(Math.min(Math.tan(g),1),-1):1-(2*g/b%2+2)%2:1-4*Math.abs(Math.round(g/b)-g/b):Math.sin(g),
f=(l?1-C+C*Math.sin(2*Math.PI*a/l):1)*(0<f?1:-1)*Math.abs(f)**F*q*zzfxV*(a<e?a/e:a<e+m?1-(a-e)/m*(1-y):a<e+m+t?y:a<h-d?(h-a-d)/u*y:0),
f=d?f/2+(d>a?0:(a<h-d?1:(h-a)/d)*Z[a-d|0]/2):f),p=(c+=v+=z)*Math.cos(A*E++),g+=p+p*B*Math.sin(a**5),n&&++n>x&&(c+=w,D+=w,n=0),!l||++J%l||(c=D,v=H,n=n||1);
return Z},
zzfx=(...t)=>{if(!zzfxX)return;let d=zzfxG(...t),e=zzfxX.createBufferSource(),f=zzfxX.createBuffer(1,d.length,zzfxR);
f.getChannelData(0).set(d);e.buffer=f;e.connect(zzfxX.destination);e.start()};
`;

// --- SFX definitions + generative music ------------------------------------
const SFX = `
const S_CONV=[2,.05,270,.02,.2,.3,1,1.7,,,300,.06,.03,,,,.05],
S_LIGHT=[1.2,.05,880,,.05,.12,1,2.2,,,540,.04],
S_DARK=[1.5,.05,110,.01,.1,.2,4,1.4,,,,,,.6],
S_TIER=[.6,.05,440,,.02,.05,1,1.5],
S_OVER=[1.8,.05,180,.1,.3,.6,2,1.2,,,-90,.15];
const SCALE=[0,3,5,7,10,12,15];
let mT=0,mI=0;
const music=(dt,spd)=>{
  if((mT-=dt)>0)return;
  mT=.28/spd;
  const n=SCALE[mI++%SCALE.length]+(spd>2?12:spd>1.5?7:0);
  zzfx(...[.35,.05,110*2**(n/12),,.03,.18,1,1.4,,,,,,.4]);
};
`;

// --- call sites -------------------------------------------------------------
const WIRE = `
addEventListener('pointerdown',()=>{zzfxX=zzfxX||new AudioContext});
addEventListener('keydown',()=>{zzfxX=zzfxX||new AudioContext});
`;

const base = await pack('off', game);
const zzfxOnly = await pack('zzfx', game + ZZFX + WIRE + '\nzzfx(...[1]);\n');
const full = await pack('full', game + ZZFX + SFX + WIRE +
  '\nzzfx(...S_CONV);zzfx(...S_LIGHT);zzfx(...S_DARK);zzfx(...S_TIER);zzfx(...S_OVER);music(.016,1);\n');

console.log('');
console.log('  Audio cost  -  measured on top of the real game, real pipeline');
console.log('  ' + '-'.repeat(58));
console.log(`  game as it stands            ${String(base).padStart(6)}`);
console.log(`  + ZzFX engine only           ${String(zzfxOnly).padStart(6)}   +${zzfxOnly - base}`);
console.log(`  + 5 SFX + generative music   ${String(full).padStart(6)}   +${full - base} total`);
console.log('');
console.log(`  DESIGN.md 2 budgets 1000 (ZzFX+SFX) + 300 (music) = 1300`);
console.log(`  measured                                          = ${full - base}`);
console.log('');

// Numerical sanity on the synth: the samples must be finite and bounded, or the
// size number is measuring broken code.
const mod = await import('data:text/javascript,' + encodeURIComponent(
  ZZFX.replace('zzfxX,', 'zzfxX;') + '\nexport{zzfxG};'
));
const buf = mod.zzfxG(...[2, .05, 270, .02, .2, .3, 1, 1.7, , , 300, .06, .03, , , , .05]);
const finite = buf.every(Number.isFinite);
const peak = Math.max(...buf.map(Math.abs));
console.log(`  synth check: ${buf.length} samples, all finite: ${finite}, peak ${peak.toFixed(3)}, non-silent: ${peak > .01}`);
console.log('');

rmSync(TMP, { recursive: true, force: true });
