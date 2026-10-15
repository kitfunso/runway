// GET /api/learning returns every payment run so far; POST {reset: true} clears them for re-recording.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { readRuns, resetRuns } from '@/lib/learning';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({ reset: z.literal(true) });

export async function GET() {
  try {
    return NextResponse.json({ runs: readRuns() });
  } catch (err) {
    console.error('learning read error', (err as Error).message);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: 'invalid body', detail: (err as Error).message }, { status: 400 });
  }
  try {
    resetRuns();
    return NextResponse.json({ runs: [] });
  } catch (err) {
    console.error('learning reset error', (err as Error).message);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
