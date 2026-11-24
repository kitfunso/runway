import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { loadAll } from '@/lib/data';
import { remember } from '@/lib/memory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  scheduleId: z.string().min(1),
  invoiceId: z.string().min(1),
  verdict: z.enum(['approve', 'defer', 'reject']),
  reason: z.string().min(1).max(500),
});

const PAST_TENSE = { approve: 'approved', defer: 'deferred', reject: 'rejected' } as const;

export async function POST(req: NextRequest) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: 'invalid body', detail: (err as Error).message }, { status: 400 });
  }

  try {
    const { invoices, vendors } = loadAll();
    const invoice = invoices.find((i) => i.id === body.invoiceId);
    const vendorName = vendors.find((v) => v.id === invoice?.vendorId)?.name ?? 'unknown vendor';
    const date = new Date().toISOString().slice(0, 10);
    await remember(
      `On ${date} the finance manager ${PAST_TENSE[body.verdict]} ${body.invoiceId} from ${vendorName}: ${body.reason}`,
    );
  } catch (err) {
    console.error('decide: memory write failed', (err as Error).message);
  }
  return NextResponse.json({ ok: true });
}
