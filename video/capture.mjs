// Render film.html frame by frame in headless Chrome and pipe JPEGs to ffmpeg.
// usage: node capture.mjs [--fps 30] [--from 0] [--to DURATION] [--out frames.mp4]
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const png = process.argv.includes('--png'), lossless = process.argv.includes('--lossless');
const fps = +arg('fps', 30), from = +arg('from', 0), out = arg('out', path.join(here, 'picture.mp4'));

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--hide-scrollbars', '--force-color-profile=srgb'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
page.on('console', m => console.log('[page]', m.text()));
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto('file://' + path.join(here, 'film.html') + (arg('query', '') ? '?' + arg('query', '') : ''), { waitUntil: 'networkidle0' });
await page.evaluate(() => window.filmReady);
const duration = await page.evaluate(() => window.DURATION);
const to = +arg('to', duration);
const n0 = Math.round(from * fps), n1 = Math.round(to * fps);

const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', png ? 'png' : 'mjpeg', '-i', '-',
  ...(lossless ? ['-c:v', 'ffv1', '-pix_fmt', 'yuv444p'] : ['-c:v', 'libx264', '-preset', 'slow', '-crf', arg('crf', '23'), '-maxrate', '14M', '-bufsize', '28M', '-pix_fmt', 'yuv420p', '-movflags', '+faststart']),
  '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', out], { stdio: ['pipe', 'inherit', 'inherit'] });
const cdp = await page.createCDPSession();
// warm the trace history if starting mid-film
if (n0 > 0) for (let f = Math.max(0, n0 - 14 * fps); f < n0; f++) await page.evaluate(t => window.renderAt(t), f / fps);
const t0 = Date.now();
for (let f = n0; f < n1; f++) {
  await page.evaluate(t => window.renderAt(t), f / fps);
  const { data } = await cdp.send('Page.captureScreenshot', png ? { format: 'png', optimizeForSpeed: true } : { format: 'jpeg', quality: 94, optimizeForSpeed: false });
  if (!ff.stdin.write(Buffer.from(data, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
  if ((f - n0) % 150 === 0) console.log(`frame ${f}/${n1}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close();
console.log('wrote', out);
