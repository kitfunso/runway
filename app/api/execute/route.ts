// POST /api/execute - stateless. Paid entries become Stripe test-mode payouts (or transfers when the
// vendor has a stripeAccountId), each preceded by a hash-chained audit row.
// Run log goes to runs/<scheduleId>.executed.json; no server-side state otherwise.

import { NextRequest, NextResponse } from 'next/server';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type Stripe from 'stripe';
import { appendAudit, runsDir } from '@/lib/audit';
import { loadInvoices, loadVendors } from '@/lib/data';
import { getStripe } from '@/lib/stripe';
import type { Invoice, Vendor } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Decision = z.object({
  invoiceId: z.string().min(1),
  verdict: z.enum(['approve', 'defer', 'reject']),
});

// rule is the ScheduleEntry.reason of the auto-pay entry ('auto-discount' | 'auto-due' | 'auto-stretch').
const AutoPay = z.object({
  invoiceId: z.string().min(1),
  rule: z.string().min(1).optional(),
});

const Body = z.object({
  scheduleId: z.string().min(1),
  autoPayCount: z.number().int().min(0),
  autoPay: z.array(AutoPay).default([]),
  decisions: z.array(Decision).default([]),
});

type PayItem = { invoiceId: string; rule: string };
type TransferResult = { invoiceId: string; transferId: string | null; amount: number; reason?: string };

type PayContext = {
  stripe: Stripe | null;
  stripeError: string | null;
  invoices: ReadonlyMap<string, Invoice>;
  vendors: ReadonlyMap<string, Vendor>;
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

// Matches the optimiser's cash simulation: the discount is taken on auto-discount entries only.
function payable(inv: Invoice, rule: string): number {
  return round2(rule === 'auto-discount' && inv.discountPct ? inv.amount * (1 - inv.discountPct) : inv.amount);
}

async function payOne(item: PayItem, ctx: PayContext): Promise<TransferResult> {
  const inv = ctx.invoices.get(item.invoiceId);
  if (!inv) return { invoiceId: item.invoiceId, transferId: null, amount: 0, reason: 'unknown invoice' };

  const amount = payable(inv, item.rule);
  const base = { invoiceId: item.invoiceId, amount };
  const vendor = ctx.vendors.get(inv.vendorId);
  const accountId = vendor?.stripeAccountId;
  if (!vendor || !ctx.stripe) {
    return { ...base, transferId: null, reason: ctx.stripeError ?? 'no rail' };
  }

  try {
    const row = appendAudit({
      ts: new Date().toISOString(),
      kind: 'transfer',
      invoiceId: item.invoiceId,
      action: 'pay',
      rule: item.rule,
      amount,
    });
    const description = `${item.invoiceId} ${vendor.name}`;
    const metadata = { invoiceId: item.invoiceId, vendor: vendor.name, rule: item.rule, auditHash: row.hash };
    // A vendor with a connected account is paid by transfer; otherwise the payment leaves the
    // Stripe balance as a payout to the operating bank account that pays the supplier.
    const transfer = accountId
      ? await ctx.stripe.transfers.create({
          amount: Math.round(amount * 100),
          currency: 'gbp',
          destination: accountId,
          description,
          metadata,
        })
      : await ctx.stripe.payouts.create({ amount: Math.round(amount * 100), currency: 'gbp', description, metadata });
    appendAudit({
      ts: new Date().toISOString(),
      kind: 'transfer',
      invoiceId: item.invoiceId,
      action: 'pay-confirmed',
      amount,
      transferId: transfer.id,
    });
    return { ...base, transferId: transfer.id };
  } catch (err) {
    const message = (err as Error).message;
    console.error('transfer failed', item.invoiceId, message);
    try {
      appendAudit({
        ts: new Date().toISOString(),
        kind: 'transfer',
        invoiceId: item.invoiceId,
        action: 'pay-failed',
        amount,
        note: message,
      });
    } catch (auditErr) {
      console.error('audit append failed', (auditErr as Error).message);
    }
    return { ...base, transferId: null, reason: message };
  }
}

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: 'invalid body', detail: (err as Error).message }, { status: 400 });
  }

  const approvedIds = parsed.decisions.filter((d) => d.verdict === 'approve').map((d) => d.invoiceId);
  const approved = approvedIds.length;
  const deferred = parsed.decisions.filter((d) => d.verdict === 'defer').length;
  const rejected = parsed.decisions.filter((d) => d.verdict === 'reject').length;
  const executed = parsed.autoPayCount + approved;

  const seen = new Set<string>();
  const items: PayItem[] = [
    ...parsed.autoPay.map((p) => ({ invoiceId: p.invoiceId, rule: p.rule ?? 'auto-pay' })),
    ...approvedIds.map((invoiceId) => ({ invoiceId, rule: 'escalation-approved' })),
  ].filter((p) => !seen.has(p.invoiceId) && seen.add(p.invoiceId));

  let stripe: Stripe | null = null;
  let stripeError: string | null = null;
  try {
    stripe = getStripe();
  } catch (err) {
    stripeError = (err as Error).message;
  }

  const ctx: PayContext = {
    stripe,
    stripeError,
    invoices: new Map(loadInvoices().map((i) => [i.id, i])),
    vendors: new Map(loadVendors().map((v) => [v.id, v])),
  };

  // Sequential on purpose: each audit row chains on the previous one.
  const transfers: TransferResult[] = [];
  for (const item of items) transfers.push(await payOne(item, ctx));

  const total = round2(transfers.reduce((sum, t) => sum + t.amount, 0));
  const railed = transfers.filter((t) => t.transferId !== null).length;
  try {
    appendAudit({
      ts: new Date().toISOString(),
      kind: 'execute',
      action: 'execute',
      amount: total,
      note: `${parsed.scheduleId}: ${transfers.length} payments, ${railed} transfers`,
    });
    const dir = runsDir();
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${parsed.scheduleId.replace(/[^A-Za-z0-9_-]/g, '_')}.executed.json`);
    const logged = transfers.map(({ invoiceId, transferId, amount }) => ({ invoiceId, transferId, amount }));
    const run = { scheduleId: parsed.scheduleId, executedAt: new Date().toISOString(), transfers: logged };
    writeFileSync(file, JSON.stringify(run, null, 2) + '\n');
  } catch (err) {
    console.error('run log write failed', (err as Error).message);
  }

  return NextResponse.json({
    executed,
    approved,
    deferred,
    rejected,
    idempotent: false,
    transfers,
  });
}
