// GET /api/inflow - polls the demo customer invoice (data/demo-stripe.json) in Stripe test mode.
// The first poll that sees it paid writes one "inflow" audit row, guarded by a marker file.

import { NextResponse } from 'next/server';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { appendAudit, runsDir } from '@/lib/audit';
import { getStripe } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DemoStripe = z.object({
  customerId: z.string().min(1),
  invoiceId: z.string().min(1),
  hostedInvoiceUrl: z.string().nullable(),
  vendorAccounts: z.record(z.string(), z.string()),
});

const NOT_CONFIGURED = { configured: false, paid: false, amount: 0, hostedInvoiceUrl: null };

// 'wx' makes the marker create atomic, so concurrent polls log the inflow once.
function claimInflowLog(invoiceId: string): boolean {
  mkdirSync(runsDir(), { recursive: true });
  try {
    writeFileSync(join(runsDir(), `inflow-${invoiceId}.logged`), new Date().toISOString(), { flag: 'wx' });
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw err;
  }
}

export async function GET() {
  try {
    const file = join(process.cwd(), 'data', 'demo-stripe.json');
    const stripe = getStripe();
    if (!stripe || !existsSync(file)) return NextResponse.json(NOT_CONFIGURED);

    const demo = DemoStripe.parse(JSON.parse(readFileSync(file, 'utf8')));
    const inv = await stripe.invoices.retrieve(demo.invoiceId);
    const paid = inv.status === 'paid';
    const amount = (inv.amount_paid ?? 0) / 100;

    if (paid && claimInflowLog(demo.invoiceId)) {
      appendAudit({
        ts: new Date().toISOString(),
        kind: 'inflow',
        invoiceId: demo.invoiceId,
        action: 'received',
        amount,
        note: 'customer invoice paid',
      });
    }

    return NextResponse.json({
      configured: true,
      paid,
      amount,
      hostedInvoiceUrl: inv.hosted_invoice_url ?? demo.hostedInvoiceUrl,
    });
  } catch (err) {
    console.error('inflow error', (err as Error).message);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
