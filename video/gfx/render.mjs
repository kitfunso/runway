// Renders gfx.html frame by frame into mp4s and transparent chip PNGs. Usage: node render.mjs [s1 s2 s9 chips]
import { chromium } from 'file:///C:/Users/skf_s/AppData/Roaming/npm/node_modules/@playwright/mcp/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const SCENES = { s1: 11, s2: 14, s9: 7 };
const CHIPS = [3, 4, 5, 6, 7, 8];
const FPS = 30;
const want = process.argv.slice(2);
const todo = want.length ? want : [...Object.keys(SCENES), 'chips'];

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(dir, 'gfx.html')).href, { waitUntil: 'networkidle' });
const loaded = await page.evaluate(() => window.ready);
if (loaded < 4) throw new Error(`IBM Plex fonts did not load (${loaded} faces)`);
console.log(`fonts loaded: ${loaded} faces`);

async function encode(name, dur) {
  const out = path.join(dir, `${name}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-r', String(FPS), '-movflags', '+faststart', out],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error(`ffmpeg exit ${c}`)))));
  const n = Math.round(dur * FPS);
  for (let f = 0; f < n; f++) {
    await page.evaluate(([s, t]) => window.render(s, t), [name, f / FPS]);
    const buf = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await done;
  console.log(`${out}: ${n} frames`);
}

for (const name of todo) {
  if (name === 'chips') {
    for (const i of CHIPS) {
      await page.evaluate(n => window.render('chip', n), i);
      const out = path.join(dir, `chip-s${i}.png`);
      await page.screenshot({ path: out, omitBackground: true });
      console.log(out);
    }
  } else {
    await encode(name, SCENES[name]);
  }
}
await browser.close();
