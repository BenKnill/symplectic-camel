import puppeteer from 'puppeteer-core';
import path from 'node:path'; import { fileURLToPath } from 'node:url'; import fs from 'node:fs';
const here = path.dirname(fileURLToPath(import.meta.url));
const times = fs.readFileSync(path.join(here,'stills.txt'),'utf8').trim().split(',').map(Number);
const b = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new', args:['--use-angle=metal','--ignore-gpu-blocklist','--hide-scrollbars'] });
const p = await b.newPage(); await p.setViewport({width:1920,height:1080});
p.on('pageerror', e => console.log('[pageerror]', e.message));
await p.goto('file://'+path.join(here,'film.html'), {waitUntil:'networkidle0'}); await p.evaluate(()=>window.filmReady);
fs.mkdirSync(path.join(here,'stills'),{recursive:true});
for (const [k,t] of times.entries()) {
  // warm 6 s of trace history at 10 fps
  for (let u = Math.max(0,t-6); u < t; u += 0.1) await p.evaluate(x=>window.renderAt(x), u);
  await p.evaluate(x=>window.renderAt(x), t);
  await p.screenshot({path: path.join(here,`stills/s${k}.jpg`), type:'jpeg', quality:85});
}
await b.close(); console.log('ok');
