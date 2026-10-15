'use client';

// Asks memory why an invoice was paid or escalated and shows the answer
// inline. The fetch itself lives in Dashboard (onAsk); only the answer state
// is local, so a card can render several without lifting state.

import { useState } from 'react';

type Props = {
  invoiceId: string;
  onAsk: (invoiceId: string) => Promise<string>;
};

export function WhyButton({ invoiceId, onAsk }: Props) {
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask() {
    setLoading(true);
    try {
      setAnswer(await onAsk(invoiceId));
    } catch {
      setAnswer('Memory is not reachable right now.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => void ask()}
        disabled={loading}
        className="rounded-md border px-2 py-0.5 text-xs hover:bg-muted disabled:opacity-50"
      >
        {loading ? 'Asking...' : 'Why?'}
      </button>
      {answer && (
        <p className="text-xs text-muted-foreground whitespace-pre-line max-w-[320px]">{answer}</p>
      )}
    </div>
  );
}
