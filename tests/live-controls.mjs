import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
function fixture(){
 const nodes=new Map(),listeners={},timers=new Map();let tickId=0;
 const ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},drawImage(){},getImageData:()=>({data:Uint8ClampedArray.from({length:256*256*4},(_,i)=>(i*17)&255)})};
 const node=(id,tagName='DIV')=>{if(nodes.has(id))return nodes.get(id);const n={id,tagName,textContent:'',style:{},children:[],attributes:{},value:id==='steps'?'100':'',disabled:false,open:false,hidden:false,classList:{add(){}},onclick:null,replaceChildren(){this.children=[]},append(el){this.children.push(el)},setAttribute(k,v){this.attributes[k]=v},getAttribute(k){return this.attributes[k]},getContext:()=>ctx,click(){if(!this.disabled)this.onclick?.({target:this})}};nodes.set(id,n);return n};
 for(const id of ['half-next','half-prev','half-reset','scramble','back','stop','reset','full','p-next','p-prev','p-reset','p-full','play'])node(id,'BUTTON');node('steps','INPUT');
 const document={getElementById:node,createElement:tag=>({tagName:tag.toUpperCase(),style:{},setAttribute(){},getContext:()=>ctx}),querySelector:s=>node(s),body:node('body'),documentElement:{requestFullscreen:()=>Promise.resolve()},exitFullscreen:()=>Promise.resolve()};
 const env={console,document,location:{search:'?present=1',hash:''},history:{replaceState:(_x,_y,v)=>env.location.hash=v},URLSearchParams,matchMedia:()=>({matches:false}),setInterval:fn=>{timers.set(++tickId,fn);return tickId},clearInterval:id=>timers.delete(id),addEventListener:(name,fn)=>listeners[name]=fn,Image:class{set src(_v){this.onload?.()}}};env.window=env;
 const key=(k,target='body')=>{let prevented=false;listeners.keydown({key:k,target:node(target),preventDefault(){prevented=true}});return prevented};
 const tick=()=>{for(const fn of [...timers.values()])fn()};
 return {env,node,key,tick,timers};
}
const C=fixture(),selected=[];C.env.CamelLive={select:(...args)=>selected.push(args)};vm.createContext(C.env);vm.runInContext(read('docs/presenter.js'),C.env);const P=C.env.CamelPresenter;
assert.equal(P.getBeat(),0);for(let n=1;n<5;n++){C.key('ArrowRight','p-next');assert.equal(P.getBeat(),n);assert.equal(C.env.location.hash,'#'+(n+1))}C.key('ArrowRight','p-next');assert.equal(P.getBeat(),4);C.key('ArrowLeft','p-prev');assert.equal(P.getBeat(),3);C.key('1','p-next');assert.equal(P.getBeat(),0);C.key('5','steps');assert.equal(P.getBeat(),0);C.key('n','p-next');assert.ok(C.node('.present-tools details').open);assert.equal(C.key(' ','p-next'),false);C.key('r','p-next');assert.deepEqual(JSON.parse(JSON.stringify(selected.at(-1))),['vol',0]);
console.log('PASS Camel presenter: five beats, clamps, focused-button arrows, number shortcuts, notes toggle, input protection, native Space, scene reset');
console.log('Controller tests use a minimal DOM harness; they do not certify rendering, browser APIs or visual layout');
