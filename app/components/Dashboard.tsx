'use client';

// Top-level client component. Holds page state (schedule, decisions, inflow,
// memory) and dispatches every API call; the children only render.

import { useEffect, useState } from 'react';
import type { Invoice, Vendor, Forecast, Schedule } from '@/lib/types';
import type { PolicyRule } from '@/lib/policy';
import { CalendarView } from './CalendarView';
import { SavingsCounter } from './SavingsCounter';
import { PolicyPanel } from './PolicyPanel';
import { EscalationPanel } from './EscalationPanel';
import { RunwayHero } from './RunwayChart';
import { InflowCard, type InflowState } from './InflowCard';
import { AuditBand, type Transfer, type VerifyResult } from './AuditBand';
import { LearningStrip, type LearningRun, type MemoryItem } from './LearningStrip';
import { diffSchedules, type ReplanChange } from '@/lib/replan';
import { gbp, plain, shortDate, BTN_PRIMARY, BTN_SECONDARY } from './ledger';

type ExecuteResult = {
  executed: number;
  approved: number;
  deferred: number;
  rejected: number;
  transfers?: Transfer[];
};

type Props = {
  invoices: Invoice[];
  vendors: Vendor[];
  forecast: Forecast;
  autoPayRules: readonly PolicyRule[];
  escalateRules: readonly PolicyRule[];
};

type OptimiseResponse = Schedule & {
  memoryReasons?: Record<string, string>;
  run?: number;
  heldByMemory?: MemoryItem[];
  trusted?: MemoryItem[];
};

const DEFAULT_CUSTOMER = 'Northwind Retail Ltd';

export function Dashboard({ invoices, vendors, forecast, autoPayRules, escalateRules }: Props) {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [optimising, setOptimising] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executeResult, setExecuteResult] = useState<ExecuteResult | null>(null);
  const [audit, setAudit] = useState<VerifyResult | null>(null);
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<{ invoiceId: string; verdict: 'approve' | 'defer' | 'reject' }[]>([]);
  const [inflow, setInflow] = useState<InflowState | null>(null);
  const [extraCash, setExtraCash] = useState(0);
  const [replanned, setReplanned] = useState(false);
  const [changes, setChanges] = useState<ReplanChange[]>([]);
  const [replanSummary, setReplanSummary] = useState<string | null>(null);
  const [memoryReasons, setMemoryReasons] = useState<Record<string, string>>({});
  const [heldByMemory, setHeldByMemory] = useState<MemoryItem[]>([]);
  const [trusted, setTrusted] = useState<MemoryItem[]>([]);
  const [learning, setLearning] = useState<LearningRun[] | null>(null);
  const [runKey, setRunKey] = useState(0);
  const [resetting, setResetting] = useState(false);
  const hasSchedule = schedule !== null;
  const inflowPaid = inflow?.paid === true;

  // Poll the open receivable every 3s once a schedule exists; stop when paid.
  useEffect(() => {
    if (!hasSchedule || inflowPaid) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch('/api/inflow', { cache: 'no-store' });
        if (!res.ok) throw new Error(`/api/inflow returned ${res.status}`);
        const data: InflowState = await res.json();
        if (!cancelled) setInflow(data);
      } catch {
        if (!cancelled) setInflow(null);
      }
    };
    void poll();
    const id = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, [hasSchedule, inflowPaid]);

  // First time the invoice shows paid: add it to opening cash and re-plan.
  useEffect(() => {
    if (!inflow?.paid || replanned || !schedule) return;
    setReplanned(true);
    void replan(inflow.amount, schedule);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inflow, replanned, schedule]);

  async function fetchSchedule(extra: number, replan = false): Promise<Schedule> {
    const res = await fetch('/api/optimise', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ extraCash: extra, replan }),
    });
    if (!res.ok) throw new Error(`/api/optimise returned ${res.status}`);
    const { memoryReasons: reasons = {}, run: _run, heldByMemory: held = [], trusted: trust = [], ...next }: OptimiseResponse = await res.json();
    setMemoryReasons(reasons);
    setHeldByMemory(held);
    setTrusted(trust);
    void loadLearning();
    return next;
  }

  async function loadLearning() {
    try {
      const res = await fetch('/api/learning', { cache: 'no-store' });
      if (!res.ok) throw new Error(`/api/learning returned ${res.status}`);
      const data: { runs?: LearningRun[] } = await res.json();
      setLearning(data.runs ?? null);
    } catch {
      setLearning(null);
    }
  }

  async function resetDemo() {
    setResetting(true);
    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      if (!res.ok) throw new Error(`/api/reset returned ${res.status}`);
      window.location.reload();
    } catch (e) {
      setError((e as Error).message);
      setResetting(false);
    }
  }

  async function runNextPayment() {
    setDecisions([]);
    setRunKey((k) => k + 1);
    await runOptimise();
  }

  // The schedule carries the policy's reason; memory only adds a past decision when one exists.
  function policyReason(invoiceId: string): string | null {
    if (!schedule) return null;
    const esc = schedule.escalations.find((e) => e.invoiceId === invoiceId);
    if (esc) return `Held by policy: ${plain(esc.reasonForEscalation)}.`;
    const entry = schedule.entries.find((e) => e.invoiceId === invoiceId);
    if (!entry) return null;
    const on = shortDate(entry.payDate);
    if (entry.reason === 'auto-discount') return `Paid early on ${on} to take the discount, saving ${gbp(entry.projectedSaving)}. It passes every auto-pay rule.`;
    if (entry.reason === 'auto-stretch') return `Paid on ${on}, after its due date, to keep cash above the floor.`;
    if (entry.reason === 'auto-due') return `Paid on its due date, ${on}: no discount to take. It passes every auto-pay rule.`;
    return null;
  }

  async function askWhy(invoiceId: string): Promise<string> {
    const res = await fetch('/api/why', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ invoiceId }),
    });
    if (!res.ok) throw new Error(`/api/why returned ${res.status}`);
    const data: { answer: string } = await res.json();
    const remembered = data.answer.startsWith('No recorded decision') ? null : data.answer;
    const held = heldByMemory.find((m) => m.invoiceId === invoiceId);
    const trust = trusted.find((m) => m.invoiceId === invoiceId);
    const policy = held ? `Held from memory: ${held.reason}` : trust ? `Trusted from memory: ${trust.reason}` : policyReason(invoiceId);
    return [policy, remembered && `Memory: ${remembered}`].filter(Boolean).join(' ') || data.answer;
  }

  async function replan(amount: number, before: Schedule) {
    try {
      const next = await fetchSchedule(amount, true);
      const moved = diffSchedules(before, next);
      const released = moved.filter((c) => c.kind === 'released').length;
      setExtraCash(amount);
      setChanges(moved);
      setReplanSummary(
        `Re-planned with +${gbp(amount)} cash: savings ${gbp(before.totalSaving)} -> ${gbp(next.totalSaving)}, ` +
        `${moved.length} payments moved, ${released} released from escalations`,
      );
      setSchedule(next);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function runOptimise() {
    setOptimising(true);
    setError(null);
    setExecuteResult(null);
    setAudit(null);
    setVerified(false);
    setAuditError(null);
    try {
      setSchedule(await fetchSchedule(extraCash));
      setChanges([]);
      setReplanSummary(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOptimising(false);
    }
  }

  async function loadAudit(showResult: boolean) {
    setVerifying(true);
    setAuditError(null);
    try {
      const res = await fetch('/api/verify', { cache: 'no-store' });
      if (!res.ok) throw new Error(`/api/verify returned ${res.status}`);
      const data: VerifyResult = await res.json();
      setAudit(data);
      setVerified(showResult);
    } catch {
      setAudit(null);
      setAuditError('Audit verify not configured');
    } finally {
      setVerifying(false);
    }
  }

  async function runExecute() {
    if (!schedule) return;
    setExecuting(true);
    try {
      const autoPayCount = schedule.entries.filter((e) => e.reason !== 'flagged').length;
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scheduleId: schedule.scheduleId,
          autoPayCount,
          autoPay: schedule.entries
            .filter((e) => e.reason !== 'flagged')
            .map((e) => ({ invoiceId: e.invoiceId, rule: e.reason })),
          decisions,
        }),
      });
      if (!res.ok) throw new Error(`/api/execute returned ${res.status}`);
      const data: ExecuteResult = await res.json();
      setExecuteResult(data);
      setVerified(false);
      await loadAudit(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExecuting(false);
    }
  }

  const liveForecast: Forecast = extraCash > 0
    ? { ...forecast, openingCash: forecast.openingCash + extraCash }
    : forecast;
  const customerName = inflow?.customerName ?? DEFAULT_CUSTOMER;
  const transfers = executeResult?.transfers ?? [];
  const releasedIds = changes.filter((c) => c.kind === 'released').map((c) => c.invoiceId);

  return (
    <main className="mx-auto min-h-screen max-w-[1376px] px-4 pb-16 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-rule py-5">
        <div className="flex items-baseline gap-3">
          <h1 className="font-semibold tracking-[-0.02em] text-[26px] leading-none">Runway</h1>
          <span className="text-sm text-ink-2">Treasury agent</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex h-6 items-center rounded-full bg-held-tint px-2.5 font-mono text-[11px] font-medium tracking-[0.06em] text-held">
            TEST MODE
          </span>
          <button type="button" onClick={runOptimise} disabled={optimising} className={BTN_PRIMARY}>
            {optimising ? 'Optimising...' : 'Optimise'}
          </button>
          <button type="button" onClick={() => void runNextPayment()} disabled={optimising || !schedule} className={BTN_SECONDARY}>
            Next payment run
          </button>
          <button type="button" onClick={runExecute} disabled={executing || !schedule} className={BTN_SECONDARY}>
            {executing ? 'Executing...' : 'Execute schedule'}
          </button>
          <button type="button" onClick={() => void resetDemo()} disabled={resetting} className={BTN_SECONDARY}>
            {resetting ? 'Resetting...' : 'Reset demo'}
          </button>
        </div>
      </header>

      <div className="mt-8 space-y-6">
        <RunwayHero
          forecast={liveForecast}
          schedule={schedule}
          invoices={invoices}
          inflow={inflow}
          extraCash={extraCash}
          customerName={customerName}
          aside={<SavingsCounter invoices={invoices} schedule={schedule} executeResult={executeResult} />}
        />

        {learning && learning.length > 0 && <LearningStrip runs={learning} />}

        {error && (
          <div className="rounded-[6px] border border-floor bg-sheet px-4 py-3 text-sm text-floor">
            Error: {error}
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-8">
            <CalendarView
              schedule={schedule}
              invoices={invoices}
              vendors={vendors}
              forecast={liveForecast}
              changes={changes}
              transfers={transfers}
              trusted={trusted}
              onWhy={askWhy}
            />
          </div>
          <aside className="min-w-0 space-y-6 lg:col-span-4">
            <EscalationPanel
              key={runKey}
              schedule={schedule}
              invoices={invoices}
              vendors={vendors}
              releasedIds={releasedIds}
              memoryReasons={memoryReasons}
              heldByMemory={heldByMemory}
              onWhy={askWhy}
              onScheduleChange={setSchedule}
              onDecisionRecorded={(d) => setDecisions((arr) => [...arr, d])}
            />
            <InflowCard inflow={inflow} started={hasSchedule} replanSummary={replanSummary} customerName={customerName} />
          </aside>
        </div>

        <AuditBand
          executed={executeResult !== null}
          transfers={transfers}
          audit={audit}
          verified={verified}
          verifying={verifying}
          auditError={auditError}
          onVerify={() => void loadAudit(true)}
        />

        <PolicyPanel autoPayRules={autoPayRules} escalateRules={escalateRules} />
      </div>
    </main>
  );
}
