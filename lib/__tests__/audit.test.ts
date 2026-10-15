// Inline test for the audit hash chain. Run: npx tsx lib/__tests__/audit.test.ts
import { chainRow, verifyRows, GENESIS } from '../audit';
import type { AuditRow } from '../audit';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}${detail ? ` (${detail})` : ''}`);
  }
}

function build(n: number): AuditRow[] {
  const rows: AuditRow[] = [];
  for (let i = 0; i < n; i++) {
    rows.push(
      chainRow(rows[i - 1] ?? null, {
        ts: `2026-10-15T10:00:0${i}.000Z`,
        kind: 'transfer',
        invoiceId: `INV-${i}`,
        action: 'pay',
        rule: 'auto-due',
        amount: 1000 + i,
      }),
    );
  }
  return rows;
}

console.log('audit chain');
const rows = build(5);
check('first row links to GENESIS', rows[0]!.prevHash === GENESIS);
check('each row links to the previous hash', rows.every((r, i) => i === 0 || r.prevHash === rows[i - 1]!.hash));

const good = verifyRows(rows);
check('5 clean rows verify ok', good.ok && good.rows === 5 && good.firstBadRow === null);
check('lastHash is the final row hash', good.lastHash === rows[4]!.hash);
check('empty chain is ok', verifyRows([]).ok && verifyRows([]).lastHash === null);

const tampered = rows.map((r) => ({ ...r }));
tampered[3] = { ...tampered[3]!, amount: 999_999 };
const bad = verifyRows(tampered);
check('mutated row 3 amount fails verify', !bad.ok);
check('firstBadRow is 3', bad.firstBadRow === 3, `got ${bad.firstBadRow}`);

const dropped = [rows[0]!, rows[1]!, rows[3]!, rows[4]!];
check('dropping a row breaks the chain at 2', verifyRows(dropped).firstBadRow === 2);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
