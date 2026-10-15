'use client';

// Post-execute band: audit chain summary, Verify button, and the Stripe
// transfers the run produced. Dumb: Dashboard owns the fetches.

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
  transfers: Transfer[];
  audit: VerifyResult | null;
  verified: boolean;
  verifying: boolean;
  auditError: string | null;
  onVerify: () => void;
};

const TRANSFER_URL = 'https://dashboard.stripe.com/test/connect/transfers/';

function gbp(n: number): string {
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function AuditBand({ transfers, audit, verified, verifying, auditError, onVerify }: Props) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Audit trail</div>
        <div className="flex items-center gap-4 flex-wrap text-sm">
          <span>
            Rows <span className="font-mono tabular-nums">{audit ? audit.rows : '-'}</span>
          </span>
          <span>
            Last hash <span className="font-mono">{audit?.lastHash ? audit.lastHash.slice(0, 12) : '-'}</span>
          </span>
          <button
            type="button"
            onClick={onVerify}
            disabled={verifying}
            className="rounded-md border px-3 py-1 text-sm hover:bg-muted disabled:opacity-50"
          >
            {verifying ? 'Verifying...' : 'Verify'}
          </button>
        </div>
      </div>

      {auditError && <p className="text-sm text-muted-foreground">{auditError}</p>}
      {verified && audit && <VerifyBanner audit={audit} />}

      {transfers.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1 font-medium">Invoice</th>
              <th className="py-1 font-medium">Transfer</th>
              <th className="py-1 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((t) => (
              <tr key={t.invoiceId} className="border-t">
                <td className="py-1 font-mono text-xs">{t.invoiceId}</td>
                <td className="py-1 text-xs">
                  {t.transferId ? (
                    <a
                      href={TRANSFER_URL + t.transferId}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono underline"
                    >
                      {t.transferId}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">{t.reason ?? 'not sent'}</span>
                  )}
                </td>
                <td className="py-1 font-mono tabular-nums text-right">{gbp(t.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function VerifyBanner({ audit }: { audit: VerifyResult }) {
  if (audit.ok) {
    return (
      <p className="text-sm font-medium text-green-700 dark:text-green-400">
        Chain intact, {audit.rows} rows
      </p>
    );
  }
  return (
    <p className="text-sm font-medium text-red-700 dark:text-red-400">
      Broken at row {audit.firstBadRow ?? '?'}
    </p>
  );
}
