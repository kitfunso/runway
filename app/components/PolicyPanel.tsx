'use client';

// Renders AUTO_PAY_RULES + ESCALATE_RULES from lib/policy. NEVER duplicate
// rule literals; this panel is the on-screen image of what runs in code.

import type { PolicyRule } from '@/lib/policy';
import { LABEL, PANEL } from './ledger';

type Props = {
  autoPayRules: readonly PolicyRule[];
  escalateRules: readonly PolicyRule[];
};

export function PolicyPanel({ autoPayRules, escalateRules }: Props) {
  return (
    <details open className={`${PANEL} group`}>
      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-4 px-6 py-5 [&::-webkit-details-marker]:hidden">
        <div className="flex items-baseline gap-3">
          <h2 className={LABEL}>Policy</h2>
          <span className="text-[13px] text-ink-2">
            What the agent will and won&apos;t do, read from <code className="font-mono text-[12px]">lib/policy.ts</code>
          </span>
        </div>
        <span className="text-[12px] text-ink-2 group-open:hidden">Show</span>
        <span className="hidden text-[12px] text-ink-2 group-open:inline">Hide</span>
      </summary>
      <div className="grid grid-cols-1 gap-x-12 gap-y-6 border-t border-rule px-6 py-6 md:grid-cols-2">
        <RuleList title="Pays on its own when all are true" rules={autoPayRules} />
        <RuleList title="Asks a human when any is true" rules={escalateRules} />
      </div>
    </details>
  );
}

function RuleList({ title, rules }: { title: string; rules: readonly PolicyRule[] }) {
  return (
    <section>
      <h3 className="text-sm font-medium">{title}</h3>
      <ul className="mt-3 divide-y divide-rule border-y border-rule">
        {rules.map((r) => (
          <li key={r.id} className="py-3">
            <div className="text-sm">{r.label}</div>
            <div className="mt-0.5 text-[13px] text-ink-2">{r.detail}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
