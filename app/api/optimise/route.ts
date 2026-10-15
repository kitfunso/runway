// POST /api/optimise — pre-fetch Specter for every vendor, run baseline +
// full optimiser, mint scheduleId, persist runs/<id>.pending.json, return
// the full Schedule with breachesAvoidedVsBaseline filled in.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { loadAll } from '@/lib/data';
import { getDistressScore } from '@/lib/specter';
import { optimise, simulate } from '@/lib/optimiser';
import { recall } from '@/lib/memory';
import { newScheduleId } from '@/lib/runs';
import type { DistressMap, Invoice, Vendor } from '@/lib/types';

const MEMORY_DISTRESS = 0.95;
const MEMORY_REASON = 'finance manager rejected/deferred before';

// Only sentences that record a rejection or deferral count; approvals mention the vendor too.
function applyMemoryGate(
  past: string,
  vendors: readonly Vendor[],
  distressScores: DistressMap,
): Record<string, string> {
  const flagged = past
    .split(/\n|(?<=\.)\s+/)
    .filter((s) => /reject|defer/i.test(s))
    .join('\n')
    .toLowerCase();
  const reasons: Record<string, string> = {};
  for (const v of vendors) {
    if (!flagged.includes(v.name.toLowerCase())) continue;
    distressScores[v.id] = Math.max(distressScores[v.id] ?? 0, MEMORY_DISTRESS);
    reasons[v.id] = MEMORY_REASON;
  }
  return reasons;
}

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

    // Memory gate: a vendor the finance manager rejected or deferred before
    // gets a distress score that the existing policy escalates.
    const past = await recall('vendors the finance manager rejected or deferred');
    const memoryReasons = applyMemoryGate(past, vendors, distressScores);

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
    return NextResponse.json({ ...full, memoryReasons });
  } catch (err) {
    console.error('optimise error', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
