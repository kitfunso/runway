// POST /api/optimise: pre-fetch Specter for every vendor, apply the finance manager's remembered
// decisions, run baseline + full optimiser, log the payment run, return the Schedule.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { loadAll } from '@/lib/data';
import { getDistressScore } from '@/lib/specter';
import { optimise, simulate } from '@/lib/optimiser';
import { recall } from '@/lib/memory';
import { appendRun, readRuns } from '@/lib/learning';
import { newScheduleId } from '@/lib/runs';
import type { DistressMap, Escalation, Invoice, Vendor } from '@/lib/types';

const MEMORY_DISTRESS = 0.95;
// Matches the sentence /api/decide stores in memory.
const NOTE = /On (\d{4}-\d{2}-\d{2}) the finance manager (approved|rejected|deferred) (\S+) from (.+?): (.*)/;

type Note = { date: string; verdict: 'approved' | 'rejected' | 'deferred'; invoiceId: string; vendor: string; why: string };
type MemoryItem = { invoiceId: string; vendorId: string; reason: string };
type Memory = { heldVendors: Map<string, Note>; deferred: Map<string, Note>; trustedVendors: Map<string, Note> };

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// extraCash is a customer payment that landed after the forecast was cut; replan re-plans the current run.
const Body = z.object({
  extraCash: z.number().min(0).max(10_000_000).default(0),
  replan: z.boolean().default(false),
});

function parseNotes(text: string): Note[] {
  return text.split('\n').flatMap((line) => {
    const m = NOTE.exec(line);
    if (!m) return [];
    return [{ date: m[1]!, verdict: m[2] as Note['verdict'], invoiceId: m[3]!, vendor: m[4]!.trim(), why: m[5]!.trim() }];
  });
}

// Rejection holds the vendor, deferral holds that invoice, approval waives the soft rules for the vendor.
function readMemory(notes: readonly Note[], vendors: readonly Vendor[]): Memory {
  const idByName = new Map(vendors.map((v) => [v.name.toLowerCase(), v.id]));
  const memory: Memory = { heldVendors: new Map(), deferred: new Map(), trustedVendors: new Map() };
  for (const note of notes) {
    const vendorId = idByName.get(note.vendor.toLowerCase());
    if (note.verdict === 'deferred') memory.deferred.set(note.invoiceId, note);
    else if (vendorId && note.verdict === 'rejected') memory.heldVendors.set(vendorId, note);
    else if (vendorId && note.verdict === 'approved') memory.trustedVendors.set(vendorId, note);
  }
  for (const id of memory.heldVendors.keys()) memory.trustedVendors.delete(id);
  return memory;
}

function said(note: Note): string {
  const day = new Date(`${note.date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `You ${note.verdict} ${note.vendor} on ${day}: ${note.why}`;
}

function splitHeld(escalations: readonly Escalation[], invoiceById: ReadonlyMap<string, Invoice>, memory: Memory) {
  const held: MemoryItem[] = [];
  const asked: Escalation[] = [];
  for (const esc of escalations) {
    const vendorId = invoiceById.get(esc.invoiceId)?.vendorId ?? '';
    const note = memory.deferred.get(esc.invoiceId) ?? memory.heldVendors.get(vendorId);
    if (note) held.push({ invoiceId: esc.invoiceId, vendorId, reason: said(note) });
    else asked.push(esc);
  }
  return { held, asked };
}

export async function POST(req: NextRequest) {
  let body: z.infer<typeof Body>;
  try {
    const raw = await req.text();
    body = Body.parse(raw ? JSON.parse(raw) : {});
  } catch (err) {
    return NextResponse.json({ error: 'invalid body', detail: (err as Error).message }, { status: 400 });
  }

  try {
    const { invoices, vendors, forecast: base } = loadAll();
    const forecast = { ...base, openingCash: base.openingCash + body.extraCash };
    const invoiceById = new Map<string, Invoice>(invoices.map((i) => [i.id, i]));

    const distressScores: DistressMap = {};
    await Promise.all(
      vendors.map(async (v) => {
        distressScores[v.id] = (await getDistressScore(v.specterId)).score;
      }),
    );

    const memory = readMemory(parseNotes(await recall('finance manager approved rejected deferred invoice from vendor')), vendors);
    const memoryReasons: Record<string, string> = {};
    for (const [id, note] of memory.heldVendors) {
      distressScores[id] = Math.max(distressScores[id] ?? 0, MEMORY_DISTRESS);
      memoryReasons[id] = said(note);
    }

    // Trust waives only the history and distress rules; the optimiser still enforces the amount and floor rules.
    const trustedVendors = vendors.map((v) => (memory.trustedVendors.has(v.id) ? { ...v, paymentHistory: 'reliable' as const } : v));
    const trustedScores: DistressMap = { ...distressScores };
    for (const id of memory.trustedVendors.keys()) trustedScores[id] = 0;

    const baseline = optimise({ invoices, vendors, forecast, distressScores, forceNaive: true });
    const baselineSim = simulate(baseline.entries, forecast, invoiceById);
    const untrusted = optimise({ invoices, vendors, forecast, distressScores });
    const full = optimise({ invoices, vendors: trustedVendors, forecast, distressScores: trustedScores });
    const fullSim = simulate(full.entries, forecast, invoiceById);

    const stillAsked = new Set(full.escalations.map((e) => e.invoiceId));
    const trusted: MemoryItem[] = untrusted.escalations.flatMap((e) => {
      const vendorId = invoiceById.get(e.invoiceId)?.vendorId ?? '';
      const note = memory.trustedVendors.get(vendorId);
      return note && !stillAsked.has(e.invoiceId) ? [{ invoiceId: e.invoiceId, vendorId, reason: said(note) }] : [];
    });
    const { held: heldByMemory, asked } = splitHeld(full.escalations, invoiceById, memory);

    full.escalations = asked;
    full.scheduleId = newScheduleId();
    full.breachesAvoidedVsBaseline = baselineSim.breachDay !== null && fullSim.breachDay === null ? 1 : 0;

    const autoPaid = full.entries.filter((e) => e.reason !== 'flagged').length;
    const run = body.replan
      ? readRuns().length
      : appendRun({ asked: asked.length, byMemory: heldByMemory.length + trusted.length, autoPaid }).run;

    return NextResponse.json({ ...full, memoryReasons, heldByMemory, trusted, run });
  } catch (err) {
    console.error('optimise error', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
