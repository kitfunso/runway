# Runway

> Floater scheduled the payments. Runway pays them: real Stripe transfers under the same policy, a hash-chained audit trail, live cash re-planning when a customer pays, and hippo memory of the finance manager's decisions.

## Built on Floater

Built on Floater, our open-source April 2026 build (https://github.com/kitfunso/Floater), used as the starting template as the hackathon rules allow. Everything in the list below was built on the night of 15 October 2026:

- Real money movement in Stripe test mode: `/api/execute` sends a Transfer per paid invoice and returns the `transfers` list (transfer id, or the reason none was sent).
- A hash-chained audit trail (`lib/audit.ts`, `runs/audit.jsonl`) with `/api/verify` to prove the chain is intact.
- `/api/inflow` and the QR card: a customer pays an open £6,000 invoice from their phone, the dashboard sees it within 3 seconds, adds it to opening cash and re-plans (`extraCash` on `/api/optimise`).
- Memory on hippo (`lib/memory.ts`) with a rejected/deferred-vendor gate in `/api/optimise`.
- A Why button on every schedule row and escalation card (`/api/why`).

Everything else (optimiser, policy, sub-agent fan-out, calendar, escalation panel) is Floater.

## What it does

- Loads 40 mock invoices, 12 vendors, a 60-day cash forecast.
- Gets a vendor risk score for every vendor in parallel. The scores are fixtures shaped like a Specter distress signal (`lib/specter.ts`); no live Specter call is made in the demo, and some UI labels still say Specter.
- Runs a greedy optimiser twice (naive baseline and full policy) and diffs the breach counts, shown as `breachesAvoidedVsBaseline`.
- Auto-pays everything that satisfies the policy below; flags the rest for a human.
- For each flagged invoice, three sub-agents (vendor-health, cash-impact, discount-npv) run in parallel and the UI shows the timing strip. Under `DEMO_REPLAY=1` they return fixture verdicts; the live `@cursor/sdk` path exists in `lib/cursor.ts` but is not on the demo path.
- One human Approve / Defer / Reject per escalation. Everything else auto-executes when you click Execute.
- Executing sends Stripe test-mode Transfers to vendors that have a connected test account (three of the twelve after setup). Any other vendor shows "no rail" in the transfer list; nothing is sent.

## Policy

Auto-pay only when all of these hold (source: `lib/policy.ts`, rendered in the Policy panel):

1. Amount under £5,000.
2. Vendor has at least 3 prior on-time payments.
3. Vendor risk score under 0.3.
4. The cash floor holds across the full 60-day horizon.
5. Payable within 14 days of the due date.

Otherwise the invoice escalates: amount of £5,000 or more, a new or inconsistent vendor, risk score of 0.3 or more, pay-on-due would breach the floor, or the sub-agents disagree. Sub-agents never gate auto-pay. A risk score above 0.5 also pushes the pay date out (capped at 14 days past due).

Memory adds one input: if the finance manager rejected or deferred any invoice from a vendor before, that vendor's risk score is raised to 0.95 on the next Optimise and every invoice from them escalates, with "finance manager rejected/deferred before" on the card.

## Memory

Memory runs on hippo (https://github.com/kitfunso/hippo, npm `hippo-memory`), our open-source memory layer for agents: the finance manager rejects a vendor once and Runway never auto-pays them again.

`lib/memory.ts` calls the `hippo` CLI against an isolated store in `runs/hippo-home` (it never touches any other hippo store). If `hippo` is not installed or fails, it falls back to `runs/memory.jsonl`, so the gate still works without hippo. Check which path ran with `npx tsx scripts/memory-smoke.ts`; it prints `hippo` or `file`.

## Setup

```bash
npm install
npm i -g hippo-memory            # optional: memory falls back to a JSON file without it

cp .env.local.example .env.local
# Set STRIPE_SECRET_KEY to a TEST key (sk_test_ or rk_test_). Live keys are rejected.
# Keep DEMO_REPLAY=1 for the demo path.

npx tsx scripts/stripe-setup.ts  # once: test accounts for three vendors, funds the test
                                 # balance, creates the open Acme Ltd invoice
                                 # (writes data/vendors.json and data/demo-stripe.json)
npm run dev                      # http://localhost:3000
```

Without `STRIPE_SECRET_KEY` the app still runs: the inflow card says "Inflow not configured" and Execute lists every payment as not sent.

## Demo steps

1. Click **Optimise**. The schedule fills in, savings tick up, and three invoices escalate (`INV-LARGE-NEW`, `INV-SPECTER-DISTRESSED`, `INV-FLOOR-BREACH`). The inflow card shows the open Acme Ltd receivable with a QR code.
2. Pay the invoice from the QR code or link (Stripe test card `4242 4242 4242 4242`). Within 3 seconds the card turns to "Paid £6,000", opening cash rises and the schedule re-plans. With the seeded data and £6,000, savings move from £3,529 to £3,918 as two payments move up to take early-pay discounts and one moves back; moved rows are labelled "Moved by inflow". An escalation that cash alone unblocks would be labelled "Released by inflow" (none is with this seed, because all three fail rules that cash cannot fix). Nothing executes on its own.
3. Click **Investigate** on `INV-FLOOR-BREACH`, then **Reject** it. The decision is written to memory.
4. Click **Optimise** again. Other invoices from the rejected vendor (Acme Office Supplies) now escalate with the memory reason. Click **Why?** on a row or card to read what memory recorded.
5. Click **Execute schedule**. The audit band lists the Stripe transfers (each id links to the Stripe test dashboard) and the chain length and last hash. Click **Verify**: "Chain intact, N rows".

## Architecture

```
[data/*.json]
      |
      v
[POST /api/optimise { extraCash? }]
      |-- recall() memory, raise risk score of previously rejected/deferred vendors
      |-- vendor risk scores for every vendor (Promise.all)
      |-- run optimiser twice (forceNaive baseline + full)
      |-- return Schedule + memoryReasons

[GET  /api/inflow]    -> open customer invoice paid? (Stripe test mode, polled every 3s)
[POST /api/investigate, /api/agent/<name>] -> sub-agent verdicts
[POST /api/decide]    -> remember() the decision
[POST /api/execute]   -> audit row + Stripe Transfer per paid invoice, returns transfers
[GET  /api/verify]    -> walk runs/audit.jsonl, check the hash chain
[POST /api/why]       -> recall() what memory knows about an invoice
```

State stays client-side (the schedule and decisions travel in request bodies). The server writes only `runs/` files: `audit.jsonl`, `memory.jsonl`, `hippo-home/`, run logs.

Stack: Next.js 15 App Router, React 19, Tailwind 4, shadcn primitives, `@cursor/sdk`, `openai`, `stripe`, `zod`, JSON files (no DB).

## Non-negotiables (also in CLAUDE.md)

1. `.env.local` is gitignored before any key is written.
2. Never breach the cash floor, including under deferred payments. `MAX_STRETCH_DAYS = 14`.
3. HITL escalation is earned, not blanket. Sub-agents only run on flagged invoices.
4. Sub-agents fan out in parallel with `Promise.all`.
5. Deterministic demo. `DEMO_REPLAY=1` swaps Specter and OpenAI calls for fixtures.
6. Stripe test mode only. `lib/stripe.ts` refuses any key that is not `sk_test_` or `rk_test_`.

## Verify

```bash
npm run typecheck

DEMO_REPLAY=1 npx tsx lib/__tests__/policy.test.ts
DEMO_REPLAY=1 npx tsx lib/__tests__/optimiser.test.ts
DEMO_REPLAY=1 npx tsx lib/__tests__/cursor.test.ts
npx tsx lib/__tests__/audit.test.ts
npx tsx scripts/memory-smoke.ts   # RUNS_DIR=<scratch dir> keeps the demo store clean
```

The optimiser test asserts the exact escalation set `[INV-FLOOR-BREACH, INV-LARGE-NEW, INV-SPECTER-DISTRESSED]`.

## Env vars

| Var | Purpose | Notes |
|-----|---------|-------|
| `STRIPE_SECRET_KEY` | Stripe test-mode transfers and the inflow card | Test keys only (`sk_test_` / `rk_test_`) |
| `DEMO_REPLAY` | `1` = fixtures, `0` = live | Keep `1` for the demo |
| `RUNS_DIR` | Where audit log, memory and run logs live | Default `./runs` |
| `SPECTER_API_KEY`, `SPECTER_BASE_URL` | Specter REST | Only used when `DEMO_REPLAY=0` |
| `CURSOR_API_KEY` | `@cursor/sdk` live sub-agent runs | Not on the demo path |
| `OPENAI_API_KEY` | Narration | Optional; only when `DEMO_REPLAY=0` |

## Deploy

Runway needs a Node host: memory shells out to the `hippo` CLI and the audit log writes files, neither of which works on Cloudflare Workers. The Cloudflare scripts (`npm run deploy:cf`) and the Vercel script (`npm run deploy:vercel`) are Floater's and were not re-tested for Runway; the live Floater demo at https://floater.skfsk27.workers.dev is the original Floater build, not Runway.

## Credits

Floater plan and docs: `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/plans/2026-04-30-phase-1.md`. Track: Money Movement.
