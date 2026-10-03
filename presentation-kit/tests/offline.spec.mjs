import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { test, expect } from '@playwright/test';
import { kit,output,presentations,localURL,insideKit,sceneIndex,ready,state,observeErrors,setRange,instrumentWebGL } from './common.mjs';

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
        await fs.mkdir(path.dirname(screenshot),{recursive:true});await page.screenshot({path:screenshot,fullPage:true});
        evidence.scenes.push({index,title:await page.locator(presentation.title).innerText(),layout:sceneLayout,screenshot,state:await state(page,presentation.name)});
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
  for(const viewport of [{width:800,height:600},{width:390,height:844},original]){await page.setViewportSize(viewport);await page.waitForTimeout(150);const resized=await assertLayout(page);expect(resized.canvases.length,'resize must exercise a visible renderer').toBeGreaterThan(0);evidence.resize.push({viewport,layout:resized});}
  evidence.webgl=await page.evaluate(()=>window.__webgl);
  if(presentation.name!=='lattice'){
    expect(evidence.webgl.length,'WebGL context exists').toBeGreaterThan(0);
    expect(evidence.webgl.some(context=>context.drawCalls>0),'WebGL submitted rendering commands').toBe(true);
    expect(evidence.webgl.some(context=>/SwiftShader/.test(context.renderer)),'recorded software renderer must match documented environment').toBe(true);
  }else if(presentation.name==='lattice'){
    const colorCount=await page.locator('#exact').evaluate(canvas=>{const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;const values=new Set();for(let i=0;i<pixels.length;i+=4)values.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`);return values.size;});
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
