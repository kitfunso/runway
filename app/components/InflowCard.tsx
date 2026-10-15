'use client';

// Open receivable drawn as an invoice stub. Dumb: Dashboard polls /api/inflow
// and passes the result down. `inflow === null` means the route is missing or failed.

import { gbp, LABEL } from './ledger';

export type InflowState = {
  configured: boolean;
  paid: boolean;
  amount: number;
  hostedInvoiceUrl: string | null;
  customerName?: string | null;
};

type Props = {
  inflow: InflowState | null;
  started: boolean;
  replanSummary: string | null;
  customerName: string;
};

const QR_BASE = 'https://api.qrserver.com/v1/create-qr-code/?size=336x336&margin=0&data=';

export function InflowCard({ inflow, started, replanSummary, customerName }: Props) {
  const waiting = started && inflow?.configured === true && !inflow.paid;
  return (
    <section
      className={`relative rounded-b-[6px] border border-t-2 border-rule bg-sheet p-6 ${waiting ? 'animate-stub-wait' : ''}`}
      style={{ borderTopStyle: 'dashed' }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={LABEL}>Receivable</h2>
        {inflow?.paid && (
          <span className="rotate-[-4deg] rounded-[4px] border-2 border-money px-2 py-0.5 font-mono text-[13px] font-semibold tracking-[0.12em] text-money">
            PAID
          </span>
        )}
      </div>
      {started ? <Body inflow={inflow} customerName={customerName} /> : (
        <p className="mt-2 text-sm text-ink-2">Optimise to load the open receivable.</p>
      )}
      {replanSummary && (
        <p className="mt-4 border-t border-rule pt-3 text-[12px] text-ink-2">{replanSummary}</p>
      )}
    </section>
  );
}

function Body({ inflow, customerName }: { inflow: InflowState | null; customerName: string }) {
  if (!inflow || !inflow.configured) {
    return <p className="mt-2 text-sm text-ink-2">Inflow not configured.</p>;
  }
  return (
    <div className="mt-3 space-y-4">
      <p className="text-sm">
        <span className="font-medium">{customerName}</span>
        <span className="text-ink-2"> · {inflow.paid ? 'Invoice paid' : 'Invoice due'}</span>
        {inflow.amount > 0 && <span className="text-ink-2"> · </span>}
        {inflow.amount > 0 && <span className={`font-mono ${inflow.paid ? 'text-money' : ''}`}>{gbp(inflow.amount)}</span>}
      </p>
      {!inflow.paid && inflow.hostedInvoiceUrl && (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={QR_BASE + encodeURIComponent(inflow.hostedInvoiceUrl)}
            alt="QR code for the hosted invoice"
            width={168}
            height={168}
            className="block size-[168px]"
          />
          <p className="text-[13px] text-ink-2">Scan to pay with a test card</p>
          <a
            href={inflow.hostedInvoiceUrl}
            target="_blank"
            rel="noreferrer"
            className="block truncate font-mono text-[11px] text-ink-2 underline decoration-rule underline-offset-2 hover:text-ink"
          >
            {inflow.hostedInvoiceUrl}
          </a>
        </div>
      )}
    </div>
  );
}
