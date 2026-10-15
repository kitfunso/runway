'use client';

// The schedule as a ledger: one hairline row per payment, held rows on top,
// money right-aligned, Stripe transfer ids once Execute has run.

import type { Schedule, Invoice, Vendor, Forecast, ScheduleEntry } from '@/lib/types';
import type { ReplanChange } from '@/lib/replan';
import type { Transfer } from './AuditBand';
import type { MemoryItem } from './LearningStrip';
import { WhyButton } from './WhyButton';
import { gbp, shortDate, stripeUrl, LABEL, PANEL, PILL } from './ledger';

type Props = {
  schedule: Schedule | null;
  invoices: Invoice[];
  vendors: Vendor[];
  forecast: Forecast;
  changes: ReplanChange[];
  transfers: Transfer[];
  trusted: MemoryItem[];
  onWhy: (invoiceId: string) => Promise<string>;
};


const RULE_LABEL: Record<ScheduleEntry['reason'], string> = {
  'auto-discount': 'Discount',
  'auto-due': 'On due date',
  'auto-stretch': 'Stretched for cash',
  'flagged': 'Needs a decision',
};

type Action = 'paid' | 'released' | 'trusted' | 'held' | 'scheduled';

const ACTION_PILL: Record<Action, { label: string; cls: string }> = {
  paid: { label: 'Paid', cls: 'border-money/40 text-money' },
  released: { label: 'Released by inflow', cls: 'border-money/40 text-money' },
  trusted: { label: 'Trusted', cls: 'border-money/40 text-money' },
  held: { label: 'Held', cls: 'border-held/40 bg-held-tint text-held' },
  scheduled: { label: 'Scheduled', cls: 'border-rule text-ink-2' },
};

const ORDER: Record<Action, number> = { held: 0, released: 1, trusted: 2, paid: 3, scheduled: 3 };

const TH = 'sticky top-0 z-10 h-10 border-b border-rule bg-sheet px-2.5 text-left text-[12px] font-medium text-ink-2 shadow-[0_1px_0_rgba(0,0,0,.04)]';
const TD = 'h-11 px-2.5 align-middle';

export function CalendarView({ schedule, invoices, vendors, changes, transfers, trusted, onWhy }: Props) {
  if (!schedule) {
    return (
      <section className={`${PANEL} p-6`}>
        <div className={LABEL}>Schedule</div>
        <p className="mt-2 text-sm text-ink-2">Optimise to build the payment schedule.</p>
      </section>
    );
  }

  const invById = new Map(invoices.map((i) => [i.id, i]));
  const vendById = new Map(vendors.map((v) => [v.id, v]));
  const changeById = new Map(changes.map((c) => [c.invoiceId, c]));
  const transferById = new Map(transfers.map((t) => [t.invoiceId, t]));
  const trustedById = new Map(trusted.map((t) => [t.invoiceId, t]));

  const actionOf = (e: ScheduleEntry): Action => {
    if (e.reason === 'flagged') return 'held';
    if (transferById.get(e.invoiceId)?.transferId) return 'paid';
    if (changeById.get(e.invoiceId)?.kind === 'released') return 'released';
    if (trustedById.has(e.invoiceId)) return 'trusted';
    return 'scheduled';
  };
  const rows = schedule.entries
    .map((e) => ({ e, action: actionOf(e) }))
    .sort((a, b) => ORDER[a.action] - ORDER[b.action] || a.e.payDate.localeCompare(b.e.payDate));
  const held = rows.filter((r) => r.action === 'held').length;

  return (
    <section className={`${PANEL} overflow-hidden`}>
      <div className="flex items-baseline justify-between gap-4 px-6 pb-4 pt-5">
        <div className="flex items-baseline gap-3">
          <h2 className={LABEL}>Schedule</h2>
          <span className="text-[13px] text-ink-2">
            {rows.length} payments{held > 0 ? `, ${held} held` : ''}
          </span>
        </div>
        <span className="font-mono text-[12px] text-ink-2">{schedule.scheduleId.slice(0, 8)}</span>
      </div>
      <div className="max-h-[880px] overflow-auto border-t border-rule">
        <table className="w-full min-w-[760px] border-collapse text-[13px]">
          <thead>
            <tr>
              <th className={`${TH} pl-6`}>Date</th>
              <th className={TH}>Vendor</th>
              <th className={TH}>Invoice</th>
              <th className={`${TH} text-right`}>Amount</th>
              <th className={TH}>Action</th>
              <th className={TH}>Rule</th>
              <th className={TH}>Stripe</th>
              <th className={`${TH} pr-6`}><span className="sr-only">Why</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ e, action }, i) => {
              const inv = invById.get(e.invoiceId);
              const vendor = inv ? vendById.get(inv.vendorId) : undefined;
              const transfer = transferById.get(e.invoiceId);
              const pill = ACTION_PILL[action];
              const moved = changeById.get(e.invoiceId)?.kind === 'moved';
              const trust = trustedById.get(e.invoiceId);
              return (
                <tr
                  key={`${e.invoiceId}-${action}`}
                  className={`animate-row-in border-b border-rule last:border-b-0 ${action === 'held' ? 'bg-held-tint' : ''}`}
                  style={{ animationDelay: `${Math.min(i, 20) * 30}ms` }}
                >
                  <td className={`${TD} whitespace-nowrap pl-6 font-mono`}>{shortDate(e.payDate)}</td>
                  <td className={`${TD} max-w-[160px] truncate`}>{vendor?.name ?? inv?.vendorId ?? '-'}</td>
                  <td className={`${TD} max-w-[140px] truncate font-mono text-[12px] text-ink-2`} title={e.invoiceId}>{e.invoiceId}</td>
                  <td className={`${TD} whitespace-nowrap text-right font-mono`}>{inv ? gbp(inv.amount) : '-'}</td>
                  <td className={TD}>
                    <span className={`${PILL} ${pill.cls}`} title={action === 'trusted' ? trust?.reason : undefined}>
                      {pill.label}
                    </span>
                  </td>
                  <td className={`${TD} whitespace-nowrap text-[12px] text-ink-2`}>
                    {RULE_LABEL[e.reason]}
                    {e.projectedSaving > 0 && <span className="text-money">, saves <span className="font-mono">{gbp(e.projectedSaving)}</span></span>}
                    {moved && ', moved by inflow'}
                  </td>
                  <td className={`${TD} whitespace-nowrap font-mono text-[12px]`}>
                    {transfer?.transferId ? (
                      <a href={stripeUrl(transfer.transferId)} target="_blank" rel="noreferrer" className="text-ink underline decoration-rule underline-offset-2 hover:decoration-ink">
                        {transfer.transferId.slice(0, 10)}
                      </a>
                    ) : (
                      <span className="text-ink-2">–</span>
                    )}
                  </td>
                  <td className={`${TD} pr-6`}>
                    <WhyButton invoiceId={e.invoiceId} onAsk={onWhy} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
