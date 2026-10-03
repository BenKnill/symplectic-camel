import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { kit,lane,launchOptions,localURL,ready,state,observeErrors,instrumentWebGL } from './common.mjs';
import { captureCamel,pngRegion } from './canvas-capture.mjs';

// Capture-only supplement. Interaction/reset/navigation coverage remains in the
// original whole-kit run and the complete three-viewport Camel supplement.
const output=path.resolve(process.env.QA_OUTPUT||path.join(lane,'out/wave2/qa-camel-overlay-check'));
const reviewed=path.resolve(process.env.REVIEWED_CAMEL_DIR||path.join(lane,'out/wave2/qa-camel-capture-fix'));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const readJSON=async file=>JSON.parse(await fs.readFile(file));
const report={status:'RUNNING',startedAt:new Date().toISOString(),kind:'Capture-only validation excluding DOM overlays',kit_manifest_sha256:hash(await fs.readFile(path.join(kit,'manifest.json'))),helper_module_sha256:hash(await fs.readFile(new URL('./canvas-capture.mjs',import.meta.url))),cases:[],regression:{rejected_with_overlays:false,fixtures:[]},errors:[]};
await fs.mkdir(path.join(output,'evidence'),{recursive:true});
const reportPath=path.join(output,'evidence/overlay-check.json');
const save=()=>fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
let browser;
try {
 assert.deepEqual(Object.values(os.networkInterfaces()).flat().filter(address=>!address.internal),[],'Run under unshare -rn');
 const relationship=await readJSON(path.join(reviewed,'evidence/supplement-relationship.json'));
 assert.equal(relationship.kitManifestSHA256,report.kit_manifest_sha256);
 report.reviewed_relationship={path:path.join(reviewed,'evidence/supplement-relationship.json'),sha256:hash(await fs.readFile(path.join(reviewed,'evidence/supplement-relationship.json')))};
 browser=await chromium.launch(launchOptions);
 for(const project of [{name:'desktop-1440',viewport:{width:1440,height:1000}},{name:'tablet-1024',viewport:{width:1024,height:768}},{name:'phone-emulation-390',viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:1}]){
  const context=await browser.newContext({viewport:project.viewport,isMobile:project.isMobile,deviceScaleFactor:project.deviceScaleFactor,hasTouch:true,reducedMotion:'reduce'});
  const page=await context.newPage(),errors=observeErrors(page);
  await instrumentWebGL(page);await page.goto(localURL('camel/index.html?present=1'));await ready(page,'camel');await page.evaluate(()=>document.fonts.ready);
  const oldPath=path.join(reviewed,'evidence',project.name+'-camel.json'),old=await readJSON(oldPath);
  assert.equal(old.kitManifestSHA256,report.kit_manifest_sha256);assert.equal(old.browser,browser.version());
  const binding=relationship.cases.find(c=>c.viewport===project.name);assert.equal(hash(await fs.readFile(oldPath)),binding.sha256);
  for(let scene=0;scene<5;scene++){
   await page.evaluate(index=>window.CamelPresenter.select(index),scene);await page.waitForTimeout(80);await page.evaluate(()=>scrollTo(0,0));
   const target=path.join(output,'screenshots',project.name,`camel-${String(scene+1).padStart(2,'0')}.png`);await fs.mkdir(path.dirname(target),{recursive:true});
   const capture=await captureCamel(page,target),current=await state(page,'camel'),original=old.scenes[scene];
   assert.deepEqual(current,original.state,'Exposed scene/model/camera state must match reviewed image');
   assert.deepEqual(capture.live.rect,original.capture.live.rect,'Canvas document rectangle must match exactly');
   assert.deepEqual(capture.live.viewport,original.capture.live.viewport,'Viewport must match exactly');
   const oldBytes=await fs.readFile(original.screenshot),freshBytes=await fs.readFile(target);
   assert.equal(hash(oldBytes),binding.captures.find(c=>c.scene===scene).sha256,'Reviewed image must remain unchanged');
   assert.deepEqual([freshBytes.readUInt32BE(16),freshBytes.readUInt32BE(20)],[oldBytes.readUInt32BE(16),oldBytes.readUInt32BE(20)],'Full document dimensions must match');
   const scale=oldBytes.readUInt32BE(16)/capture.live.viewport.width,scaled=rect=>Object.fromEntries(Object.entries(rect).map(([key,value])=>[key,value*scale]));
   const masked=pngRegion(oldBytes,scaled(capture.live.rect),capture.live.overlays.map(overlay=>scaled(overlay.excluded)));
   assert.ok(masked.colors>=100&&masked.bright>=100,'Reviewed saved WebGL region must remain colorful after excluding DOM overlays');
   report.cases.push({viewport:project.name,scene,reviewed_image:original.screenshot,reviewed_image_sha256:hash(oldBytes),reviewed_case:oldPath,reviewed_case_sha256:hash(await fs.readFile(oldPath)),masked_saved:masked,rect_matches:true,state_matches:true,document_dimensions_match:true,overlay_rectangle_basis:'Remeasured on identical frozen kit, exposed state, viewport and exact canvas/document rectangles; historical captures did not record overlay rectangles',fresh_image:target,fresh_image_sha256:hash(freshBytes),fresh_capture:capture});
   await save();console.log(`${project.name} scene ${scene+1}: fresh capture and immutable reviewed image pass masked pixels`);
  }
  // Only the canvas is blackened. All actual DOM captions, labels, gradients
  // and shadows remain visible, reproducing the false-positive concern.
  await page.evaluate(()=>window.CamelPresenter.select(3));await page.waitForTimeout(80);
  await page.locator('#gl').evaluate(canvas=>canvas.style.setProperty('filter','brightness(0)','important'));
  const fixture=path.join(output,'screenshots',project.name,'overlay-only-negative.png');let rejected;
  try{await captureCamel(page,fixture);}catch(error){if(!error.message.startsWith('Saved Camel canvas is blank: '))throw error;rejected=JSON.parse(error.message.slice('Saved Camel canvas is blank: '.length));}
  assert.ok(rejected,'Actual final guard must reject a black canvas with overlays preserved');
  const bytes=await fs.readFile(fixture),unmasked=pngRegion(bytes,rejected.saved.region);
  assert.ok(rejected.live.colors>=100&&rejected.live.bright>=100&&!rejected.live.contextLost&&rejected.live.glError===0,'Negative fixture still has healthy live WebGL pixels');
  assert.ok(rejected.saved.colors<100&&rejected.saved.bright<100,'Masked negative has no meaningful model pixels');
  if(project.name!=='phone-emulation-390')assert.ok(unmasked.colors>=100&&unmasked.bright>=100,'Desktop/tablet overlays alone must demonstrate the previous false positive');
  report.regression.fixtures.push({viewport:project.name,path:fixture,sha256:hash(bytes),rejected:true,actual_dom_overlays_preserved:true,unmasked_saved:unmasked,masked_saved:rejected.saved,live:rejected.live});
  assert.ok(Object.values(errors).every(items=>items.length===0),'Browser/resource errors: '+JSON.stringify(errors));
  report.errors.push({viewport:project.name,...errors});await save();await context.close();
 }
 assert.equal(report.cases.length,15);assert.equal(report.regression.fixtures.length,3);
 report.regression.rejected_with_overlays=true;
 report.status='PASS';report.completedAt=new Date().toISOString();
}catch(error){report.status='FAIL';report.failure=String(error.stack||error);process.exitCode=1;console.error(report.failure);}
finally{if(browser)await browser.close();await save();}
console.log(JSON.stringify({status:report.status,cases:report.cases.length,rejected_with_overlays:report.regression.rejected_with_overlays,report:reportPath}));
