import { readFileSync } from 'fs';
const anyObj = new Proxy({ width: 10 }, { get: (t,k) => (k in t ? t[k] : () => anyObj) });
const ctx = new Proxy({ canvas: { style: {} } }, {
  get: (t,k) => (k in t ? t[k] : (k==='createLinearGradient'
    ? () => ({ addColorStop(){}, toString:()=>'g' }) : ()=>anyObj)),
  set: (t,k,v) => { t[k]=v; return true; } });
globalThis.document={getElementById:()=>({getContext:()=>ctx,style:{}}),write:()=>{}};
globalThis.devicePixelRatio=1; globalThis.innerWidth=900; globalThis.innerHeight=500;
globalThis.addEventListener=()=>{}; globalThis.requestAnimationFrame=()=>{};
globalThis.window = globalThis;
const src = readFileSync(process.argv[2],'utf8');
const t0 = performance.now();
(0, eval)(src);
const t1 = performance.now();
const mb = process.memoryUsage();
console.log('  decompress + boot: ' + (t1 - t0).toFixed(0) + 'ms');
console.log('  heap after boot:   ' + (mb.heapUsed / 1048576).toFixed(0) + 'MB used, ' +
  ((mb.external + mb.arrayBuffers) / 1048576).toFixed(0) + 'MB in typed arrays');
