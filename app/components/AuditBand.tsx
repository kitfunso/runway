'use client';

// Audit chain band: the last rows as linked boxes, the Verify result, and the
// Stripe transfers the run produced. Dumb: Dashboard owns the fetches.

import { gbp, stripeUrl, LABEL, PANEL, BTN_SECONDARY } from './ledger';

export type Transfer = {
  invoiceId: string;
  transferId: string | null;
  amount: number;
  reason?: string;
};

export type VerifyResult = {
  ok: boolean;
  rows: number;
  firstBadRow: number | null;
  lastHash: string | null;
};

type Props = {
  executed: boolean;
  transfers: Transfer[];
  audit: VerifyResult | null;
  verified: boolean;
  verifying: boolean;
  auditError: string | null;
  onVerify: () => void;
};

const WINDOW = 6;

export function AuditBand({ executed, transfers, audit, verified, verifying, auditError, onVerify }: Props) {
  return (
    <section className={`${PANEL} p-6`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h2 className={LABEL}>Audit chain</h2>
          {audit && <span className="font-mono text-[12px] text-ink-2">{audit.rows} rows</span>}
        </div>
        <div className="flex items-center gap-4">
          {verified && audit && <VerifyStatus audit={audit} />}
          <button type="button" onClick={onVerify} disabled={verifying} className={BTN_SECONDARY}>
            {verifying ? 'Verifying...' : 'Verify'}
          </button>
        </div>
      </div>

      {audit && audit.rows > 0 ? (
        <Chain audit={audit} verified={verified} />
      ) : (
        <p className="mt-3 text-sm text-ink-2">
          {auditError ?? (executed ? 'No rows written yet.' : 'Execute the schedule to write the first hash-linked rows.')}
        </p>
      )}
      {auditError && audit && <p className="mt-3 text-sm text-ink-2">{auditError}</p>}

      {transfers.length > 0 && (
        <div className="mt-6 max-h-[360px] overflow-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="sticky top-0 border-b border-rule bg-sheet">
              <th className="h-9 pr-3 text-left text-[12px] font-medium text-ink-2">Invoice</th>
              <th className="h-9 px-3 text-left text-[12px] font-medium text-ink-2">Stripe</th>
              <th className="h-9 pl-3 text-right text-[12px] font-medium text-ink-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((t) => (
              <tr key={t.invoiceId} className="border-b border-rule last:border-b-0">
                <td className="h-10 whitespace-nowrap pr-3 font-mono text-[12px]">{t.invoiceId}</td>
                <td className="h-10 px-3 font-mono text-[12px]">
                  {t.transferId ? (
                    <a href={stripeUrl(t.transferId)} target="_blank" rel="noreferrer" className="underline decoration-rule underline-offset-2 hover:decoration-ink">
                      {t.transferId}
                    </a>
                  ) : (
                    <span className="font-sans text-ink-2">{t.reason ?? 'not sent'}</span>
                  )}
                </td>
                <td className="h-10 pl-3 text-right font-mono">{gbp(t.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </section>
  );
}

// Only the last row's hash comes back from /api/verify, so earlier boxes carry their row number.
function Chain({ audit, verified }: { audit: VerifyResult; verified: boolean }) {
  const bad = verified && !audit.ok ? audit.firstBadRow : null;
  const end = bad !== null ? Math.min(audit.rows, Math.max(bad + 2, WINDOW)) : audit.rows;
  const start = Math.max(1, end - WINDOW + 1);
  const rows: number[] = [];
  for (let r = start; r <= end; r++) rows.push(r);

  return (
    <ol className="mt-4 flex flex-wrap items-center gap-y-3">
      {start > 1 && <li className="mr-2 font-mono text-[12px] text-ink-2">...</li>}
      {rows.map((r, i) => {
        const broken = bad !== null && r >= bad;
        const isLast = r === audit.rows;
        return (
          <li key={r} className="flex items-center">
            {i > 0 && (
              <svg width="28" height="10" viewBox="0 0 28 10" aria-hidden className="mx-1 shrink-0">
                <line x1="2" y1="5" x2="24" y2="5" stroke={broken ? 'var(--color-floor)' : 'var(--color-ink-2)'} strokeWidth="1" strokeDasharray={broken ? '2 2' : undefined} />
                <path d="M21 2 L25 5 L21 8" fill="none" stroke={broken ? 'var(--color-floor)' : 'var(--color-ink-2)'} strokeWidth="1" />
              </svg>
            )}
            <div className={`rounded-[4px] border px-2.5 py-1.5 font-mono text-[12px] leading-tight ${r === bad ? 'border-floor text-floor' : 'border-rule'}`}>
              <div className="text-[10px] text-ink-2">row {r}</div>
              <div>{isLast && audit.lastHash ? `${audit.lastHash.slice(0, 6)}…` : r === bad ? 'mismatch' : 'linked'}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function VerifyStatus({ audit }: { audit: VerifyResult }) {
  if (audit.ok && audit.rows === 0) {
    return <span className="text-sm text-ink-2">Nothing written yet</span>;
  }
  if (audit.ok) {
    return (
      <span className="inline-flex items-center gap-2 text-sm font-medium text-money">
        <span className="size-2 rounded-full bg-money" />
        Chain intact, {audit.rows} rows
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium text-floor">
      <span className="size-2 rounded-full bg-floor" />
      Broken at row {audit.firstBadRow ?? '?'}
    </span>
  );
}
