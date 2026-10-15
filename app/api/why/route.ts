// POST /api/why { invoiceId } -> { answer }. Asks memory why an invoice was
// paid or escalated; says so plainly when nothing was recorded.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { recall } from '@/lib/memory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({ invoiceId: z.string().min(1).max(100) });

export async function POST(req: NextRequest) {
  let invoiceId: string;
  try {
    invoiceId = Body.parse(await req.json()).invoiceId;
  } catch (err) {
    return NextResponse.json({ error: 'invalid body', detail: (err as Error).message }, { status: 400 });
  }

  try {
    const answer = await recall(`why was ${invoiceId} paid or escalated`);
    return NextResponse.json({ answer: answer || `No recorded decision for ${invoiceId} yet.` });
  } catch (err) {
    console.error('why error', (err as Error).message);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
