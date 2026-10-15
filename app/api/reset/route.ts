// POST /api/reset - starts the demo over: moves the run log, audit chain and memory store
// aside (never deletes them) and mints a fresh unpaid customer invoice for the QR card.

import { NextResponse } from 'next/server';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runsDir } from '@/lib/audit';
import { getStripe } from '@/lib/stripe';
import { mintDemoInvoice } from '@/lib/demo-invoice';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const dir = runsDir();
    const archived = existsSync(dir) ? `${dir}-reset-${Date.now()}` : null;
    if (archived) renameSync(dir, archived);

    const stripe = getStripe();
    const file = join(process.cwd(), 'data', 'demo-stripe.json');
    if (stripe && existsSync(file)) {
      const previous = JSON.parse(readFileSync(file, 'utf8')) as { vendorAccounts: Record<string, string> };
      const demo = { ...(await mintDemoInvoice(stripe)), vendorAccounts: previous.vendorAccounts };
      writeFileSync(file, JSON.stringify(demo, null, 2) + '\n');
    }
    return NextResponse.json({ reset: true, archived });
  } catch (err) {
    console.error('reset error', (err as Error).message);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
