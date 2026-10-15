// GET /api/verify — re-walks runs/audit.jsonl and reports the first broken link, if any.

import { NextResponse } from 'next/server';
import { verifyAudit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(verifyAudit());
  } catch (err) {
    console.error('verify error', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
