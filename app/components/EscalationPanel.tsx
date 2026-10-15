'use client';

import { useEffect, useRef, useState } from 'react';
import type { Schedule, Invoice, Vendor, Verdict, Escalation } from '@/lib/types';
import { WhyButton } from './WhyButton';
import type { MemoryItem } from './LearningStrip';
import { gbp, plain, shortDate, LABEL, PANEL, PILL, BTN_SM } from './ledger';

type Props = {
  schedule: Schedule | null;
  invoices: Invoice[];
  vendors: Vendor[];
  releasedIds: string[];
  memoryReasons: Record<string, string>;
  heldByMemory: MemoryItem[];
  onWhy: (invoiceId: string) => Promise<string>;
  onScheduleChange: (s: Schedule) => void;
  onDecisionRecorded?: (d: { invoiceId: string; verdict: 'approve' | 'defer' | 'reject' }) => void;
};

const AGENT_NAMES = ['vendor-health', 'cash-impact', 'discount-npv'] as const;
type AgentName = typeof AGENT_NAMES[number];

type AgentRowState =
  | { status: 'idle' }
  | { status: 'running'; startedAt: number }
  | { status: 'done'; verdict: Verdict; durationMs: number }
  | { status: 'error'; error: string };

type CardState = {
  agentRows: Record<AgentName, AgentRowState>;
  decisionMade: 'approve' | 'defer' | 'reject' | null;
  alertActive: boolean;
  narration: string | null;
  effectiveDistress: number | null;
  fanOutStartedAt: number | null;
  fanOutDoneAt: number | null;
};

function freshState(): CardState {
  return {
    agentRows: {
      'vendor-health': { status: 'idle' },
      'cash-impact':   { status: 'idle' },
      'discount-npv':  { status: 'idle' },
    },
    decisionMade: null,
    alertActive: false,
    narration: null,
    effectiveDistress: null,
    fanOutStartedAt: null,
    fanOutDoneAt: null,
  };
}

const SM_PRIMARY = `${BTN_SM} bg-ink text-paper hover:bg-ink/85`;
const SM_SECONDARY = `${BTN_SM} border border-rule bg-sheet text-ink hover:border-ink-2`;

export function EscalationPanel({ schedule, invoices, vendors, releasedIds, memoryReasons, heldByMemory, onWhy, onDecisionRecorded }: Props) {
  const [cardStates, setCardStates] = useState<Record<string, CardState>>({});

  if (!schedule) {
    return (
      <section className={`${PANEL} p-4`}>
        <h2 className={LABEL}>Needs a decision</h2>
        <p className="mt-2 text-sm text-ink-2">Optimise to see which bills need you.</p>
      </section>
    );
  }

  const invById = new Map(invoices.map((i) => [i.id, i]));
  const vendById = new Map(vendors.map((v) => [v.id, v]));

  const released = releasedIds.map((id) => {
    const inv = invById.get(id);
    const entry = schedule.entries.find((e) => e.invoiceId === id);
    if (!inv || !entry) return null;
    return (
      <div key={`released-${id}`} className={`${PANEL} animate-row-in flex items-center justify-between gap-3 p-4`}>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{vendById.get(inv.vendorId)?.name ?? inv.vendorId}</div>
          <div className="mt-0.5 font-mono text-[12px] text-ink-2">{id} · pays {shortDate(entry.payDate)}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-[16px] leading-tight">{gbp(inv.amount)}</div>
          <span className={`${PILL} mt-1 border-money/40 text-money`}>Released by inflow</span>
        </div>
      </div>
    );
  });

  const memoryHeld = heldByMemory.length > 0 && (
    <div className="space-y-2 pt-3">
      <div className="flex items-baseline gap-2">
        <h3 className={LABEL}>Held by memory</h3>
        <span className="font-mono text-[12px] text-ink-2">{heldByMemory.length}</span>
      </div>
      {heldByMemory.map((m) => {
        const inv = invById.get(m.invoiceId);
        return (
          <div key={`mem-${m.invoiceId}`} className={`${PANEL} animate-row-in p-4`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{vendById.get(m.vendorId)?.name ?? m.vendorId}</div>
                <div className="mt-0.5 font-mono text-[12px] text-ink-2">{m.invoiceId}</div>
              </div>
              <div className="shrink-0 font-mono text-[16px] leading-tight">{inv ? gbp(inv.amount) : '-'}</div>
            </div>
            <p className="mt-2 text-[13px] text-ink-2">
              <span className="mr-2 font-mono text-[11px] uppercase tracking-[0.06em] text-ink">hippo</span>
              {m.reason}
            </p>
          </div>
        );
      })}
    </div>
  );

  function getState(invoiceId: string): CardState {
    return cardStates[invoiceId] ?? freshState();
  }
  function setState(invoiceId: string, updater: (prev: CardState) => CardState): void {
    setCardStates((s) => ({ ...s, [invoiceId]: updater(s[invoiceId] ?? freshState()) }));
  }

  async function investigate(invoiceId: string, forceDistress?: number) {
    if (!schedule) return;
    const entry = schedule.entries.find((e) => e.invoiceId === invoiceId);
    if (!entry) return;

    const fanOutStartedAt = Date.now();
    setState(invoiceId, () => ({
      ...freshState(),
      alertActive: forceDistress !== undefined,
      fanOutStartedAt,
      agentRows: {
        'vendor-health': { status: 'running', startedAt: fanOutStartedAt },
        'cash-impact':   { status: 'running', startedAt: fanOutStartedAt },
        'discount-npv':  { status: 'running', startedAt: fanOutStartedAt },
      },
    }));

    // Fire all three agents in parallel from the browser. Each fetch resolves
    // independently so React re-renders as each verdict lands.
    const body: Record<string, unknown> = {
      scheduleId: schedule.scheduleId,
      invoiceId,
      distressScore: entry.distressScore,
    };
    if (forceDistress !== undefined) body.forceDistress = forceDistress;

    await Promise.all(
      AGENT_NAMES.map(async (name) => {
        const t0 = Date.now();
        try {
          const res = await fetch(`/api/agent/${name}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (!res.ok) throw new Error(`${name} ${res.status}`);
          const data = await res.json() as { verdict: Verdict; durationMs: number; narration?: string; effectiveDistress: number };
          const dt = Date.now() - t0;
          setState(invoiceId, (prev) => ({
            ...prev,
            agentRows: {
              ...prev.agentRows,
              [name]: { status: 'done', verdict: data.verdict, durationMs: dt },
            },
            narration: data.narration ?? prev.narration,
            effectiveDistress: data.effectiveDistress,
          }));
        } catch (e) {
          setState(invoiceId, (prev) => ({
            ...prev,
            agentRows: { ...prev.agentRows, [name]: { status: 'error', error: (e as Error).message } },
          }));
        }
      }),
    );

    setState(invoiceId, (prev) => ({ ...prev, fanOutDoneAt: Date.now() }));
  }

  async function triggerSpecterAlert() {
    if (!schedule) return;
    // Fan out across every flagged invoice. Each card re-investigates with
    // elevated distress 0.7 in parallel — three vendor-health agents flip
    // to "defer" within the same second. Demo beat: one button, three red
    // borders, judges see Specter as a structural input across the panel.
    await Promise.all(
      schedule.escalations.map((e) => investigate(e.invoiceId, 0.7)),
    );
  }

  async function decide(invoiceId: string, verdict: 'approve' | 'defer' | 'reject') {
    if (!schedule) return;
    const reason = `${verdict} (sub-agent verdicts reviewed)`;
    try {
      const res = await fetch('/api/decide', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scheduleId: schedule.scheduleId, invoiceId, verdict, reason }),
      });
      if (!res.ok) throw new Error(`decide ${res.status}`);
      setState(invoiceId, (prev) => ({ ...prev, decisionMade: verdict }));
      onDecisionRecorded?.({ invoiceId, verdict });
    } catch {
      // swallow - demo path
    }
  }

  const held = schedule.escalations;
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className={LABEL}>Needs a decision</h2>
          <span className="font-mono text-[12px] text-ink-2">{held.length}</span>
        </div>
        {held.length > 0 && (
          <button type="button" onClick={() => void triggerSpecterAlert()} className={SM_SECONDARY}>
            Trigger risk alert
          </button>
        )}
      </div>
      {held.length > 0 && (
        <p className="text-[12px] text-ink-2">Investigate runs three checks in parallel through the Cursor SDK.</p>
      )}
      {released}
      {held.length === 0 && (
        <div className={`${PANEL} p-4 text-sm text-ink-2`}>Nothing needs you. Every bill pays on its own.</div>
      )}
      {held.map((esc) => {
        const inv = invById.get(esc.invoiceId);
        const vendor = inv ? vendById.get(inv.vendorId) : undefined;
        const entry = schedule.entries.find((e) => e.invoiceId === esc.invoiceId);
        if (!inv || !vendor || !entry) return null;
        const state = getState(esc.invoiceId);
        const effectiveDistress = state.effectiveDistress ?? entry.distressScore;
        return (
          <InvoiceCard
            key={esc.invoiceId}
            escalation={esc}
            invoice={inv}
            vendor={vendor}
            distressScore={effectiveDistress}
            originalDistress={entry.distressScore}
            memoryReason={memoryReasons[vendor.id]}
            onWhy={onWhy}
            payDate={entry.payDate}
            state={state}
            onInvestigate={() => investigate(esc.invoiceId)}
            onDecide={(v) => decide(esc.invoiceId, v)}
          />
        );
      })}
      {memoryHeld}
    </section>
  );
}

type CardProps = {
  escalation: Escalation;
  invoice: Invoice;
  vendor: Vendor;
  distressScore: number;
  originalDistress: number;
  memoryReason: string | undefined;
  onWhy: (invoiceId: string) => Promise<string>;
  payDate: string;
  state: CardState;
  onInvestigate: () => void;
  onDecide: (v: 'approve' | 'defer' | 'reject') => void;
};

function fanOutStarted(state: CardState): boolean {
  return state.fanOutStartedAt !== null;
}
function allDone(state: CardState): boolean {
  return AGENT_NAMES.every((n) => {
    const r = state.agentRows[n];
    return r.status === 'done' || r.status === 'error';
  });
}

const DECISION_LABEL = { approve: 'Approved', defer: 'Deferred', reject: 'Rejected' } as const;

function InvoiceCard({ escalation, invoice, vendor, distressScore, originalDistress, memoryReason, onWhy, payDate, state, onInvestigate, onDecide }: CardProps) {
  const alertActive = state.alertActive && distressScore !== originalDistress;
  const verdicts = AGENT_NAMES.map((n) => state.agentRows[n]).filter((r) => r.status === 'done').map((r) => (r as { verdict: Verdict }).verdict);
  const started = fanOutStarted(state);
  const done = allDone(state);
  const reasons = plain(escalation.reasonForEscalation).split(';').map((r) => r.trim()).filter(Boolean);

  return (
    <article className={`animate-row-in space-y-3 rounded-[6px] border bg-sheet p-4 transition-colors duration-300 ${alertActive || distressScore >= 0.5 ? 'border-floor' : 'border-rule'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{vendor.name}</div>
          <div className="mt-0.5 font-mono text-[12px] text-ink-2">{invoice.id} · due {shortDate(invoice.dueDate)} · plan {shortDate(payDate)}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-[16px] leading-tight">{gbp(invoice.amount)}</div>
          <span className={`${PILL} mt-1 border-held/40 bg-held-tint text-held`}>Held</span>
        </div>
      </div>

      <ul className="space-y-0.5 text-[13px]">
        {reasons.map((r) => (
          <li key={r} className="flex gap-2"><span className="text-ink-2">·</span><span>{r}</span></li>
        ))}
      </ul>
      {memoryReason && <p className="text-[13px] italic text-ink-2">{memoryReason}</p>}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-2">
        <span>Vendor risk <span className={`font-mono ${distressScore >= 0.5 ? 'text-floor' : 'text-ink'}`}>{distressScore.toFixed(2)}</span></span>
        <span>History <span className="text-ink">{vendor.paymentHistory}</span></span>
        {alertActive && <span className={`${PILL} border-floor/40 text-floor`}>Risk alert</span>}
        <WhyButton invoiceId={invoice.id} onAsk={onWhy} />
      </div>

      {!started && (
        <button type="button" onClick={onInvestigate} className={SM_SECONDARY}>Investigate</button>
      )}

      {started && state.narration && (
        <p className="border-l-2 border-rule pl-3 text-[13px] italic text-ink-2">{state.narration}</p>
      )}

      {started && (
        <div className="space-y-2 border-t border-rule pt-3">
          {AGENT_NAMES.map((name) => (
            <AgentRow key={name} name={name} row={state.agentRows[name]} />
          ))}
        </div>
      )}

      {done && state.fanOutStartedAt !== null && state.fanOutDoneAt !== null && (
        <div className="font-mono text-[11px] text-ink-2">
          {AGENT_NAMES.length} checks in {state.fanOutDoneAt - state.fanOutStartedAt}ms, ~{
            AGENT_NAMES.reduce((sum, n) => {
              const r = state.agentRows[n];
              return sum + (r.status === 'done' ? r.durationMs : 0);
            }, 0)
          }ms one after another
        </div>
      )}

      {done && !state.decisionMade && verdicts.length === AGENT_NAMES.length && (
        <div className="flex gap-2">
          <button type="button" onClick={() => onDecide('approve')} className={SM_PRIMARY}>Approve</button>
          <button type="button" onClick={() => onDecide('defer')} className={SM_SECONDARY}>Defer</button>
          <button type="button" onClick={() => onDecide('reject')} className={SM_SECONDARY}>Reject</button>
        </div>
      )}
      {state.decisionMade && (
        <div className={`text-[13px] font-medium ${state.decisionMade === 'approve' ? 'text-money' : state.decisionMade === 'reject' ? 'text-floor' : 'text-ink'}`}>
          {DECISION_LABEL[state.decisionMade]}
        </div>
      )}
    </article>
  );
}

function AgentRow({ name, row }: { name: AgentName; row: AgentRowState }) {
  if (row.status === 'idle' || row.status === 'running') {
    return <RunningRow name={name} startedAt={row.status === 'running' ? row.startedAt : Date.now()} />;
  }
  if (row.status === 'error') {
    return (
      <div className="flex items-start gap-3 text-[12px]">
        <div className="w-24 shrink-0 font-mono text-ink-2">{name}</div>
        <span className="text-floor">error: {row.error}</span>
      </div>
    );
  }
  return <DoneRow name={name} verdict={row.verdict} durationMs={row.durationMs} />;
}

function RunningRow({ name, startedAt }: { name: AgentName; startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    tickRef.current = setInterval(() => setElapsed(Date.now() - startedAt), 33);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [startedAt]);
  return (
    <div className="flex items-baseline gap-3 text-[12px]">
      <div className="w-24 shrink-0 font-mono text-ink-2">{name}</div>
      <span className="text-ink-2">running</span>
      <span className="ml-auto font-mono text-ink-2">{elapsed}ms</span>
    </div>
  );
}

function DoneRow({ name, verdict, durationMs }: { name: AgentName; verdict: Verdict; durationMs: number }) {
  return (
    <div className="animate-row-in flex items-baseline gap-3 text-[12px]">
      <div className="w-24 shrink-0 font-mono text-ink-2">{name}</div>
      <div className="min-w-0 flex-1">
        <span className={`font-medium ${recommendationTone(verdict.recommendation)}`}>{verdict.recommendation}</span>
        <span className="text-ink-2"> {verdict.rationale}</span>
      </div>
      <div className="shrink-0 font-mono text-[11px] text-ink-2">{durationMs}ms</div>
    </div>
  );
}

function recommendationTone(r: Verdict['recommendation']): string {
  switch (r) {
    case 'pay-early':   return 'text-money';
    case 'pay-on-time': return 'text-ink';
    case 'stretch':     return 'text-ink';
    case 'defer':       return 'text-floor';
  }
}
