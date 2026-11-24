import { lastBackend, recall, remember } from '../lib/memory';

async function main(): Promise<void> {
  await remember('On 2026-10-15 the finance manager rejected INV-SMOKE-1 from Smoke Test Ltd: reject (smoke test)');
  console.log('remember backend:', lastBackend());
  const answer = await recall('vendors the finance manager rejected or deferred');
  console.log('recall backend:', lastBackend());
  console.log('recall result:\n' + answer);
  if (!answer.includes('Smoke Test Ltd')) {
    console.error('FAIL: remembered vendor not returned');
    process.exit(1);
  }
  console.log('PASS');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
