// Pure model for the how-it-works figure. Every amount is from data/*.json; the
// low points come from lib/optimiser.ts simulate() under DEMO_REPLAY=1 (see README in build.mjs).

export const FLOOR = 40000;
export const OPENING = 80000;
export const INFLOW = { from: "Acme Ltd", amount: 6000 };
export const AUTO_LIMIT = 5000;

// Left to right along the manifold.
export const VALVES = [
  { id: "INV-EARLY-01", vendor: "Brightleaf Logistics", amount: 4500, kind: "auto" },
  { id: "INV-RELEASE-01", vendor: "Coral Cloud Hosting", amount: 1500, kind: "floor" },
  { id: "INV-EARLY-02", vendor: "Coral Cloud Hosting", amount: 4400, kind: "auto" },
  { id: "remembered", vendor: "rejected vendor", amount: 0, kind: "pinned" },
];

// Lowest projected balance over the 60-day horizon at each step.
export const LOW = {
  start: 49400,
  afterFirst: 44900,
  afterSecond: 40500,
  heldWouldLeave: 39000,
  afterInflow: 46500,
  afterRelease: 45000,
};

export const HELD = VALVES[1];
export const RELEASE_AT = FLOOR + HELD.amount;
export const locked = (low) => low - HELD.amount < FLOOR;

const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const pulse = (t, from, to) => ease((t - from) / 0.5) * (1 - ease((t - to) / 0.5));

export const TOUR = { first: 1.2, second: 3.6, tried: 6.0, pour: 7.6, release: 10.2, end: 15.5 };
export const OPEN_FOR = 1.6;

export function sceneAt(t) {
  const T = TOUR;
  const steps = [
    [T.first + OPEN_FOR, LOW.afterFirst],
    [T.second + OPEN_FOR, LOW.afterSecond],
    [T.pour + 1.4, LOW.afterInflow],
    [T.release + OPEN_FOR, LOW.afterRelease],
  ];
  let low = LOW.start;
  let done = 0;
  for (const [at, value] of steps) if (t >= at - OPEN_FOR * 0.5) { low = value; done++; }
  const open = [
    pulse(t, T.first, T.first + OPEN_FOR),
    t >= T.tried && t < T.tried + 1.2 ? 0.12 * Math.sin(((t - T.tried) / 1.2) * Math.PI) : pulse(t, T.release, T.release + OPEN_FOR),
    pulse(t, T.second, T.second + OPEN_FOR),
    0,
  ];
  const paid = (done >= 1 ? 1 : 0) + (done >= 2 ? 1 : 0) + (done >= 4 ? 1 : 0);
  return {
    low,
    open,
    pour: pulse(t, T.pour, T.pour + 1.6),
    paid,
    held: done >= 4 ? 1 : 2,
    inflowIn: done >= 3,
    reset: t >= T.end,
  };
}

const gbp = (n) => "£" + Math.round(n).toLocaleString("en-GB");
export const readoutOf = (s) => `Low point ${gbp(s.low)} · floor ${gbp(FLOOR)} · paid ${s.paid} · held ${s.held}`;
