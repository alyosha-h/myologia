// renders the app icons the same way the app prints a plate: flat tint under the line work, on a colour field.
// node scripts/icons.mjs   (needs playwright + chromium on the machine; not a build step)
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');
const pub = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
// masks need a real origin, so serve public/ for the length of the run
const srv = http.createServer((q, r) => fs.createReadStream(path.join(pub, decodeURIComponent(q.url))).on('error', () => r.writeHead(404).end()).pipe(r)).listen(0);
await new Promise((ok) => srv.on('listening', ok));
const base = `http://localhost:${srv.address().port}/`;
const u = (f) => base + f;
const FIELD = process.env.FIELD ?? '#C9B5F0', OUT = process.env.OUT ?? path.join(pub, 'icons');
// every muscle on plate I gets a colour; the chest keeps the loud one. TINTS='pec:#..,delt:#..' overrides
const TINTS = Object.fromEntries((process.env.TINTS ?? 'pec:#DCEE5A,delt:#F4A186,tri:#F0F7DC,abs:#F4A186,obl:#A9E0D6').split(',').map((t) => t.split(':')));

// crop of plate I (896x1200): the head thrown back, down to the top of the abdomen
const page = (size, crop) => `<!doctype html><style>
  html,body{margin:0} #i{position:relative;width:${size}px;height:${size}px;overflow:hidden;background:${FIELD}}
  #i>*{position:absolute;left:0;top:0;width:${896 * (size / crop.s)}px;height:${1200 * (size / crop.s)}px;translate:${-crop.x * (size / crop.s)}px ${-crop.y * (size / crop.s)}px}
  .mk{-webkit-mask-size:100% 100%;-webkit-mask-repeat:no-repeat}
  img{mix-blend-mode:multiply;filter:grayscale(1) contrast(1.5) brightness(1.02)}
</style><div id=i>${Object.entries(TINTS).map(([k, c]) => `<span class=mk style="background:${c};-webkit-mask-image:url(${u(`masks/pl1-${k}.png`)})"></span>`).join('')}<img src="${u('plates/pl1-anterior.jpg')}"></div>`;

const tight = { x: 198, y: 196, s: 500 };
const safe = { x: 108, y: 106, s: 680 }; // maskable: the same picture inside the middle 74%
const jobs = [['apple-touch-icon.png', 180, tight], ['icon-192.png', 192, tight], ['icon-512.png', 512, tight], ['icon-maskable-512.png', 512, safe]];

const b = await chromium.launch();
for (const [name, size, crop] of jobs) {
  // draw big, let the browser downsample, so the engraving's hairlines survive at 180px
  const k = Math.ceil(1024 / size);
  const p = await (await b.newContext({ viewport: { width: size, height: size }, deviceScaleFactor: k })).newPage();
  await p.goto(base + 'manifest.webmanifest'); await p.setContent(page(size, crop)); await p.waitForLoadState('networkidle');
  await p.locator('img').evaluate((im) => im.decode());
  const big = await p.locator('#i').screenshot();
  await p.close();
  const q = await (await b.newContext({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })).newPage();
  await q.setContent(`<style>html,body{margin:0}img{display:block;width:${size}px;height:${size}px}</style><img src="data:image/png;base64,${big.toString('base64')}">`);
  await q.screenshot({ path: path.join(OUT, name), omitBackground: false });
  await q.close();
  console.log(name, size);
}
await b.close();
srv.close();
