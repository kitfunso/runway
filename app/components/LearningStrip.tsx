'use client';

// One pair of bars per payment run: how often the agent asked the human versus
// decided from hippo memory. Falling amber bars are the learning, so no axis.

import { LABEL, PANEL } from './ledger';

export type MemoryItem = { invoiceId: string; vendorId: string; reason: string };
export type LearningRun = { run: number; at: string; asked: number; byMemory: number; autoPaid: number };

const BAR_H = 48;
const times = (n: number): string => (n === 0 ? 'not once' : n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);

export function LearningStrip({ runs }: { runs: LearningRun[] }) {
  const max = Math.max(1, ...runs.flatMap((r) => [r.asked, r.byMemory]));
  const first = runs[0]!;
  const last = runs[runs.length - 1]!;
  const copy = runs.length > 1
    ? `Asked you ${times(first.asked)} in run ${first.run}, ${times(last.asked)} in run ${last.run}`
    : `Asked you ${times(first.asked)} in run ${first.run}`;

  return (
    <section className={`${PANEL} flex flex-wrap items-end gap-x-10 gap-y-4 px-6 py-4`}>
      <div className="min-w-[220px]">
        <div className={LABEL}>Learning</div>
        <p className="mt-2 text-sm">{copy}</p>
        <div className="mt-2 flex gap-4 text-[12px] text-ink-2">
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-[2px] bg-held" />Asked you</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-[2px] bg-money" />Decided from memory</span>
        </div>
      </div>
      <ol className="flex items-end gap-5">
        {runs.map((r) => (
          <li key={r.run} className="flex flex-col items-center gap-1.5">
            <div className="flex items-end gap-1" style={{ height: BAR_H }}>
              <span className="w-3 bg-held" style={{ height: Math.max(2, (r.asked / max) * BAR_H) }} title={`Asked you ${r.asked}`} />
              <span className="w-3 bg-money" style={{ height: Math.max(2, (r.byMemory / max) * BAR_H) }} title={`From memory ${r.byMemory}`} />
            </div>
            <span className="font-mono text-[11px] text-ink-2">{r.run}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
