// Smoke test: proves headless Chromium launches and rasterizes in this runtime.
import { chromium } from 'playwright';
const args = (process.env.PW_CHROMIUM_ARGS || '--no-sandbox --disable-dev-shm-usage --disable-gpu').split(' ');
const b = await chromium.launch({ args });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.setContent('<h1 style="font-family:sans-serif;color:#3a5a40">Goldberry Grove browser-runtime OK</h1>');
await p.screenshot({ path: new URL('./smoke-1440.png', import.meta.url).pathname });
console.log('chromium', b.version(), '— render OK');
await b.close();
