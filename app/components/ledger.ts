// Shared formatters and class strings for the treasury ledger look (docs/DESIGN.md).

export function gbp(n: number): string {
  return `£${Math.round(n).toLocaleString('en-GB')}`;
}

export function shortDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export const LABEL = 'text-[12px] font-medium uppercase tracking-[0.06em] text-ink-2';
export const PANEL = 'rounded-[6px] border border-rule bg-sheet';
export const BTN = 'inline-flex h-9 items-center justify-center rounded-[6px] px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40';
export const BTN_PRIMARY = `${BTN} bg-ink text-paper hover:bg-ink/85`;
export const BTN_SECONDARY = `${BTN} border border-rule bg-sheet text-ink hover:border-ink-2`;
export const BTN_SM = 'inline-flex h-7 items-center justify-center rounded-[6px] px-3 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40';
export const PILL = 'inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[12px] font-medium';
