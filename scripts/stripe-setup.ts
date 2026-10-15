// One-off Stripe test-mode setup for the Runway demo. Run: npx tsx scripts/stripe-setup.ts
// Needs STRIPE_SECRET_KEY (sk_test_ or rk_test_) in .env.local. Safe to re-run: it
// reuses accounts already in data/vendors.json and exits if data/demo-stripe.json exists.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type Stripe from 'stripe';
import { getStripe } from '../lib/stripe';
import type { Vendor } from '../lib/types';

const ROOT = join(__dirname, '..');
const ENV_FILE = join(ROOT, '.env.local');
const VENDORS_FILE = join(ROOT, 'data', 'vendors.json');
const DEMO_FILE = join(ROOT, 'data', 'demo-stripe.json');

// Vendors of the first two auto-pay entries (INV-EARLY-01, INV-EARLY-02) and of INV-FLOOR-BREACH.
const RAIL_VENDOR_IDS = ['V-002', 'V-003', 'V-001'] as const;
const FUND_PENCE = 2_000_000;

if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

async function availableGbpPence(stripe: Stripe): Promise<number> {
  const bal = await stripe.balance.retrieve();
  return bal.available.find((b) => b.currency === 'gbp')?.amount ?? 0;
}

async function fundBalance(stripe: Stripe): Promise<void> {
  for (const pm of ['pm_card_bypassPending', 'pm_card_bypassPendingInternational']) {
    await stripe.paymentIntents.create({
      amount: FUND_PENCE,
      currency: 'gbp',
      payment_method: pm,
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    });
    const available = await availableGbpPence(stripe);
    console.log(`funded with ${pm}: GBP available ${(available / 100).toFixed(2)}`);
    if (available >= FUND_PENCE) return;
  }
  console.warn('GBP available balance is still below the funding target; transfers may fail');
}

// Recipient accounts fully prefilled with Stripe's test values, so no hosted onboarding is needed.
// Needs the platform-profile loss and compliance acknowledgements done once in the Dashboard.
function accountParams(vendor: Vendor): Stripe.AccountCreateParams {
  const email = `runway-${vendor.id.toLowerCase()}-${Date.now()}@example.com`;
  return {
    country: 'GB',
    business_type: 'individual',
    email,
    controller: {
      stripe_dashboard: { type: 'none' },
      losses: { payments: 'application' },
      requirement_collection: 'application',
      fees: { payer: 'application' },
    },
    capabilities: { transfers: { requested: true } },
    business_profile: {
      name: vendor.name,
      mcc: '5734',
      url: 'https://accessible.stripe.com',
      product_description: 'Services invoiced to Runway',
      support_phone: '+442071234567',
    },
    tos_acceptance: { date: Math.floor(Date.now() / 1000), ip: '127.0.0.1', service_agreement: 'recipient' },
    individual: {
      first_name: 'Test',
      last_name: vendor.id.replace('-', ''),
      email,
      phone: '+442071234567',
      dob: { day: 1, month: 1, year: 1901 },
      address: { line1: 'address_full_match', city: 'London', postal_code: 'EC1A 1BB', country: 'GB' },
    },
    external_account: {
      object: 'bank_account',
      country: 'GB',
      currency: 'gbp',
      routing_number: '108800',
      account_number: '00012345',
    },
    metadata: { vendorId: vendor.id },
  };
}

async function createVendorAccount(stripe: Stripe, vendor: Vendor): Promise<string> {
  return (await stripe.accounts.create(accountParams(vendor))).id;
}

async function onboardingLink(stripe: Stripe, accountId: string): Promise<string> {
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: 'account_onboarding',
    refresh_url: 'https://example.com/reauth',
    return_url: 'https://example.com/done',
  });
  return link.url;
}

async function main(): Promise<void> {
  if (existsSync(DEMO_FILE)) {
    console.log('data/demo-stripe.json already exists, nothing to do:');
    console.log(readFileSync(DEMO_FILE, 'utf8'));
    return;
  }
  const stripe = getStripe();
  if (!stripe) throw new Error('STRIPE_SECRET_KEY is not set in .env.local');

  await fundBalance(stripe);

  const vendors = JSON.parse(readFileSync(VENDORS_FILE, 'utf8')) as Vendor[];
  const vendorAccounts: Record<string, string> = {};
  for (const id of RAIL_VENDOR_IDS) {
    const vendor = vendors.find((v) => v.id === id);
    if (!vendor) throw new Error(`vendor ${id} not found in data/vendors.json`);
    const accountId = vendor.stripeAccountId ?? (await createVendorAccount(stripe, vendor));
    vendorAccounts[id] = accountId;
    const status = (await stripe.accounts.retrieve(accountId)).capabilities?.transfers ?? 'unknown';
    const link = status === 'active' ? '' : ` onboard=${await onboardingLink(stripe, accountId)}`;
    console.log(`${id} ${vendor.name}: ${accountId} transfers=${status}${link}`);
  }
  const updated = vendors.map((v) => (vendorAccounts[v.id] ? { ...v, stripeAccountId: vendorAccounts[v.id] } : v));
  writeFileSync(VENDORS_FILE, JSON.stringify(updated, null, 2) + '\n');

  const customer = await stripe.customers.create({ name: 'Acme Ltd', email: 'billing@acme-ltd.example' });
  const draft = await stripe.invoices.create({
    customer: customer.id,
    currency: 'gbp',
    collection_method: 'send_invoice',
    days_until_due: 14,
  });
  await stripe.invoiceItems.create({
    customer: customer.id,
    invoice: draft.id,
    amount: 600_000,
    currency: 'gbp',
    description: 'October services',
  });
  const invoice = await stripe.invoices.finalizeInvoice(draft.id);

  const demo = {
    customerId: customer.id,
    invoiceId: invoice.id,
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    vendorAccounts,
  };
  writeFileSync(DEMO_FILE, JSON.stringify(demo, null, 2) + '\n');
  console.log(JSON.stringify(demo, null, 2));
}

main().catch((err: unknown) => {
  console.error('stripe-setup failed:', (err as Error).message);
  process.exit(1);
});
