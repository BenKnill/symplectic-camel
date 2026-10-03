import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from '@playwright/test';
import { launchOptions, output, kit, presentations, localURL, ready, observeErrors } from './common.mjs';
import { canonicalActions, actionDescription, performActions } from './rehearsal-actions.mjs';

const label=process.env.REHEARSAL_LABEL||'before';
const seconds=Number(process.env.SCENE_SECONDS||(label==='after'?20:12));
const directory=path.join(output,'rehearsals',label);
await fs.mkdir(directory,{recursive:true});
try {await fs.access(path.join(directory,'events.json'));throw new Error(`Rehearsal already exists: ${directory}. Archive it or use another REHEARSAL_LABEL.`);}catch(error){if(error.code!=='ENOENT')throw error;}
const kitManifestSHA256=crypto.createHash('sha256').update(await fs.readFile(path.join(kit,'manifest.json'))).digest('hex');
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
      const sceneSeconds=label==='after'&&((presentation.name==='lattice'&&scene===3)||(presentation.name==='rhine'&&scene===5)||(presentation.name==='soap'&&scene===3))?Math.max(seconds,30):seconds;
      const predictionSeconds=label==='after'&&presentation.name==='rhine'&&scene===0?Math.max(8,sceneSeconds*.35):sceneSeconds*.35;
      mark('scene',{presentation:presentation.name,scene,title:await page.locator(presentation.title).innerText(),plannedHoldSeconds:sceneSeconds});
      await page.evaluate(()=>scrollTo(0,0));
      await page.waitForTimeout(predictionSeconds*1000);
      const actions=canonicalActions(presentation.name,scene);
      await performActions(page,actions);
      if(actions.length){
        await ready(page,presentation.name);
        mark('intervention',{action:actionDescription(presentation.name,scene),inputs:actions,...(presentation.name==='soap'?{state:await page.evaluate(()=>window.SoapLive.getState())}:{})});
      }
      await page.evaluate(()=>scrollTo(0,0));
      await page.waitForTimeout((sceneSeconds-predictionSeconds)*1000);
      if(scene<presentation.count-1){await page.locator(presentation.next).click();await ready(page,presentation.name);}
    }
    await page.goto(localURL());mark('return to launcher',{presentation:presentation.name});await page.waitForTimeout(2000);
  }
  mark('complete');
} catch(error){mark('failure',{message:String(error)});process.exitCode=1;}
if(Object.values(errors).some(values=>values.length)){mark('failure',{message:'Browser errors or resources outside the offline extraction',errors});process.exitCode=1;}
await context.close();
await video.saveAs(path.join(directory,`rehearsal-${label}.webm`));
await browser.close();
await fs.writeFile(path.join(directory,'events.json'),JSON.stringify({kit,kitManifestSHA256,label,presentations:presentations.map(({name,count})=>({name,scenes:count})),kind:'silent operator rehearsal; speaker narration in separate notes',baseSecondsPerScene:seconds,viewport:{width:1440,height:1000},events,...errors},null,2)+'\n');
