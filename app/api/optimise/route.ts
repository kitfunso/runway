// POST /api/optimise — pre-fetch Specter for every vendor, run baseline +
// full optimiser, mint scheduleId, persist runs/<id>.pending.json, return
// the full Schedule with breachesAvoidedVsBaseline filled in.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { loadAll } from '@/lib/data';
import { getDistressScore } from '@/lib/specter';
import { optimise, simulate } from '@/lib/optimiser';
import { newScheduleId } from '@/lib/runs';
import type { DistressMap, Invoice } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// extraCash is a customer payment that landed after the forecast was cut.
const Body = z.object({ extraCash: z.number().min(0).max(10_000_000).default(0) });

export async function POST(req: NextRequest) {
  let extraCash: number;
  try {
    const raw = await req.text();
    extraCash = Body.parse(raw ? JSON.parse(raw) : {}).extraCash;
  } catch (err) {
    return NextResponse.json({ error: 'invalid body', detail: (err as Error).message }, { status: 400 });
  }

  try {
    const { invoices, vendors, forecast: base } = loadAll();
    const forecast = { ...base, openingCash: base.openingCash + extraCash };

    // Pre-fetch distress scores for every vendor in parallel.
    const distressScores: DistressMap = {};
    await Promise.all(
      vendors.map(async (v) => {
        const sig = await getDistressScore(v.specterId);
        distressScores[v.id] = sig.score;
      }),
    );

    // Baseline: every invoice pay-on-due, ignore breach.
    const baseline = optimise({ invoices, vendors, forecast, distressScores, forceNaive: true });
    const invoiceById = new Map<string, Invoice>(invoices.map((i) => [i.id, i]));
    const baselineSim = simulate(baseline.entries, forecast, invoiceById);

    // Full optimisation.
    const full = optimise({ invoices, vendors, forecast, distressScores });
    const fullSim = simulate(full.entries, forecast, invoiceById);

    // breachesAvoidedVsBaseline: 1 if baseline breached and full schedule
    // doesn't, 0 otherwise. (More granular days-of-breach diff is overkill
    // for the demo.)
    const breachesAvoidedVsBaseline =
      baselineSim.breachDay !== null && fullSim.breachDay === null ? 1 : 0;

    full.scheduleId = newScheduleId();
    full.breachesAvoidedVsBaseline = breachesAvoidedVsBaseline;

    // No server-side persistence on Cloudflare. Client holds the schedule
    // and includes whatever subsequent calls need (distressScore for
    // /api/investigate, autoPayCount + decisions for /api/execute).
    return NextResponse.json(full);
  } catch (err) {
    console.error('optimise error', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
