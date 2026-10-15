'use client';

// Run summary beside the hero figures: what the schedule saved, paid alone, and held.

import type { Invoice, Schedule } from '@/lib/types';
import { gbp, LABEL } from './ledger';
import { useTween } from './useTween';

type Props = {
  invoices: Invoice[];
  schedule: Schedule | null;
  executeResult: { executed: number; approved: number; deferred: number; rejected: number } | null;
};

export function SavingsCounter({ invoices, schedule, executeResult }: Props) {
  const savingTween = useTween(schedule?.totalSaving ?? 0);
  if (!schedule) {
    return (
      <p className="max-w-[280px] text-sm text-ink-2">
        {invoices.length} bills to plan. Optimise to build the schedule.
      </p>
    );
  }
  const flagged = schedule.entries.filter((e) => e.reason === 'flagged').length;
  const autoPaid = schedule.entries.length - flagged;

  return (
    <div className="flex flex-col items-end gap-3">
      <dl className="flex flex-wrap gap-x-8 gap-y-3">
        <Stat label="Saved" value={gbp(savingTween)} tone="text-money" />
        <Stat label="Pays on its own" value={`${autoPaid} of ${schedule.entries.length}`} />
        <Stat label="Held" value={String(flagged)} tone={flagged > 0 ? 'text-held' : ''} />
        <Stat label="Breaches avoided" value={String(schedule.breachesAvoidedVsBaseline)} />
      </dl>
      {executeResult && (
        <p className="text-[13px] text-ink-2">
          Executed <span className="font-mono text-ink">{executeResult.executed}</span> payments:{' '}
          <span className="font-mono text-ink">{executeResult.approved}</span> approved,{' '}
          <span className="font-mono text-ink">{executeResult.deferred}</span> deferred,{' '}
          <span className="font-mono text-ink">{executeResult.rejected}</span> rejected
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="text-right">
      <dt className={LABEL}>{label}</dt>
      <dd className={`mt-1 font-mono text-[20px] leading-none ${tone}`}>{value}</dd>
    </div>
  );
}
