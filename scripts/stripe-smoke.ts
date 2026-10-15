// One GBP 1 test transfer to the first demo vendor account, audited like /api/execute.
// Run after stripe-setup: npx tsx scripts/stripe-smoke.ts

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { appendAudit } from '../lib/audit';
import { getStripe } from '../lib/stripe';

const ROOT = join(__dirname, '..');
const ENV_FILE = join(ROOT, '.env.local');
const DEMO_FILE = join(ROOT, 'data', 'demo-stripe.json');

if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

async function main(): Promise<void> {
  const stripe = getStripe();
  if (!stripe) throw new Error('STRIPE_SECRET_KEY is not set in .env.local');
  if (!existsSync(DEMO_FILE)) throw new Error('data/demo-stripe.json missing: run scripts/stripe-setup.ts first');

  const demo = JSON.parse(readFileSync(DEMO_FILE, 'utf8')) as { vendorAccounts: Record<string, string> };
  const [vendorId, destination] = Object.entries(demo.vendorAccounts)[0] ?? [];
  if (!vendorId || !destination) throw new Error('demo-stripe.json has no vendorAccounts');

  const row = appendAudit({
    ts: new Date().toISOString(),
    kind: 'transfer',
    invoiceId: 'SMOKE',
    action: 'pay',
    rule: 'smoke',
    amount: 1,
  });
  const transfer = await stripe.transfers.create({
    amount: 100,
    currency: 'gbp',
    destination,
    description: `SMOKE ${vendorId}`,
    metadata: { invoiceId: 'SMOKE', rule: 'smoke', auditHash: row.hash },
  });
  appendAudit({
    ts: new Date().toISOString(),
    kind: 'transfer',
    invoiceId: 'SMOKE',
    action: 'pay-confirmed',
    amount: 1,
    transferId: transfer.id,
  });
  console.log(`transfer ${transfer.id} to ${destination} (${vendorId}), auditHash ${row.hash}`);
}

main().catch((err: unknown) => {
  console.error('stripe-smoke failed:', (err as Error).message);
  process.exit(1);
});
