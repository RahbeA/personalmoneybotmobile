#!/usr/bin/env node
/**
 * Render a transparent PNG still from a .glb using headless Chromium + model-viewer.
 *
 * Usage: node preview.mjs <input.glb> <output.png> [size]
 * Prints one JSON stats line to stdout on success.
 */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import puppeteer from 'puppeteer';

const MODEL_VIEWER_CDN =
  'https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js';

function resolveChromePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

const input = process.argv[2];
const output = process.argv[3];
const size = Math.max(128, Math.min(1024, Number(process.argv[4]) || 512));

if (!input || !output) {
  console.error('Usage: node preview.mjs <input.glb> <output.png> [size]');
  process.exit(2);
}

const srcPath = path.resolve(input);
const outPath = path.resolve(output);

if (!fs.existsSync(srcPath)) {
  console.error(`Input not found: ${srcPath}`);
  process.exit(1);
}

const glb = fs.readFileSync(srcPath);
const b64 = glb.toString('base64');

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <script type="module" src="${MODEL_VIEWER_CDN}"></script>
  <style>
    html, body {
      margin: 0; padding: 0; width: ${size}px; height: ${size}px;
      background: transparent; overflow: hidden;
    }
    model-viewer {
      width: ${size}px; height: ${size}px;
      background-color: transparent;
      --poster-color: transparent;
    }
  </style>
</head>
<body>
  <model-viewer
    id="mv"
    interaction-prompt="none"
    shadow-intensity="1"
    exposure="1"
    environment-image="neutral"
    camera-orbit="30deg 75deg 105%"
    field-of-view="28deg"
    disable-tap
  ></model-viewer>
  <script type="module">
    const b64 = ${JSON.stringify(b64)};
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'model/gltf-binary' });
    const url = URL.createObjectURL(blob);
    const mv = document.getElementById('mv');

    window.__previewReady = false;
    window.__previewError = null;
    window.__previewDataUrl = null;

    mv.addEventListener('error', (e) => {
      window.__previewError = (e && e.detail && JSON.stringify(e.detail)) || 'model-viewer error';
    });

    mv.addEventListener('load', async () => {
      await new Promise((r) => setTimeout(r, 700));
      try {
        let dataUrl;
        if (typeof mv.toDataURL === 'function') {
          dataUrl = await mv.toDataURL('image/png');
        } else if (typeof mv.toBlob === 'function') {
          const blobOut = await mv.toBlob({ mimeType: 'image/png', qualityArgument: 1 });
          const reader = new FileReader();
          dataUrl = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blobOut);
          });
        } else {
          window.__previewError = 'Capture API unavailable';
          return;
        }
        window.__previewDataUrl = dataUrl;
        window.__previewReady = true;
      } catch (err) {
        window.__previewError = String(err && err.message ? err.message : err);
      }
    });

    mv.src = url;
  </script>
</body>
</html>`;

const tmpHtml = path.join(path.dirname(outPath), `.mb_preview_${process.pid}.html`);
fs.writeFileSync(tmpHtml, html, 'utf8');

const started = Date.now();
let browser;

try {
  const chromePath = resolveChromePath();
  browser = await puppeteer.launch({
    headless: true,
    ...(chromePath ? { executablePath: chromePath } : {}),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(tmpHtml).href, { waitUntil: 'networkidle0', timeout: 60000 });

  const result = await page.waitForFunction(
    () => window.__previewReady || window.__previewError,
    { timeout: 45000 },
  ).then(() => page.evaluate(() => ({
    ready: window.__previewReady,
    error: window.__previewError,
    dataUrl: window.__previewDataUrl,
  })));

  if (!result?.ready || !result.dataUrl) {
    throw new Error(result?.error || 'Preview capture failed');
  }

  const match = /^data:image\/png;base64,(.+)$/.exec(result.dataUrl);
  if (!match) throw new Error('Unexpected capture payload');

  const png = Buffer.from(match[1], 'base64');
  if (png.length < 100) throw new Error('Captured PNG is empty');

  fs.writeFileSync(outPath, png);

  const stats = {
    bytesIn: glb.length,
    bytesOut: png.length,
    size,
    ms: Date.now() - started,
  };
  console.log(JSON.stringify(stats));
} catch (err) {
  console.error(String(err && err.message ? err.message : err));
  process.exit(1);
} finally {
  try { fs.unlinkSync(tmpHtml); } catch { /* ignore */ }
  if (browser) await browser.close();
}
