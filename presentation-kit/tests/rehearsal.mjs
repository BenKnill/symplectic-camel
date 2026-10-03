import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { launchOptions, output, kit, presentations, localURL, ready, observeErrors, setRange } from './common.mjs';

const label=process.env.REHEARSAL_LABEL||'before';
const seconds=Number(process.env.SCENE_SECONDS||(label==='after'?20:12));
const directory=path.join(output,'rehearsals',label);
await fs.mkdir(directory,{recursive:true});
const browser=await chromium.launch(launchOptions);
const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:directory,size:{width:1440,height:1000}},reducedMotion:'no-preference'});
const page=await context.newPage();
const video=page.video();
const errors=observeErrors(page);
const started=Date.now(),events=[];
const mark=(event,detail={})=>{const record={seconds:Number(((Date.now()-started)/1000).toFixed(2)),event,...detail};events.push(record);console.log(JSON.stringify(record));};
try {
  await page.goto(localURL());mark('launcher');await page.waitForTimeout(4000);
  for(const presentation of presentations){
    const link=page.locator(`a[href*="${presentation.name}/index.html"]`).first();
    if(await link.count())await link.click();else await page.goto(localURL(presentation.file));
    await ready(page,presentation.name);
    for(let scene=0;scene<presentation.count;scene++){
      const sceneSeconds=label==='after'&&((presentation.name==='lattice'&&scene===3)||(presentation.name==='rhine'&&scene===5))?Math.max(seconds,30):seconds;
      const predictionSeconds=label==='after'&&presentation.name==='rhine'&&scene===0?Math.max(8,sceneSeconds*.35):sceneSeconds*.35;
      mark('scene',{presentation:presentation.name,scene,title:await page.locator(presentation.title).innerText(),plannedHoldSeconds:sceneSeconds});
      await page.evaluate(()=>scrollTo(0,0));
      await page.waitForTimeout(predictionSeconds*1000);
      if(presentation.name==='camel'&&scene===3){await page.locator('#play').click();mark('intervention',{action:'animate nonlinear map'});}
      if(presentation.name==='lattice'&&scene===3){
        for(let phase=1;phase<=4;phase++){await page.locator('#half-next').click();await page.waitForTimeout(1000);}
        mark('intervention',{action:'kick, drift, undo drift, undo kick; every identity home'});
      }
      if(presentation.name==='rhine'){
        if(scene===0&&await page.locator('#illustrationToggle').isVisible())await page.locator('#illustrationToggle').click();
        if(scene===0&&await page.locator('#showSpins').isVisible()){await page.locator('#showSpins').click();await page.waitForTimeout(800);await page.locator('#waterView').click();}
        if(scene===1){await setRange(page,'#dipG',40);await page.waitForTimeout(1200);await setRange(page,'#dipG',80);}
        if(scene===2){await page.locator('#loopPair').click();await setRange(page,'#loopX',0);await setRange(page,'#loopRadius',3);}
        if(scene===3)await page.locator('[data-line="arch"]').click();
        if(scene===4){await setRange(page,'#light',5);await page.waitForTimeout(1200);await setRange(page,'#light',95);}
        if(await page.locator('#reveal-result').count())await page.locator('#reveal-result').click();
        mark('intervention',{action:['compare labelled model, reveal spins, view from above','double circulation 40 to 80','opposite pair, centre loop x=0, radius=3','surface arch','move reflection 5 to 95','compare evidence'][scene]});
      }
      await page.evaluate(()=>scrollTo(0,0));
      await page.waitForTimeout((sceneSeconds-predictionSeconds)*1000);
      if(scene<presentation.count-1){await page.locator(presentation.next).click();await ready(page,presentation.name);}
    }
    await page.goto(localURL());mark('return to launcher',{presentation:presentation.name});await page.waitForTimeout(2000);
  }
  mark('complete');
} catch(error){mark('failure',{message:String(error)});process.exitCode=1;}
await context.close();
await video.saveAs(path.join(directory,`rehearsal-${label}.webm`));
await browser.close();
await fs.writeFile(path.join(directory,'events.json'),JSON.stringify({kit,label,kind:'silent operator rehearsal; speaker narration in separate notes',baseSecondsPerScene:seconds,viewport:{width:1440,height:1000},events,...errors},null,2)+'\n');
