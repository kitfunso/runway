'use client';

// Open receivable card. Dumb: Dashboard polls /api/inflow and passes the
// result down. `inflow === null` means the route is missing or failed.

export type InflowState = {
  configured: boolean;
  paid: boolean;
  amount: number;
  hostedInvoiceUrl: string | null;
};

type Props = {
  inflow: InflowState | null;
  started: boolean;
  replanSummary: string | null;
};

const QR_BASE = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=';

function gbp(n: number): string {
  return `£${n.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
}

export function InflowCard({ inflow, started, replanSummary }: Props) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 min-w-[240px]">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">Inflow</div>
      {started ? <Body inflow={inflow} /> : (
        <p className="text-sm text-muted-foreground">Optimise to load the open receivable</p>
      )}
      {replanSummary && (
        <p className="text-xs text-muted-foreground border-t pt-2">{replanSummary}</p>
      )}
    </div>
  );
}

function Body({ inflow }: { inflow: InflowState | null }) {
  if (!inflow || !inflow.configured) {
    return <p className="text-sm text-muted-foreground">Inflow not configured</p>;
  }
  if (inflow.paid) {
    return (
      <p className="text-sm font-semibold text-green-700 dark:text-green-400">
        Paid <span className="font-mono tabular-nums">{gbp(inflow.amount)}</span>
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm">
        Open receivable: Acme Ltd{' '}
        <span className="font-mono tabular-nums">{gbp(inflow.amount)}</span>
      </p>
      {inflow.hostedInvoiceUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={QR_BASE + encodeURIComponent(inflow.hostedInvoiceUrl)}
            alt="QR code for the hosted invoice"
            width={160}
            height={160}
            className="border rounded bg-white"
          />
          <a
            href={inflow.hostedInvoiceUrl}
            target="_blank"
            rel="noreferrer"
            className="block text-xs underline break-all text-muted-foreground"
          >
            {inflow.hostedInvoiceUrl}
          </a>
        </>
      )}
    </div>
  );
}
