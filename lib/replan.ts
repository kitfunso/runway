// Pure diff of two schedules by invoiceId. Used to show what a mid-session
// cash inflow changed; 'released' = was escalated, is now in the auto-pay queue.

import type { Schedule, ScheduleEntry } from './types';

export type ReplanChange = {
  invoiceId: string;
  kind: 'released' | 'moved';
  before: ScheduleEntry;
  after: ScheduleEntry;
};

export function diffSchedules(before: Schedule, after: Schedule): ReplanChange[] {
  const prior = new Map(before.entries.map((e) => [e.invoiceId, e]));
  const changes: ReplanChange[] = [];
  for (const next of after.entries) {
    const prev = prior.get(next.invoiceId);
    if (!prev) continue;
    if (prev.reason === 'flagged' && next.reason !== 'flagged') {
      changes.push({ invoiceId: next.invoiceId, kind: 'released', before: prev, after: next });
    } else if (prev.payDate !== next.payDate || prev.reason !== next.reason) {
      changes.push({ invoiceId: next.invoiceId, kind: 'moved', before: prev, after: next });
    }
  }
  return changes;
}
