import puppeteer from 'puppeteer-core'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)); const [q, t, out] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new', args:['--use-angle=metal','--ignore-gpu-blocklist','--hide-scrollbars','--force-color-profile=srgb'] });
const p = await b.newPage(); await p.setViewport({width:1920,height:1080});
await p.goto('file://'+path.join(here,'film.html')+'?'+q, {waitUntil:'networkidle0'}); await p.evaluate(()=>window.filmReady);
await p.evaluate(x=>window.renderAt(x), +t); await p.screenshot({path: out}); await b.close();
