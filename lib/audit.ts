// Append-only sha256 hash chain of every money-relevant event, in
// runs/audit.jsonl. Chain functions are pure; the fs wrappers sit below them.

import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const GENESIS = 'GENESIS';

export type AuditKind = 'decision' | 'transfer' | 'inflow' | 'execute';

export type AuditInput = {
  ts: string;
  kind: AuditKind;
  invoiceId?: string;
  action: string;
  rule?: string;
  amount?: number;
  transferId?: string;
  note?: string;
};

export type AuditRow = AuditInput & { prevHash: string; hash: string };

export type AuditVerdict = {
  ok: boolean;
  rows: number;
  firstBadRow: number | null;
  lastHash: string | null;
};

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

// Hash covers prevHash + the row body (hash field excluded, prevHash included in the body).
function hashOf(prevHash: string, body: AuditInput & { prevHash: string }): string {
  return sha256(prevHash + JSON.stringify(body));
}

export function chainRow(prev: AuditRow | null, input: AuditInput): AuditRow {
  const prevHash = prev ? prev.hash : GENESIS;
  const body = { ...input, prevHash };
  return { ...body, hash: hashOf(prevHash, body) };
}

// firstBadRow is 0-based: the index of the first row whose link or hash fails.
export function verifyRows(rows: readonly AuditRow[]): AuditVerdict {
  let prevHash = GENESIS;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const { hash, ...body } = row;
    if (row.prevHash !== prevHash || hashOf(prevHash, body) !== hash) {
      return { ok: false, rows: rows.length, firstBadRow: i, lastHash: null };
    }
    prevHash = hash;
  }
  return { ok: true, rows: rows.length, firstBadRow: null, lastHash: rows.length ? prevHash : null };
}

// --- file IO ---

export function runsDir(): string {
  return process.env.RUNS_DIR ?? join(process.cwd(), 'runs');
}

function auditPath(): string {
  return join(runsDir(), 'audit.jsonl');
}

export function readAudit(): AuditRow[] {
  const path = auditPath();
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as AuditRow);
}

export function appendAudit(input: AuditInput): AuditRow {
  const rows = readAudit();
  const row = chainRow(rows[rows.length - 1] ?? null, input);
  mkdirSync(runsDir(), { recursive: true });
  appendFileSync(auditPath(), JSON.stringify(row) + '\n');
  return row;
}

export function verifyAudit(): AuditVerdict {
  return verifyRows(readAudit());
}
