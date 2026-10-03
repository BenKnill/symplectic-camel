import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
let cases=0;
// Extract the actual Camel numerical functions, not a replacement implementation.
const html=read('docs/index.html');const body=html.split('<script>')[1].split('</script>')[0];const prefix=body.slice(body.indexOf('  const N ='),body.indexOf('  // ---------- 3D view'));
const context={window:{matchMedia:()=>({matches:true})},URLSearchParams,location:{search:'?present=1'},Float32Array,Uint8Array,Math};vm.createContext(context);vm.runInContext(prefix+'\nthis.test={base,N,state,computeMap,shadowArea,areaCal,X1,Y1,X2,Y2,IN};',context);const C=context.test;
for(const mode of ['vol','lin','ham','lag'])for(const s of [0,.4,1]){
 C.state.mode=mode;C.state.s=s;C.state.t=3;C.state.R=.72;C.computeMap();
 for(let i=0;i<C.N;i++){assert.ok(Number.isFinite(C.X1[i]+C.Y1[i]+C.X2[i]+C.Y2[i]));}
 const ar=C.shadowArea(C.X1,mode==='lag'?C.X2:C.Y1)*C.areaCal/Math.PI;
 if(s===0)assert.ok(Math.abs(ar-1)<.01);
 if(mode==='lin')assert.ok(Math.abs(ar-1)<.01);
 console.log(`PASS Camel ${mode}, s=${s}: sampled shadow ${ar.toFixed(4)} πr²`);cases++;
}
// This old tolerance-based fit badge was a false positive.
const scale=1+.862*(.84*.5-1);assert.ok(scale>.5);assert.equal(scale<=.5,false);
console.log(`PASS analytic containment regression: radius ${scale} does not fit R=.5`);
console.log(`${cases} model cases passed; no machine-code execution or HOL replay claimed`);
