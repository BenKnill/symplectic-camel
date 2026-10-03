import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { test, expect } from '@playwright/test';
import { kit,output,presentations,localURL,insideKit,sceneIndex,ready,state,observeErrors,setRange,instrumentWebGL } from './common.mjs';
import { canonicalActions, performActions } from './rehearsal-actions.mjs';
import { captureCamel } from './canvas-capture.mjs';

test.beforeAll(async()=>{
  const external=Object.values(os.networkInterfaces()).flat().filter(address=>!address.internal);
  expect(external,'run this suite under unshare -rn: no non-loopback interface may exist').toEqual([]);
});

async function stable(page,presentation){await ready(page,presentation.name);await page.waitForTimeout(80);}
async function layout(page){
  return page.evaluate(()=>{
    const visible=element=>{const rect=element.getBoundingClientRect();return !!(rect.width&&rect.height)&&getComputedStyle(element).visibility!=='hidden';};
    const clipped=[...document.querySelectorAll('h1,h2,button,canvas')].filter(visible).filter(element=>{const rect=element.getBoundingClientRect();return rect.left < -2 || rect.right > innerWidth+2;}).map(element=>({tag:element.tagName,id:element.id,text:element.textContent?.slice(0,80),left:element.getBoundingClientRect().left,right:element.getBoundingClientRect().right}));
    const clippedByAncestor=[];
    for(const element of [...document.querySelectorAll('h1,h2,button,canvas')].filter(visible)){
      const rect=element.getBoundingClientRect();
      for(let parent=element.parentElement;parent;parent=parent.parentElement){
        const style=getComputedStyle(parent),bounds=parent.getBoundingClientRect();
        if((/^(hidden|clip)$/.test(style.overflowX)&&(rect.left<bounds.left-2||rect.right>bounds.right+2))||(/^(hidden|clip)$/.test(style.overflowY)&&(rect.top<bounds.top-2||rect.bottom>bounds.bottom+2)))clippedByAncestor.push({element:element.id||element.tagName,parent:parent.id||parent.className});
      }
    }
    const canvases=[...document.querySelectorAll('canvas')].filter(visible).map(element=>({id:element.id,width:element.width,height:element.height,displayWidth:element.getBoundingClientRect().width,displayHeight:element.getBoundingClientRect().height}));
    const trace=document.querySelector('#trace'),side=document.querySelector('.side');
    const traceFits=!trace||!side||!visible(trace)||(trace.getBoundingClientRect().top>=side.getBoundingClientRect().top-2&&trace.getBoundingClientRect().bottom<=side.getBoundingClientRect().bottom+2);
    const main=document.querySelector('body.presenting .main'),controls=document.querySelector('body.presenting .controls');
    const controlsClearMain=!main||!controls||controls.getBoundingClientRect().top>=main.getBoundingClientRect().bottom-2;
    return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,clipped,clippedByAncestor,traceFits,controlsClearMain,canvases};
  });
}
async function assertLayout(page){const result=await layout(page);expect(result.scrollWidth,'document must not scroll sideways').toBeLessThanOrEqual(result.width+2);expect(result.clipped,'heading/control/canvas edges must remain inside viewport').toEqual([]);expect(result.clippedByAncestor,'visible content must not be cropped by an ancestor').toEqual([]);expect(result.traceFits,'Camel trace must fit completely inside its sidebar').toBe(true);expect(result.controlsClearMain,'Camel controls must be below the main visual and sidebar').toBe(true);for(const canvas of result.canvases){expect(canvas.width).toBeGreaterThan(0);expect(canvas.height).toBeGreaterThan(0);expect(canvas.displayWidth).toBeGreaterThanOrEqual(90);}return result;}
async function navigate(page,presentation,direction,method){
  const selector=direction===1?presentation.next:presentation.back;
  if(method==='keyboard'){await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press(direction===1?'ArrowRight':'ArrowLeft');}
  else if(method==='touch')await page.locator(selector).tap();
  else await page.locator(selector).click();
  await stable(page,presentation);
}
async function inspectSoapNetwork(page,dip){
  const geometry=await page.evaluate(dip=>{
    const network=window.SoapModels.network(dip);
    return {pins:network.pins,vertices:[...network.pins,...network.jx],edges:network.edges,reportedLength:network.length(),competitor:window.SoapModels.referenceEdges};
  },dip);
  const length=edges=>edges.reduce((total,[a,b])=>total+Math.hypot(geometry.vertices[a].x-geometry.vertices[b].x,geometry.vertices[a].y-geometry.vertices[b].y),0);
  const reached=new Set([0]);
  for(let changed=true;changed;){changed=false;for(const [a,b] of geometry.edges)if(reached.has(a)!==reached.has(b)){reached.add(a);reached.add(b);changed=true;}}
  expect(geometry.pins).toHaveLength(6);
  expect(reached.size,'the demonstrated film connects every terminal and junction').toBe(geometry.vertices.length);
  expect(geometry.edges.length,'the displayed network is a tree').toBe(geometry.vertices.length-1);
  const competitorReached=new Set([0]);
  for(let changed=true;changed;){changed=false;for(const [a,b] of geometry.competitor)if(competitorReached.has(a)!==competitorReached.has(b)){competitorReached.add(a);competitorReached.add(b);changed=true;}}
  expect(competitorReached.size,'the five-side competitor independently connects all six pins').toBe(geometry.pins.length);
  expect(geometry.competitor).toHaveLength(geometry.pins.length-1);
  const measuredLength=length(geometry.edges),competitorLength=length(geometry.competitor);
  expect(measuredLength,'recompute actual segment lengths independently').toBeCloseTo(geometry.reportedLength,10);
  expect(competitorLength,'explicit five unit-length hexagon sides').toBeCloseTo(5,10);
  if(dip===0)expect(measuredLength,'a connected competitor is strictly shorter than the first local outcome').toBeGreaterThan(competitorLength);
  else expect(measuredLength,'the second chosen start reaches the five-unit network').toBeCloseTo(competitorLength,7);
  return {dip,vertices:geometry.vertices.length,edges:geometry.edges.length,connected:true,measuredLength,competitorLength};
}
async function distinctCanvasColors(page,selector){
  return page.locator(selector).evaluate(canvas=>{const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;const values=new Set();for(let i=0;i<pixels.length;i+=4)values.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`);return values.size;});
}
async function inspectSoapFilm(page,kind){
  const result=await page.evaluate(kind=>{
    const {model,initialArea,steps,lastMove}=window.SoapModels.film(kind);
    return {kind,area:model.area(),initialArea,steps,lastMove,vertices:model.V.length,triangles:model.tris.length,tripleEdges:model.tripleEdges.length,junctions:model.junctions.length};
  },kind);
  expect(result.area).toBeGreaterThan(0);
  expect(result.area,'relaxed numerical film has lower area than its starting mesh').toBeLessThan(result.initialArea);
  expect(result.steps).toBeGreaterThan(0);expect(Number.isFinite(result.lastMove)).toBe(true);
  expect(result.vertices).toBeGreaterThan(0);expect(result.triangles).toBeGreaterThan(0);
  expect(result.tripleEdges).toBeGreaterThan(0);expect(result.junctions).toBeGreaterThan(0);
  return result;
}
async function soapPixels(page,selector,kind){
  return page.locator(selector).evaluate((canvas,kind)=>{
    let pixels;
    if(kind==='webgl2'){
      const gl=canvas.getContext(kind);pixels=new Uint8Array(canvas.width*canvas.height*4);
      gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      if(gl.getError()!==gl.NO_ERROR)throw new Error('WebGL pixel read failed');
    }else pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    const colors=new Set();let hash=2166136261;
    for(let i=0;i<pixels.length;i+=4){colors.add((pixels[i]<<16)|(pixels[i+1]<<8)|pixels[i+2]);hash=Math.imul(hash^pixels[i],16777619);hash=Math.imul(hash^pixels[i+1],16777619);hash=Math.imul(hash^pixels[i+2],16777619);}
    return {colors:colors.size,digest:(hash>>>0).toString(16)};
  },kind);
}
async function changeSceneState(page,presentation,index){
  if(presentation.name==='camel'){
    const camera=await page.evaluate(()=>window.CamelLive.getState().camera);
    await page.locator('#gl').scrollIntoViewIfNeeded();const box=await page.locator('#gl').boundingBox();
    await page.mouse.move(box.x+box.width*.65,box.y+box.height*.55);await page.mouse.down();await page.mouse.move(box.x+box.width*.65+25,box.y+box.height*.55+20,{steps:3});await page.mouse.up();await page.mouse.wheel(0,120);
    await expect.poll(()=>page.evaluate(()=>window.CamelLive.getState().camera)).not.toEqual(camera);
    await setRange(page,'#R',.6);await setRange(page,'#s',.35);
    await page.locator('#play').click();await page.waitForTimeout(100);await page.locator('#play').click();
  }else if(presentation.name==='rhine'){
    if(index===0&&await page.locator('#illustrationToggle').isVisible())await page.locator('#illustrationToggle').click();
    if(index===0&&await page.locator('#showSpins').isVisible()){await page.locator('#showSpins').click();await page.locator('#waterView').click();}
    if(index===1){await setRange(page,'#dipG',40);await setRange(page,'#dipG',80);}
    if(index===2){await page.locator('#loopPair').click();await setRange(page,'#loopX',0);await setRange(page,'#loopRadius',3);}
    if(index===3)await page.locator('[data-line="arch"]').click();
    if(index===4){await setRange(page,'#light',5);await setRange(page,'#light',95);}
    if(await page.locator('#reveal-result').count())await page.locator('#reveal-result').click();
    await page.locator('#pause').click();await page.waitForTimeout(100);
  }else if(presentation.name==='soap'){
    await performActions(page,canonicalActions('soap',index));await stable(page,presentation);
    if(index>=2){
      const camera=(await state(page,'soap')).camera;
      await page.locator('#film').scrollIntoViewIfNeeded();const box=await page.locator('#film').boundingBox();
      await page.mouse.move(box.x+box.width*.6,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.6+25,box.y+box.height*.5+20,{steps:3});await page.mouse.up();await page.mouse.wheel(0,120);
      await expect.poll(async()=>(await state(page,'soap')).camera).not.toEqual(camera);
    }
  }
}

for(const presentation of presentations)test(`${presentation.name}: every scene, input, reset, render, resize`,async({page},testInfo)=>{
  const observed=observeErrors(page), evidence={presentation:presentation.name,viewport:testInfo.project.name,browser:page.context().browser().version(),kitManifestSHA256:crypto.createHash('sha256').update(await fs.readFile(path.join(kit,'manifest.json'))).digest('hex'),networkInterfaces:os.networkInterfaces(),scenes:[],inputMethods:[],resets:[],webgl:[]};
  await instrumentWebGL(page);
  await page.goto(localURL(presentation.file));await stable(page,presentation);
  const initial=await state(page,presentation.name);
  for(const method of ['mouse','keyboard','touch']){
    expect(await sceneIndex(page,presentation.name)).toBe(0);
    for(let index=0;index<presentation.count;index++){
      expect(await sceneIndex(page,presentation.name)).toBe(index);
      await expect(page.locator(presentation.title)).toBeVisible();
      if(method==='mouse'){
        if(presentation.name==='rhine'&&(index===0||index===5)){
          const video=page.locator(index===0?'#opening':'#closing');
          await expect(video).toBeVisible();
          await expect.poll(()=>video.evaluate(el=>el.readyState)).toBeGreaterThanOrEqual(2);
          const decoded=await video.evaluate(async el=>{el.currentTime=0;await el.play();return {width:el.videoWidth,height:el.videoHeight,source:el.currentSrc};});
          expect(decoded.width).toBeGreaterThan(0);expect(decoded.height).toBeGreaterThan(0);expect(decoded.source.startsWith('file:')).toBe(true);
          await expect.poll(()=>video.evaluate(el=>el.currentTime)).toBeGreaterThan(.15);
          const frames=await video.evaluate(el=>{el.pause();return el.getVideoPlaybackQuality().totalVideoFrames;});
          expect(frames,'video decoder presented frames').toBeGreaterThan(0);evidence.videos??=[];evidence.videos.push({scene:index,...decoded,played:true,decodedFrames:frames});
        }
        const sceneLayout=await assertLayout(page);
        await page.evaluate(()=>scrollTo(0,0));
        const screenshot=path.join(output,'screenshots',testInfo.project.name,`${presentation.name}-${String(index+1).padStart(2,'0')}.png`);
        await fs.mkdir(path.dirname(screenshot),{recursive:true});
        const capture=presentation.name==='camel'?await captureCamel(page,screenshot):(await page.screenshot({path:screenshot,fullPage:true}),null);
        if(capture){evidence.canvasCaptures??=[];evidence.canvasCaptures.push({scene:index,screenshot,...capture,pass:true});}
        evidence.scenes.push({index,title:await page.locator(presentation.title).innerText(),layout:sceneLayout,screenshot,state:await state(page,presentation.name),...(capture?{capture}:{})});
        if(presentation.name==='lattice'&&index===2){const result=await state(page,presentation.name);expect(result.step).toBe(0);expect(result.dir).toBe(0);expect(result.badL).toBe(0);expect(result.distinct).toBe(65536);expect(result.badF,'floating-point display differs after the canonical round trip').toBeGreaterThan(0);}
        if(presentation.name==='rhine'&&index===0){
          await page.locator('#illustrationToggle').click();await page.waitForTimeout(200);
          await expect(page.locator('#opening-water')).toBeVisible();await assertLayout(page);
          await page.screenshot({path:path.join(output,'screenshots',testInfo.project.name,'rhine-01-model.png'),fullPage:true});
          await page.locator('#illustrationToggle').click();
        }
        if(presentation.name==='rhine'&&index===2){
          await page.locator('#loopPair').click();await setRange(page,'#loopX',0);await setRange(page,'#loopRadius',3);
          const loop=await page.evaluate(()=>window.FIGS.figLoop.getState());
          expect(loop.pair).toBe(true);expect(loop.loop.x).toBe(0);expect(loop.loop.r).toBe(3);expect(Math.abs(loop.measured),'opposite signed circulation cancels').toBeLessThan(1e-6);
          expect(loop.viewport.contour.left,'closed contour fits left edge').toBeGreaterThanOrEqual(6);
          expect(loop.viewport.contour.top,'closed contour fits top edge').toBeGreaterThanOrEqual(6);
          expect(loop.viewport.contour.right,'closed contour and handle fit right edge').toBeLessThanOrEqual(loop.viewport.width-6);
          expect(loop.viewport.contour.bottom,'closed contour fits bottom edge').toBeLessThanOrEqual(loop.viewport.height-6);
          await page.locator('#reveal-result').click();await page.screenshot({path:path.join(output,'screenshots',testInfo.project.name,'rhine-03-closed-contour.png'),fullPage:true});
          evidence.closedContour={measured:loop.measured,viewport:loop.viewport};await page.locator(presentation.reset).click();await stable(page,presentation);
        }
        if(presentation.name==='lattice'&&index===3){
          const home=await page.evaluate(()=>window.LatticeLive.toyState());
          for(let phase=1;phase<=4;phase++){await page.locator('#half-next').click();expect(await page.evaluate(()=>window.LatticeLive.getState().phase)).toBe(phase);await expect(page.locator('#occupancy')).toContainText('0 lost cells');}
          expect(await page.evaluate(()=>window.LatticeLive.toyState()),'four half-steps return every toy identity home').toEqual(home);
          await page.screenshot({path:path.join(output,'screenshots',testInfo.project.name,'lattice-04-toy-return.png'),fullPage:true});
          for(let phase=3;phase>=0;phase--){await page.locator('#half-prev').click();expect(await page.evaluate(()=>window.LatticeLive.getState().phase)).toBe(phase);}
          evidence.toyRoundTrip={phases:5,allIdentitiesReturned:true,previousSteps:true};
        }
        if(presentation.name==='soap'){
          const before=await state(page,'soap');
          expect(before.ready).toBe(true);expect(before.error).toBeNull();expect(before.playing).toBe(false);
          const selector=index<2?'#network':'#film',renderer=index<2?'canvas2d':'webgl2';
          const pixelsBefore=await soapPixels(page,selector,renderer);
          const actions=canonicalActions('soap',index);let intermediate=null;
          if(index===1||index===2){
            await performActions(page,actions.slice(0,-1));await stable(page,presentation);
            intermediate={state:await state(page,'soap'),pixels:await soapPixels(page,selector,renderer)};
            if(index===1){
              expect(intermediate.state.comparison,'show shorter competitor before changing dip').toBe(true);
              expect(intermediate.state.dip).toBe(0);expect(intermediate.state.model.length).toBeGreaterThan(intermediate.state.model.referenceLength);
              expect(intermediate.pixels.digest,'competitor overlay is actually drawn').not.toBe(pixelsBefore.digest);
              await expect(page.locator('#metric-detail')).toContainText('5.000');
            }else{
              expect(intermediate.state.camera,'actual pointer drag rotates the camera').not.toEqual(before.camera);
              expect(intermediate.state.highlighted).toBe(false);
            }
            await performActions(page,actions.slice(-1));
          }else await performActions(page,actions);
          await stable(page,presentation);
          const after=await state(page,'soap'),pixelsAfter=await soapPixels(page,selector,renderer);
          expect(after,'operator input changes the actual exposed model or display state').not.toEqual(before);
          expect(pixelsAfter.colors,'Soap canvas contains actual nonuniform rendered pixels').toBeGreaterThan(10);
          expect(pixelsAfter.digest,'canonical intervention visibly changes the canvas').not.toBe(pixelsBefore.digest);
          const result={scene:index,before,intermediate,after,pixelsBefore,pixelsAfter};
          if(index<2){
            expect(after.revealed).toBe(true);await expect(page.locator('#metric')).toBeVisible();
            result.network=await inspectSoapNetwork(page,after.dip);
            expect(after.model.length).toBeCloseTo(result.network.measuredLength,7);
            await expect(page.locator('#metric-value')).toHaveText(result.network.measuredLength.toFixed(3));
            if(index===0){expect(after.seed).toBe(1);expect(after.model.junctions).toHaveLength(4);}
            else {
              expect(after.seed).toBe(4);expect(after.comparison,'new dip clears the old overlay so two gaps do not look like a hexagon').toBe(false);expect(after.model.junctions).toHaveLength(0);
              expect(after.model.pins,'both dips keep exactly the same six pins').toEqual(before.model.pins);
              expect(after.model.length,'the second selected outcome is shorter').toBeLessThan(before.model.length);
              await expect(page.locator('#soap-compare')).toHaveAttribute('aria-pressed','false');
              await expect(page.locator('#metric-detail')).toContainText('5.196');
            }
          }else{
            result.film=await inspectSoapFilm(page,after.model.frame);
            expect(after.model.type).toBe('surface');expect(after.model.frame).toBe('tetrahedron');
            expect(after.model.area).toBeCloseTo(result.film.area,7);
            expect(after.model.triangles).toBe(result.film.triangles);
            expect(after.model.tripleEdges).toBe(result.film.tripleEdges);
            expect(after.model.junctions).toBe(result.film.junctions);
            expect(after.highlighted).toBe(true);
            if(index===2){await expect(page.locator('#laws')).toBeVisible();expect(pixelsAfter.digest,'junction marks change rendered pixels after the rotation').not.toBe(intermediate.pixels.digest);}
            else {
              expect(before.model.frame).toBe('cube');expect(after.model.digest).not.toBe(before.model.digest);
              expect(after.model.triangles).not.toBe(before.model.triangles);await expect(page.locator('#theorem')).toBeVisible();
            }
          }
          await assertLayout(page);await page.evaluate(()=>scrollTo(0,0));
          result.screenshot=path.join(output,'screenshots',testInfo.project.name,`soap-${String(index+1).padStart(2,'0')}-reveal.png`);
          await page.screenshot({path:result.screenshot,fullPage:true});
          if(index===1){
            await page.locator('#soap-compare').click();await stable(page,presentation);
            expect((await state(page,'soap')).comparison).toBe(true);
            await expect(page.locator('#metric-detail'),'deliberately comparing equal networks must say equal').toContainText(/equal/i);
            result.equalComparison={state:await state(page,'soap'),detail:await page.locator('#metric-detail').innerText()};
          }
          evidence.soapResults??=[];evidence.soapResults.push(result);
          await page.locator(presentation.reset).click();await stable(page,presentation);
          expect(await state(page,'soap'),'canonical intervention reset restores complete state').toEqual(before);
        }
      }
      if(index<presentation.count-1)await navigate(page,presentation,1,method);
    }
    await expect(page.locator(presentation.next)).toBeDisabled();
    for(let index=presentation.count-2;index>=0;index--){await navigate(page,presentation,-1,method);expect(await sceneIndex(page,presentation.name)).toBe(index);}
    await expect(page.locator(presentation.back)).toBeDisabled();evidence.inputMethods.push({method,forward:true,backward:true,scenes:presentation.count});
  }
  for(let index=0;index<presentation.count;index++){
    if(presentation.name==='lattice'){
      for(let step=0;step<index;step++)await navigate(page,presentation,1,'mouse');
      if(index===0){await page.keyboard.press('s');await page.waitForFunction(()=>window.LatticeLive.getState().step>0);await ready(page,presentation.name);}
      if(index===3){await page.locator('#half-next').click();await page.locator('#grid button').nth(20).click();}
      expect(await state(page,presentation.name)).not.toEqual(initial);
      await page.locator(presentation.reset).click();await stable(page,presentation);
      expect(await state(page,presentation.name),'reset restores all initial lattice state').toEqual(initial);
      evidence.resets.push({from:index,to:0,comparison:'full model state including all 64 toy cells',pass:true});
    }else{
      if(index>0)await navigate(page,presentation,1,'mouse');
      await page.locator(presentation.reset).click();await stable(page,presentation);
      const baseline=await state(page,presentation.name);await changeSceneState(page,presentation,index);
      expect(await state(page,presentation.name),'intervention changed state before reset').not.toEqual(baseline);
      await assertLayout(page);
      if(presentation.name==='rhine'){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(output,'screenshots',testInfo.project.name,`rhine-${String(index+1).padStart(2,'0')}-reveal.png`),fullPage:true});}
      await page.locator(presentation.reset).click();await stable(page,presentation);
      expect(await state(page,presentation.name),'reset restores this scene initial model state').toEqual(baseline);
      if(presentation.name==='rhine'&&(index===0||index===5))await expect.poll(()=>page.locator(index===0?'#opening':'#closing').evaluate(el=>el.currentTime)).toBeLessThan(.01);
      evidence.resets.push({from:index,to:index,comparison:'complete exposed controller state and visible toggles',pass:true});
    }
  }
  const original=page.viewportSize();
  if(presentation.name==='rhine'){await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('Home');await stable(page,presentation);await page.locator('#illustrationToggle').click();await expect(page.locator('#opening-water')).toBeVisible();}
  evidence.resize=[];
  for(const target of presentation.name==='soap'?[0,3]:[null]){
    if(target!==null){
      while(await sceneIndex(page,presentation.name)!==target){const current=await sceneIndex(page,presentation.name);await navigate(page,presentation,current<target?1:-1,'mouse');}
    }
    for(const viewport of [{width:800,height:600},{width:390,height:844},original]){
      await page.setViewportSize(viewport);await page.waitForTimeout(150);
      const resized=await assertLayout(page);expect(resized.canvases.length,'resize must exercise a visible renderer').toBeGreaterThan(0);
      if(presentation.name==='soap'){
        const scale=await page.evaluate(()=>Math.min(devicePixelRatio,2));
        for(const canvas of resized.canvases){expect(Math.abs(canvas.width-canvas.displayWidth*scale),'Soap backing width follows CSS resize').toBeLessThanOrEqual(2);expect(Math.abs(canvas.height-canvas.displayHeight*scale),'Soap backing height follows CSS resize').toBeLessThanOrEqual(2);}
      }
      evidence.resize.push({scene:await sceneIndex(page,presentation.name),viewport,layout:resized});
    }
  }
  evidence.webgl=await page.evaluate(()=>window.__webgl);
  if(presentation.name!=='lattice'){
    expect(evidence.webgl.length,'WebGL context exists').toBeGreaterThan(0);
    expect(evidence.webgl.some(context=>context.drawCalls>0),'WebGL submitted rendering commands').toBe(true);
    expect(evidence.webgl.some(context=>/SwiftShader/.test(context.renderer)),'recorded software renderer must match documented environment').toBe(true);
  }else if(presentation.name==='lattice'){
    const colorCount=await distinctCanvasColors(page,'#exact');
    expect(colorCount,'lattice rendered image contains actual nonuniform pixels').toBeGreaterThan(10);evidence.canvasDistinctColors=colorCount;
  }
  Object.assign(evidence,observed);await fs.mkdir(path.join(output,'evidence'),{recursive:true});await fs.writeFile(path.join(output,'evidence',`${testInfo.project.name}-${presentation.name}.json`),JSON.stringify(evidence,null,2)+'\n');
  expect(observed.nonFileRequests,'no request used any non-file URL').toEqual([]);expect(observed.outsideKitRequests,'every local resource is inside the extraction').toEqual([]);expect(observed.consoleErrors,'zero browser console errors').toEqual([]);expect(observed.pageErrors,'zero uncaught JavaScript errors').toEqual([]);expect(observed.failedFileRequests,'all requested local resources exist').toEqual([]);
});

test('launcher and all local HTML links navigate offline',async({page})=>{
  const observed=observeErrors(page),queue=[localURL()],seen=new Set();
  while(queue.length){
    const url=queue.shift();if(seen.has(url))continue;seen.add(url);
    await page.goto(url);await page.waitForTimeout(100);
    await expect(page.locator('body')).toBeVisible();
    for(const link of await page.locator('a[href]').evaluateAll(links=>links.map(link=>link.href))){const parsed=new URL(link);if(parsed.protocol==='file:'&&/\.html$/.test(parsed.pathname)){expect(insideKit(parsed.href),'local link must stay inside extraction').toBe(true);parsed.hash='';if(!seen.has(parsed.href))queue.push(parsed.href);}}
    expect(seen.size,'finite local navigation graph').toBeLessThan(40);
  }
  for(const presentation of presentations){await page.goto(localURL());const link=page.locator(`a[href*="${presentation.name}/index.html"]`).first();await expect(link).toBeVisible();await link.tap();await ready(page,presentation.name);expect(page.url()).toContain(`/${presentation.name}/index.html`);}
  expect(observed.nonFileRequests).toEqual([]);expect(observed.outsideKitRequests).toEqual([]);expect(observed.consoleErrors).toEqual([]);expect(observed.pageErrors).toEqual([]);expect(observed.failedFileRequests).toEqual([]);
});

test('speaker notes each print on one A4 page',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-1440','printing is independent of viewport emulation');
  const notes=[];
  for(const presentation of presentations){
    await page.goto(localURL(`${presentation.name}/live-guide.html`));
    await page.emulateMedia({media:'print'});
    const target=path.join(output,'evidence',`${presentation.name}-speaker-notes.pdf`);
    const pdf=await page.pdf({path:target,format:'A4',printBackground:true,preferCSSPageSize:true});
    const pages=(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;
    expect(pages,`${presentation.name} notes must be at most one printed page`).toBe(1);
    notes.push({presentation:presentation.name,pages,file:target});
  }
  await fs.writeFile(path.join(output,'evidence/speaker-notes-pages.json'),JSON.stringify(notes,null,2)+'\n');
});
