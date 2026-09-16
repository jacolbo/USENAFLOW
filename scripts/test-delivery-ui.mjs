// Serves Usena's built client against a stubbed delivery API, so the page can
// be driven in a real browser without a Neon database.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { png } from './png.mjs';

const DIST = '/home/user/usenaflow/dist/public';
const TOKEN = 'testtoken_abcdefghijklmnopqrstuvwxyz012345';

const colours = [[205,150,120],[120,150,200],[150,180,140],[200,170,190],[170,170,170],[220,190,150]];
const photos = colours.map((c, i) => ({
  id: `photo-${i + 1}`,
  filename: `_MG_${1613 + i * 8}.jpg`,
  thumbUrl: `/api/d/${TOKEN}/thumb/photo-${i + 1}`,
  previewUrl: `/api/d/${TOKEN}/preview/photo-${i + 1}`,
  ready: true,
  thumbBytes: png(400, 500, c),
  bytes: png(1200, 1500, c),
}));
const served = { thumb: 0, preview: 0 };

let approved = process.env.APPROVED === '1';

const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.mp3':'audio/mpeg', '.svg':'image/svg+xml' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === `/api/d/${TOKEN}`) {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({
      title: 'Ana & Tom', clientName: 'Ana', photoCount: photos.length,
      canDownload: approved, coverPhotoId: 'photo-1',
      photos: photos.map(({ id, filename, thumbUrl, previewUrl, ready }) => ({ id, filename, thumbUrl, previewUrl, ready })),
    }));
  }
  const derivative = url.pathname.match(new RegExp(`^/api/d/${TOKEN}/(thumb|preview)/(.+)$`));
  if (derivative) {
    const photo = photos.find((p) => p.id === derivative[2]);
    if (!photo) { res.writeHead(404); return res.end(); }
    served[derivative[1]] += 1;
    res.writeHead(200, { 'content-type': 'image/png' });
    return res.end(derivative[1] === 'thumb' ? photo.thumbBytes : photo.bytes);
  }
  if (url.pathname.startsWith(`/api/d/${TOKEN}/download`)) {
    if (!approved) { res.writeHead(403, {'content-type':'application/json'}); return res.end(JSON.stringify({error:'These photos have not been released yet.'})); }
    res.writeHead(200, { 'content-type': 'application/zip' });
    return res.end(Buffer.from('PK\x05\x06' + '\0'.repeat(18)));
  }

  let file = path.join(DIST, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const { chromium } = await import('playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message));

let n = 0, ok = 0;
const check = (name, c, d='') => { n++; console.log(c ? `  ✓ ${name}` : `  ✗ ${name} ${d}`); if (c) ok++; };

// ---- not yet released
await page.goto(`${base}/d/${TOKEN}`);
await page.waitForSelector('img', { timeout: 15000 });
check('the gallery opens', (await page.textContent('h1')) === 'Ana & Tom');
check('all photographs render', (await page.locator('main img').count()) === 6, String(await page.locator('main img').count()));
await page.waitForTimeout(400);
check('the grid asked for thumbnails, not full previews', served.thumb === 6, `thumb=${served.thumb} preview=${served.preview}`);
check('only the cover pulled a full preview', served.preview === 1, `preview=${served.preview}`);
check('no download button before release', await page.locator('[data-testid=button-download-all]').count() === 0);
check('and it says why', /releases the gallery/.test(await page.textContent('[data-testid=text-not-released]') || ''));
check('no Drive URL anywhere in the page', !/drive\.google|googleusercontent|googleapis/.test(await page.content()));
await page.screenshot({ path: '/tmp/delivery-locked.png' });

// ---- lightbox
const previewsBefore = served.preview;
// Deliberately NOT the first photo: that one is the cover, whose full preview
// the browser already holds, so it would be served from cache and prove nothing.
await page.locator('main button').nth(2).click();
await page.waitForSelector('[data-testid=button-close-lightbox]');
check('the lightbox opens', await page.isVisible('[data-testid=button-close-lightbox]'));
await page.waitForTimeout(400);
check('opening a photo fetches the full preview', served.preview > previewsBefore, `${previewsBefore} -> ${served.preview}`);
check('it names the file', /_MG_1629/.test(await page.content()));
check('no per-photo download while locked', await page.locator('[data-testid=link-download-one]').count() === 0);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(150);
check('arrow keys move through the gallery', /_MG_1637/.test(await page.content()));
await page.screenshot({ path: '/tmp/delivery-lightbox.png' });
await page.keyboard.press('Escape');

// ---- released
approved = true;
await page.reload();
await page.waitForSelector('[data-testid=button-download-all]', { timeout: 15000 });
check('the download button appears once released', await page.isVisible('[data-testid=button-download-all]'));
await page.locator('main button').first().click();
await page.waitForSelector('[data-testid=link-download-one]');
check('and a per-photo download too', await page.isVisible('[data-testid=link-download-one]'));
await page.keyboard.press('Escape');
await page.screenshot({ path: '/tmp/delivery-released.png' });

// ---- phone
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(250);
const scrolls = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
check('no horizontal scroll on a phone', !scrolls);
await page.screenshot({ path: '/tmp/delivery-phone.png', fullPage: false });

check('no uncaught JavaScript errors', errors.length === 0, errors.join(' | '));

await browser.close(); server.close();
console.log(`\n${ok}/${n} checks passed`);
process.exit(ok === n ? 0 : 1);
