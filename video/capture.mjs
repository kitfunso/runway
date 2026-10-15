// Records the demo flow against a running Runway server. Run: node video/capture.mjs [baseUrl]
// Writes video/captures/raw/*.webm plus marks.json (seconds from the start of each page's video).

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'file:///C:/Users/skf_s/AppData/Roaming/npm/node_modules/@playwright/mcp/node_modules/playwright/index.mjs';
import Stripe from 'stripe';

const BASE = process.argv[2] ?? 'http://localhost:3071';
const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'video', 'captures', 'raw');
mkdirSync(OUT, { recursive: true });
process.loadEnvFile(join(ROOT, '.env.local'));
const demo = JSON.parse((await import('node:fs')).readFileSync(join(ROOT, 'data', 'demo-stripe.json'), 'utf8'));

const t0 = Date.now();
const marks = {};
const mark = (name) => { marks[name] = (Date.now() - t0) / 1000; console.log(name, marks[name].toFixed(1)); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 810 },
  deviceScaleFactor: 4 / 3,
  recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } },
});
const page = await ctx.newPage();

async function glide(dy, steps = 12) {
  for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, dy / steps); await wait(35); }
  await wait(400);
}
async function scrollTo(locator) {
  await locator.evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  await wait(900);
}
const card = (vendor) => page.locator('article', { hasText: vendor });

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.mouse.move(1000, 400);
mark('loaded');
await wait(1500);

// s3: how it works figure
const figure = page.locator('iframe').first();
await scrollTo(figure);
mark('s3');
await wait(10000);
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
await wait(1000);

// s4: plan and escalations
mark('s4');
await page.getByRole('button', { name: 'Optimise', exact: true }).click();
await page.getByRole('button', { name: 'Investigate' }).first().waitFor({ timeout: 60000 });
await wait(3500);
await glide(560);
await wait(1500);
for (const vendor of ['Iridium Components', 'Jade Studios', 'Acme Office Supplies']) {
  await scrollTo(card(vendor));
  await card(vendor).getByRole('button', { name: 'Investigate' }).click();
  await card(vendor).getByRole('button', { name: 'Approve' }).waitFor({ timeout: 60000 });
  await wait(1200);
}

// s5: decide, execute, payouts
mark('s5');
await scrollTo(card('Iridium Components'));
await card('Iridium Components').getByRole('button', { name: 'Approve' }).click();
await wait(900);
await scrollTo(card('Jade Studios'));
await card('Jade Studios').getByRole('button', { name: 'Reject' }).click();
await wait(900);
await scrollTo(card('Acme Office Supplies'));
await card('Acme Office Supplies').getByRole('button', { name: 'Defer' }).click();
await wait(900);
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
await wait(900);
mark('execute');
await page.getByRole('button', { name: 'Execute schedule' }).click();
await page.getByText(/po_[A-Za-z0-9]{6}/).first().waitFor({ timeout: 120000 });
mark('paid');
await wait(1500);
await scrollTo(page.getByText(/po_[A-Za-z0-9]{6}/).first());
await wait(3000);

// s6: the customer pays the QR invoice; Runway re-plans
mark('s6');
await scrollTo(page.getByText('Scan to pay', { exact: false }).first());
await wait(2500);
const inv = await ctx.newPage();
await inv.goto(demo.hostedInvoiceUrl, { waitUntil: 'networkidle' });
mark('invoice-open');
await wait(3000);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const pm = await stripe.paymentMethods.attach('pm_card_visa', { customer: demo.customerId });
await stripe.invoices.pay(demo.invoiceId, { payment_method: pm.id });
await inv.reload({ waitUntil: 'networkidle' });
mark('invoice-paid');
await wait(3500);
await page.bringToFront();
await page.getByText('Released by inflow').first().waitFor({ timeout: 60000 });
mark('released');
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
await wait(4000);
await scrollTo(page.getByText('Released by inflow').first());
await wait(3000);

// s7: next payment run, decided from memory
mark('s7');
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
await wait(900);
await page.getByRole('button', { name: 'Next payment run' }).click();
await page.getByText(/in run 2/).first().waitFor({ timeout: 60000 });
await wait(1200);
await scrollTo(page.getByText(/in run 2/).first());
await wait(3500);
await scrollTo(page.getByText('Held by memory', { exact: false }).first());
await wait(4000);

// s8: why and verify
mark('s8');
const trustedRow = page.locator('tr', { hasText: 'INV-SPECTER' }).first();
await scrollTo(trustedRow);
await trustedRow.getByRole('button', { name: 'Why' }).click();
await wait(4500);
await scrollTo(page.getByRole('button', { name: 'Verify' }));
await page.getByRole('button', { name: 'Verify' }).click();
await page.getByText(/Chain intact/).first().waitFor({ timeout: 30000 });
await wait(3500);
mark('end');

const mainVideo = page.video();
const invVideo = inv.video();
await ctx.close();
await browser.close();
writeFileSync(join(OUT, 'marks.json'), JSON.stringify({
  marks,
  main: await mainVideo.path(),
  invoice: await invVideo.path(),
  invoiceOpenedAt: marks['invoice-open'],
}, null, 2));
console.log('done', await mainVideo.path());
