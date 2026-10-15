// One line per payment run in runs/learning.jsonl: how many invoices went to the human
// versus how many memory settled. The UI plots it to show the agent improving.

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { runsDir } from './audit';

const LearningRun = z.object({
  run: z.number().int().min(1),
  at: z.string(),
  asked: z.number().int().min(0),
  byMemory: z.number().int().min(0),
  autoPaid: z.number().int().min(0),
});
export type LearningRun = z.infer<typeof LearningRun>;

function learningFile(): string {
  return join(runsDir(), 'learning.jsonl');
}

export function readRuns(): LearningRun[] {
  if (!existsSync(learningFile())) return [];
  return readFileSync(learningFile(), 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => LearningRun.parse(JSON.parse(line)));
}

// SHORTCUT: read-then-append can double a run number under concurrent calls; add a lock if two sessions share a runs dir
export function appendRun(counts: Pick<LearningRun, 'asked' | 'byMemory' | 'autoPaid'>): LearningRun {
  const entry: LearningRun = { run: readRuns().length + 1, at: new Date().toISOString(), ...counts };
  mkdirSync(runsDir(), { recursive: true });
  appendFileSync(learningFile(), JSON.stringify(entry) + '\n');
  return entry;
}

export function resetRuns(): void {
  mkdirSync(runsDir(), { recursive: true });
  writeFileSync(learningFile(), '');
}
