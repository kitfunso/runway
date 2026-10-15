# Runway design direction

One direction, locked: **a treasury ledger**. It should read like a finance team's working paper drawn by the FT graphics desk, not like an AI dashboard. References: FT and Economist line charts (thin line, labels on the line, no legend), Stripe Dashboard tables (dense, quiet, right-aligned money), Mercury (restraint, one accent at a time).

## Tokens

| Token | Value | Use |
|---|---|---|
| paper | `#F7F5F0` | page background |
| sheet | `#FFFFFF` | panels |
| ink | `#141414` | text, chart line |
| ink-2 | `#5C5A55` | secondary text |
| rule | `#E3DFD6` | hairlines, 1px only |
| money-in / paid | `#0B6B4B` | paid, inflow, chain intact |
| floor / blocked | `#A3301F` | cash floor line, breaches, broken chain |
| held | `#A86B12` | escalations awaiting a decision |
| test | `#A86B12` on `#FBF3E4` | the "Test mode" tag only |

No other colours. No gradients, no tinted card backgrounds except the held and test tints.

Type (next/font/google, already in Next 15):
- Display: **Instrument Serif**, for the wordmark and the big cash figures only (`£80,000` at 56px, the lowest-point figure at 32px). Never for body.
- UI: **Geist**, 14px body, 12px labels in uppercase with 0.06em tracking, 500 weight max for headings.
- Numbers, IDs, hashes: **Geist Mono** with `font-variant-numeric: tabular-nums`, money always right-aligned.

Shape: radius 6px on buttons and panels, 999px only on status pills. Borders 1px `rule`. Shadow: none, except a 1px `0 1px 0 rgba(0,0,0,.04)` under sticky headers. Spacing on an 8px grid; panels have 24px padding.

## Layout (1440 wide is the recording size; must also hold at 1280)

1. **Header row**: "Runway" wordmark in Instrument Serif 28px, then in ink-2 "Treasury agent". Right side: a small `TEST MODE` pill, then the two primary buttons. Primary button: ink background, paper text. Secondary: 1px rule border, ink text. No logo tile, no "Live demo" badge.
2. **Hero: the runway chart**, full width, 360px tall. Above it, left: "Cash today" label and `£80,000` in serif 56px; then two smaller stats in a row: "Floor £40,000" in floor colour, "Lowest point £41,200 on 23 Oct" in ink. The chart: 1.5px ink line, no fill or a 4% ink fill, the floor as a dashed floor-colour line labelled at its right end, today as a thin vertical rule labelled "Today". Payments appear as small ticks on the line; when the schedule changes the line morphs (300ms ease-out). When the Acme inflow lands, a money-in vertical marker appears at today with the label "Acme paid £6,000", and the big figure counts up.
3. **Main grid**, two columns 8/4:
   - Left: **Schedule** as a ledger table, not cards. Columns: Date, Vendor, Invoice, Amount (mono, right), Action pill (Paid / Scheduled / Held / Released by inflow), Rule (12px ink-2), Stripe (mono transfer id linking to the dashboard, or a dash). Row height 44px, hairline separators, sticky header. Held rows get the held tint and float to the top.
   - Right: **Needs a decision** rail: each escalation as a compact panel with vendor, amount in mono, the reasons as a short list, the memory reason in italics if present ("You rejected Northwind on 12 Oct"), and three buttons in a row: Approve (ink), Defer, Reject (secondary). Under it, **Receivable**: the QR card styled as an invoice stub (dashed top edge, "Acme Ltd · Invoice due · £6,000", QR 168px, "Scan to pay with a test card" in ink-2). When paid, the stub gets a money-in "PAID" stamp in mono caps.
4. **Audit band** full width under the grid: label "Audit chain", then the last 6 rows drawn as small mono boxes `a3f9c1…` linked by thin arrows, row count, and a Verify button. Intact: a money-in dot and "Chain intact, 14 rows". Broken: the broken box outlined in floor colour and "Broken at row 9".
5. **Policy** moves to a collapsible section under the audit band, two columns: "Pays on its own when all are true" and "Asks a human when any is true", rules in Geist 14px, reasons in ink-2. Sourced from `lib/policy.ts` as today.
6. The four step pills go. Replace with nothing: the page itself shows the state.

## Motion

Count-up on money figures (400ms), row insert fade and 4px rise (200ms, staggered 30ms), chart line morph (300ms). Nothing loops, nothing pulses except a single 1.2s pulse on the receivable stub while waiting for payment. Respect `prefers-reduced-motion`.

## Words

Sentence case everywhere. Plain verbs: "Pay", "Hold", "Release", "Verify". Money as `£4,200` (no decimals unless pence matter). Dates as `23 Oct`. No em dashes. No emoji. No "AI", "smart" or sparkle icons anywhere in the UI.

## Banned

Gradients, glassmorphism, glow, purple, teal, emoji, rounded-2xl everything, centred hero copy, card grids of identical tiles, icon-per-label decoration, placeholder lorem, drop shadows deeper than 1px.
