// Screenshot of the running app after Optimise. Run: node video/shot.mjs <url> <out.png>
import { chromium } from 'file:///C:/Users/skf_s/AppData/Roaming/npm/node_modules/@playwright/mcp/node_modules/playwright/index.mjs';
const [url = 'http://localhost:3070', out = 'video/shot.png'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Optimise' }).click();
await page.getByRole('button', { name: 'Investigate' }).first().waitFor({ timeout: 60000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: out });
await browser.close();
