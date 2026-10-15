// Mints a fresh customer invoice for the demo's inflow. Run: npx tsx scripts/stripe-invoice.ts
// Rewrites data/demo-stripe.json (keeps vendorAccounts) and clears the inflow log markers.

import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runsDir } from '../lib/audit';
import { getStripe } from '../lib/stripe';
import { mintDemoInvoice } from '../lib/demo-invoice';

const ROOT = join(__dirname, '..');
const DEMO_FILE = join(ROOT, 'data', 'demo-stripe.json');

process.loadEnvFile(join(ROOT, '.env.local'));

function clearInflowMarkers(): number {
  const dir = runsDir();
  if (!existsSync(dir)) return 0;
  const markers = readdirSync(dir).filter((f) => /^inflow-.*\.logged$/.test(f));
  for (const f of markers) unlinkSync(join(dir, f));
  return markers.length;
}

async function main(): Promise<void> {
  const stripe = getStripe();
  if (!stripe) throw new Error('STRIPE_SECRET_KEY is not set in .env.local');

  const previous = JSON.parse(readFileSync(DEMO_FILE, 'utf8')) as { vendorAccounts: Record<string, string> };
  const demo = { ...(await mintDemoInvoice(stripe)), vendorAccounts: previous.vendorAccounts };
  writeFileSync(DEMO_FILE, JSON.stringify(demo, null, 2) + '\n');
  console.log(`cleared ${clearInflowMarkers()} inflow marker(s)`);
  console.log(JSON.stringify({ ...demo, vendorAccounts: undefined }, null, 2));
}

main().catch((err: unknown) => {
  console.error('stripe-invoice failed:', (err as Error).message);
  process.exit(1);
});
