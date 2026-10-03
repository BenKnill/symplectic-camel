import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
export const lane = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const kit = path.resolve(process.env.KIT_DIR || path.join(lane, 'out/wave2/kit-extracted-final'));
export const output = path.resolve(process.env.QA_OUTPUT || path.join(lane, 'out/wave2'));
export const chromiumPath = process.env.CHROMIUM_PATH || '/home/bluestar/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';
export const launchOptions = { executablePath: chromiumPath, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] };
export const presentations = [
  { name:'camel', file:'camel/index.html?present=1', count:5, next:'#p-next', back:'#p-prev', reset:'#p-reset', title:'#beat-title' },
  { name:'lattice', file:'lattice/index.html', count:4, next:'#scene-next', back:'#scene-prev', reset:'#scene-reset', title:'#scene-title' },
  { name:'rhine', file:'rhine/index.html', count:6, next:'#next', back:'#prev', reset:'#restart', title:'#title' },
  { name:'soap', file:'soap/index.html', count:4, next:'#scene-next', back:'#scene-prev', reset:'#scene-reset', title:'#scene-title' },
];
export const localURL = (file = 'index.html') => pathToFileURL(kit + '/').href + file;
export function insideKit(url) {const relative=path.relative(kit,fileURLToPath(url));return relative!== '..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);}
export async function sceneIndex(page, name) {
  return page.evaluate(name => name==='camel' ? window.CamelPresenter.getBeat() : name==='lattice' ? window.LatticeLive.getState().scene : name==='soap' ? window.SoapLive.getState().scene : window.RhineLive.getState().beat, name);
}
export async function ready(page, name) {
  await page.waitForFunction(name => name==='camel' ? window.CamelPresenter && window.CamelLive : name==='lattice' ? window.LatticeLive?.getState().ready && window.LatticeLive.getState().dir===0 : name==='soap' ? window.SoapLive?.getState().ready : window.RhineLive && window.FIGS, name);
}
export async function state(page, name) {
  return page.evaluate(name => {
    if(name==='camel') return {beat:window.CamelPresenter.getBeat(),...window.CamelLive.getState()};
    if(name==='lattice') return window.presentationState();
    if(name==='soap') return window.SoapLive.getState();
    return {...window.RhineLive.getState(), spins:document.querySelector('#showSpins').getAttribute('aria-pressed'),view:document.querySelector('#waterView').getAttribute('aria-pressed'),line:document.querySelector('[data-line][aria-pressed="true"]')?.dataset.line};
  },name);
}
export function observeErrors(page) {
  const result={nonFileRequests:[],outsideKitRequests:[],consoleErrors:[],pageErrors:[],failedFileRequests:[]};
  page.on('request',request=>{if(!request.url().startsWith('file:'))result.nonFileRequests.push(request.url());else if(!insideKit(request.url()))result.outsideKitRequests.push(request.url());});
  page.on('requestfailed',request=>result.failedFileRequests.push({url:request.url(),failure:request.failure()}));
  page.on('console',message=>{if(message.type()==='error')result.consoleErrors.push(message.text());});
  page.on('pageerror',error=>result.pageErrors.push(String(error)));
  return result;
}
export async function setRange(page, selector, value) {
  await page.locator(selector).evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},value);
}
export async function instrumentWebGL(page) {
  await page.addInitScript(()=>{
    window.__webgl=[];
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){
      const context=original.call(this,type,...args);
      if(context && /^webgl|experimental-webgl/.test(type) && !context.__qa){
        const extension=context.getExtension('WEBGL_debug_renderer_info');
        const entry={canvas:this.id,type,renderer:extension?context.getParameter(extension.UNMASKED_RENDERER_WEBGL):context.getParameter(context.RENDERER),version:context.getParameter(context.VERSION),drawCalls:0};
        window.__webgl.push(entry);context.__qa=true;
        for(const method of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced'])if(context[method]){const draw=context[method].bind(context);context[method]=(...values)=>{entry.drawCalls++;return draw(...values);};}
      }
      return context;
    };
  });
}
