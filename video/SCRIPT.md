# Runway demo script (1:53)

**0:00** Did you know many suppliers give you two percent off if you pay within ten days instead of thirty? Over a year, that's like a thirty-seven percent return on your cash.

**0:11** Most small businesses never take it. They pay on the due date to stay safe, because paying early can leave them short of cash. And cash flow problems close fifty thousand UK firms a year.

**0:25** No accounting software decides when to pay each bill. So in April we built Floater to plan it: pay early, on time, or late.

**0:33** Runway is Floater that actually pays. I hit Optimise: forty-one bills planned around the cash we must keep, three and a half thousand pounds saved, and four risky ones it asks me about.

**0:48** I approve one, reject a brand new vendor, and delay a big one. I hit Execute. Thirty-eight real payments go out through Stripe, each written to a log where any change would show.

**1:05** Then a customer pays us six thousand pounds by scanning this QR code. Runway sees the money land, re-plans straight away, and pays a bill it was holding back.

**1:23** Next run, it remembers my decisions, using hippo, our memory layer. It blocks the vendor I rejected, pays the one I approved, and asks me nothing.

**1:36** Click Why on any payment to see the reason. Click Verify to prove the log hasn't been touched.

**1:46** Runway. Earn the discounts. Never run out of cash.

---
Where the numbers come from:
- **37%:** "2/10 net 30" means 2% off for paying 20 days early, and 2/98 × 365/20 = 37% a year. Floater's PRD uses the same figure.
- **50,000 firms:** the FSB's "Time to Act" report.
- **41 bills, £3,529 saved, 4 asked, 38 payouts, 0 asked in run 2:** all from the recorded take.
