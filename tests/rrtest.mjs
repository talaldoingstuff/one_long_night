import { readFileSync } from 'fs';
const anyObj = new Proxy({ width: 10 }, { get: (t,k) => (k in t ? t[k] : () => anyObj) });
let fills = 0, strokes = 0, texts = 0;
const ctx = new Proxy({ canvas: { style: {} } }, {
  get(t,k){ if (k in t) return t[k];
    if (k==='createLinearGradient') return () => ({ addColorStop(){}, toString:()=>'g' });
    if (k==='fill') return () => fills++;
    if (k==='stroke') return () => strokes++;
    if (k==='fillText') return () => texts++;
    return ()=>anyObj; },
  set(t,k,v){ t[k]=v; return true; } });
let rafCb=null; const L=Object.create(null);
// Roadroller's stub hands the decompressed program to document.write inside a
// script tag, so the shim has to run what it is given.
const written = [];
globalThis.document = {
  getElementById: () => ({ getContext: () => ctx, style: {} }),
  write: (html) => written.push(html),
};
globalThis.devicePixelRatio=1; globalThis.innerWidth=900; globalThis.innerHeight=500;
globalThis.addEventListener=(t,f)=>{(L[t]||=[]).push(f);};
globalThis.requestAnimationFrame=(cb)=>{rafCb=cb;};
globalThis.window = globalThis;
const src = readFileSync(process.argv[2],'utf8');
try { (0, eval)(src); } catch (e) { console.log('  BOOT FAILED:', e.message); process.exit(1); }
// Roadroller writes only the page shell; the program itself runs from the stub.
const doc = written.join('');
console.log('  document.write: ' + doc.length + ' bytes of page shell, no script tag - ' +
  'the decompressed program runs from the stub itself');
if (!rafCb) { console.log('  BOOT FAILED: it never asked for a frame'); process.exit(1); }
let t = 0;
const fire=(ty,e)=>(L[ty]||[]).forEach(f=>f(e));
for (let i=0;i<60*4;i++){ t+=1000/60; rafCb(t); }
const a = fills;
fire('pointerdown',{clientX:450,clientY:250});
for (let i=0;i<60*4;i++){ t+=1000/60; rafCb(t); }
fire('pointerup',{});
fire('keydown',{type:'keydown',code:'KeyD',preventDefault(){}});
for (let i=0;i<60;i++){ t+=1000/60; rafCb(t); }
console.log('  booted through ' + written.length + ' document.write, ran 9s of frames');
console.log('  fills ' + fills + ', strokes ' + strokes + ', text ' + texts +
  '  (' + (fills>a ? 'still drawing after input' : 'STOPPED DRAWING') + ')');
console.log(fills > 500 && strokes > 50 && texts > 10
  ? '  PASS  the roadrolled build runs and draws'
  : '  FAIL  it booted but is not drawing what it should');
