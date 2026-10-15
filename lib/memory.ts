// Memory of the finance manager's decisions. Runs on the hippo CLI against an
// isolated store under RUNS_DIR; any hippo failure falls back to runs/memory.jsonl.

import { spawn } from 'node:child_process';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { runsDir } from './audit';

export type MemoryBackend = 'hippo' | 'file';

const HIPPO_TIMEOUT_MS = 8000;
const MAX_RESULTS = 5;
const STOP_WORDS = new Set(['the', 'a', 'an', 'or', 'and', 'of', 'on', 'from', 'was', 'why', 'is', 'to']);

const HippoRecall = z.object({ results: z.array(z.object({ content: z.string() })) });

let backend: MemoryBackend = 'file';
export function lastBackend(): MemoryBackend {
  return backend;
}

// cmd.exe (shell: true on Windows) splits on newlines and expands %VAR% even inside quotes.
function winArg(arg: string): string {
  return `"${arg.replace(/"/g, "'").replace(/[\r\n\0]+/g, ' ').replace(/%/g, ' percent')}"`;
}

async function runHippo(args: string[]): Promise<string> {
  const home = join(runsDir(), 'hippo-home');
  const cwd = join(runsDir(), 'hippo-cwd');
  await mkdir(home, { recursive: true });
  await mkdir(cwd, { recursive: true });

  const win = process.platform === 'win32';
  const env: NodeJS.ProcessEnv = { ...process.env, HIPPO_HOME: home, HIPPO_SKIP_AUTO_INTEGRATIONS: '1' };
  delete env.TYPESAFE_API_KEY;
  delete env.HIPPO_TENANT;

  return new Promise<string>((resolve, reject) => {
    const child = spawn(win ? 'hippo.cmd' : 'hippo', win ? args.map(winArg) : args, {
      cwd,
      env,
      shell: win,
      timeout: HIPPO_TIMEOUT_MS,
      windowsHide: true,
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d: Buffer) => { out += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { err += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`hippo exited ${code}: ${err.trim().slice(0, 200)}`));
    });
  });
}

function memoryFile(): string {
  return join(runsDir(), 'memory.jsonl');
}

function words(text: string): Set<string> {
  const found = text.toLowerCase().match(/[a-z0-9-]+/g) ?? [];
  return new Set(found.filter((w) => !STOP_WORDS.has(w)));
}

async function recallFromFile(question: string): Promise<string> {
  let raw: string;
  try {
    raw = await readFile(memoryFile(), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw err;
  }
  const q = words(question);
  return raw
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => (JSON.parse(line) as { text: string }).text)
    .map((text) => ({ text, score: [...words(text)].filter((w) => q.has(w)).length }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map((m) => m.text)
    .join('\n');
}

export async function remember(text: string): Promise<void> {
  try {
    await runHippo(['remember', text, '--tag', 'runway', '--global']);
    backend = 'hippo';
    return;
  } catch (err) {
    console.error('hippo remember failed, using file fallback:', (err as Error).message);
  }
  await mkdir(runsDir(), { recursive: true });
  await appendFile(memoryFile(), JSON.stringify({ ts: new Date().toISOString(), text }) + '\n');
  backend = 'file';
}

export async function recall(question: string): Promise<string> {
  try {
    const out = await runHippo(['recall', question, '--budget', '600', '--json']);
    const parsed = HippoRecall.parse(JSON.parse(out.slice(out.indexOf('{'))));
    const answer = parsed.results.slice(0, MAX_RESULTS).map((r) => r.content).join('\n');
    if (answer) {
      backend = 'hippo';
      return answer;
    }
  } catch (err) {
    console.error('hippo recall failed, using file fallback:', (err as Error).message);
  }
  backend = 'file';
  return recallFromFile(question);
}
