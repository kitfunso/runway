'use client';

// Top-level client component. Holds page state (schedule, decisions) and
// dispatches API calls. Renders the Calendar, SavingsCounter, PolicyPanel,
// EscalationPanel.

import { useEffect, useState } from 'react';
import type { Invoice, Vendor, Forecast, Schedule } from '@/lib/types';
import type { PolicyRule } from '@/lib/policy';
import { CalendarView } from './CalendarView';
import { SavingsCounter } from './SavingsCounter';
import { PolicyPanel } from './PolicyPanel';
import { EscalationPanel } from './EscalationPanel';
import { SetupBand } from './SetupBand';
import { InflowCard, type InflowState } from './InflowCard';
import { AuditBand, type Transfer, type VerifyResult } from './AuditBand';
import { diffSchedules, type ReplanChange } from '@/lib/replan';
import { Button } from '@/components/ui/button';

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

function gbp(n: number): string {
  return `£${n.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
}

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

  async function fetchSchedule(extra: number): Promise<Schedule> {
    const res = await fetch('/api/optimise', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ extraCash: extra }),
    });
    if (!res.ok) throw new Error(`/api/optimise returned ${res.status}`);
    const { memoryReasons: reasons = {}, ...next }: Schedule & { memoryReasons?: Record<string, string> } = await res.json();
    setMemoryReasons(reasons);
    return next;
  }

  async function askWhy(invoiceId: string): Promise<string> {
    const res = await fetch('/api/why', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ invoiceId }),
    });
    if (!res.ok) throw new Error(`/api/why returned ${res.status}`);
    const data: { answer: string } = await res.json();
    return data.answer;
  }

  async function replan(amount: number, before: Schedule) {
    try {
      const next = await fetchSchedule(amount);
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

  // Demo flow step inferred from state: 1 Optimise -> 2 Investigate -> 3 Specter -> 4 Execute
  const currentStep = !schedule ? 1
    : decisions.length === 0 ? 2
    : executeResult ? 4
    : 3;

  return (
    <main className="min-h-screen p-6 max-w-[1400px] mx-auto space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-gradient-to-br from-emerald-500 to-sky-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-emerald-500/20">F</div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Floater</h1>
            <p className="text-sm text-muted-foreground">
              AP scheduling agent. Auto-pay clean invoices, escalate the wobbly ones.
            </p>
          </div>
          <span className="ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live demo
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={runOptimise} disabled={optimising} size="lg">
            {optimising ? 'Optimising…' : 'Optimise'}
          </Button>
          <Button
            onClick={runExecute}
            disabled={executing || !schedule}
            variant="secondary"
            size="lg"
          >
            {executing ? 'Executing…' : 'Execute schedule'}
          </Button>
        </div>
      </header>

      <DemoStepper current={currentStep} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6 items-start">
        <SetupBand invoices={invoices} forecast={liveForecast} />
        <InflowCard inflow={inflow} started={hasSchedule} replanSummary={replanSummary} />
      </div>

      <SavingsCounter invoices={invoices} schedule={schedule} executeResult={executeResult} />

      {executeResult && (
        <AuditBand
          transfers={executeResult.transfers ?? []}
          audit={audit}
          verified={verified}
          verifying={verifying}
          auditError={auditError}
          onVerify={() => void loadAudit(true)}
        />
      )}

      {error && (
        <div className="rounded border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          Error: {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          <CalendarView
            schedule={schedule}
            invoices={invoices}
            vendors={vendors}
            forecast={liveForecast}
            changes={changes}
            onWhy={askWhy}
          />
          <EscalationPanel
            schedule={schedule}
            invoices={invoices}
            vendors={vendors}
            releasedIds={changes.filter((c) => c.kind === 'released').map((c) => c.invoiceId)}
            memoryReasons={memoryReasons}
            onWhy={askWhy}
            onScheduleChange={setSchedule}
            onDecisionRecorded={(d) => setDecisions((arr) => [...arr, d])}
          />
        </div>
        <PolicyPanel autoPayRules={autoPayRules} escalateRules={escalateRules} />
      </div>
    </main>
  );
}

function DemoStepper({ current }: { current: number }) {
  const steps = [
    { n: 1, label: 'Optimise',      hint: 'click Optimise' },
    { n: 2, label: 'Investigate',   hint: 'expand a flagged card' },
    { n: 3, label: 'Specter alert', hint: 'trigger the alert' },
    { n: 4, label: 'Execute',       hint: 'commit the schedule' },
  ];
  return (
    <ol className="flex items-center gap-1 text-xs overflow-x-auto">
      {steps.map((s, i) => {
        const done = current > s.n;
        const active = current === s.n;
        return (
          <li key={s.n} className="flex items-center gap-1 shrink-0">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
              active ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 shadow-sm shadow-emerald-500/10' :
              done ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700/80 dark:text-emerald-400/80' :
              'border-border bg-muted/30 text-muted-foreground'
            }`}>
              <span className={`inline-flex items-center justify-center size-5 rounded-full text-[10px] font-bold ${
                active ? 'bg-emerald-500 text-white animate-pulse' :
                done ? 'bg-emerald-500/80 text-white' :
                'bg-muted text-muted-foreground'
              }`}>{done ? '✓' : s.n}</span>
              <span className="font-medium">{s.label}</span>
              {active && <span className="text-[10px] text-muted-foreground">- {s.hint}</span>}
            </div>
            {i < steps.length - 1 && (
              <div className={`h-px w-4 ${current > s.n ? 'bg-emerald-500/40' : 'bg-border'}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
