'use client';

// Hero: cash today, floor, lowest point, and the 60-day runway line with the
// schedule's payments drawn on it. The path keeps a fixed command count so the
// browser can morph it when the schedule changes.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Forecast, Invoice, Schedule } from '@/lib/types';
import type { InflowState } from './InflowCard';
import { gbp, shortDate, LABEL, PANEL } from './ledger';
import { useTween } from './useTween';

type Props = {
  forecast: Forecast;
  schedule: Schedule | null;
  invoices: Invoice[];
  inflow: InflowState | null;
  extraCash: number;
  customerName: string;
  aside?: ReactNode;
};

const HORIZON = 60;
const H = 360;
const M = { l: 56, r: 24, t: 28, b: 32 };

function dayIndex(day0: string, iso: string): number {
  return Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(day0 + 'T00:00:00Z')) / 86_400_000);
}

function addDays(iso: string, d: number): string {
  return new Date(Date.parse(iso + 'T00:00:00Z') + d * 86_400_000).toISOString().slice(0, 10);
}

type Runway = { day0: string; opening: number; cash: number[]; payDays: Set<number> };

function buildRunway(forecast: Forecast, schedule: Schedule | null, invoices: Invoice[]): Runway {
  const day0 = [...forecast.flows.map((f) => f.date)].sort()[0] ?? new Date().toISOString().slice(0, 10);
  const delta = new Array<number>(HORIZON + 1).fill(0);
  for (const f of forecast.flows) {
    const d = dayIndex(day0, f.date);
    if (d >= 0 && d <= HORIZON) delta[d]! += f.inflow - f.outflow;
  }
  const payDays = new Set<number>();
  if (schedule) {
    const amountById = new Map(invoices.map((i) => [i.id, i.amount]));
    for (const e of schedule.entries) {
      if (e.reason === 'flagged') continue;
      const d = dayIndex(day0, e.payDate);
      const amount = amountById.get(e.invoiceId);
      if (d < 0 || d > HORIZON || amount === undefined) continue;
      delta[d]! -= amount - e.projectedSaving;
      payDays.add(d);
    }
  }
  const cash: number[] = [];
  let running = forecast.openingCash;
  for (let d = 0; d <= HORIZON; d++) {
    running += delta[d]!;
    cash.push(running);
  }
  return { day0, opening: forecast.openingCash, cash, payDays };
}

function niceStep(max: number): number {
  const rough = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const n = rough / mag;
  return (n > 5 ? 10 : n > 2 ? 5 : n > 1 ? 2 : 1) * mag;
}

function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(1200);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => { if (entry) setW(entry.contentRect.width); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export function RunwayHero({ forecast, schedule, invoices, inflow, extraCash, customerName, aside }: Props) {
  const runway = buildRunway(forecast, schedule, invoices);
  const cashToday = useTween(forecast.openingCash);
  let low = 0;
  runway.cash.forEach((c, d) => { if (c < runway.cash[low]!) low = d; });
  const lowCash = runway.cash[low]!;
  const breach = lowCash < forecast.cashFloor;

  return (
    <section className={`${PANEL} p-6`}>
      <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-6">
        <div className="flex flex-wrap items-end gap-x-12 gap-y-4">
          <div>
            <div className={LABEL}>Cash today</div>
            <div className="mt-2 font-serif text-[56px] leading-[0.9] tabular-nums">{gbp(cashToday)}</div>
          </div>
          <div>
            <div className={LABEL}>Floor</div>
            <div className="mt-2 font-serif text-[32px] leading-none text-floor tabular-nums">{gbp(forecast.cashFloor)}</div>
          </div>
          <div>
            <div className={LABEL}>Lowest point</div>
            <div className={`mt-2 font-serif text-[32px] leading-none tabular-nums ${breach ? 'text-floor' : ''}`}>
              {gbp(lowCash)} <span className="font-sans text-sm text-ink-2">on {shortDate(addDays(runway.day0, low))}</span>
            </div>
          </div>
        </div>
        {aside}
      </div>
      <RunwayChart
        runway={runway}
        floor={forecast.cashFloor}
        inflowLabel={inflow?.paid && extraCash > 0 ? `${customerName} paid ${gbp(extraCash)}` : null}
        extraCash={extraCash}
      />
    </section>
  );
}

type ChartProps = { runway: Runway; floor: number; inflowLabel: string | null; extraCash: number };

function RunwayChart({ runway, floor, inflowLabel, extraCash }: ChartProps) {
  const [ref, width] = useWidth();
  const W = Math.max(320, width);
  const plotW = W - M.l - M.r;
  const plotH = H - M.t - M.b;
  const top = Math.max(...runway.cash, runway.opening, floor) * 1.08;
  const step = niceStep(top);
  const maxY = Math.ceil(top / step) * step;
  const x = (d: number) => M.l + (d / HORIZON) * plotW;
  const y = (c: number) => M.t + (1 - Math.max(0, c) / maxY) * plotH;

  const segs: string[] = [`M${x(0).toFixed(1)},${y(runway.opening).toFixed(1)}`];
  let prev = runway.opening;
  runway.cash.forEach((c, d) => {
    segs.push(`L${x(d).toFixed(1)},${y(prev).toFixed(1)}`, `L${x(d).toFixed(1)},${y(c).toFixed(1)}`);
    prev = c;
  });
  const line = segs.join(' ');
  const area = `${line} L${x(HORIZON).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;

  const yTicks: number[] = [];
  for (let v = 0; v <= maxY; v += step) yTicks.push(v);
  const every = W < 700 ? 14 : 7;
  const xTicks: number[] = [];
  for (let d = 0; d <= HORIZON; d += every) xTicks.push(d);
  const last = runway.cash[HORIZON]!;
  const tailTop = Math.max(...runway.cash.slice(HORIZON - 10));

  return (
    <div ref={ref} className="mt-6 w-full">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block font-mono" role="img" aria-label="Projected cash for the next 60 days">
        {yTicks.map((v) => (
          <g key={`y${v}`}>
            <line x1={M.l} x2={M.l + plotW} y1={y(v)} y2={y(v)} stroke="var(--color-rule)" strokeWidth="1" />
            <text x={M.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-2)">£{Math.round(v / 1000)}k</text>
          </g>
        ))}
        {xTicks.map((d) => (
          <text key={`x${d}`} x={x(d)} y={H - 10} textAnchor={d === 0 ? 'start' : 'middle'} fontSize="11" fill="var(--color-ink-2)">
            {shortDate(addDays(runway.day0, d))}
          </text>
        ))}

        <path d={area} className="runway-line" fill="var(--color-ink)" fillOpacity="0.04" />
        <path d={line} className="runway-line" fill="none" stroke="var(--color-ink)" strokeWidth="1.5" strokeLinejoin="round" />

        {[...runway.payDays].map((d) => (
          <line key={`t${d}`} x1={x(d)} x2={x(d)} y1={y(runway.cash[d]!) - 4} y2={y(runway.cash[d]!) + 4} stroke="var(--color-ink)" strokeWidth="1" />
        ))}

        <line x1={M.l} x2={M.l + plotW} y1={y(floor)} y2={y(floor)} stroke="var(--color-floor)" strokeWidth="1" strokeDasharray="4 4" />
        <text x={M.l + plotW} y={y(floor) - 6} textAnchor="end" fontSize="11" fill="var(--color-floor)" className="font-sans">
          Floor {gbp(floor)}
        </text>
        <text x={M.l + plotW} y={y(tailTop) - 10} textAnchor="end" fontSize="12" fill="var(--color-ink)" className="font-sans">
          Projected cash {gbp(last)}
        </text>

        <line x1={x(0)} x2={x(0)} y1={M.t - 8} y2={M.t + plotH} stroke="var(--color-ink-2)" strokeWidth="1" />
        <text x={x(0) + 6} y={M.t - 12} fontSize="11" fill="var(--color-ink-2)" className="font-sans">Today</text>

        {inflowLabel && (
          <g className="animate-row-in">
            <line x1={x(0) + 3} x2={x(0) + 3} y1={y(runway.opening - extraCash)} y2={y(runway.opening)} stroke="var(--color-money)" strokeWidth="2" />
            <circle cx={x(0) + 3} cy={y(runway.opening)} r="3.5" fill="var(--color-money)" />
            <text x={x(0) + 12} y={y(runway.opening) - 10} fontSize="12" fontWeight="500" fill="var(--color-money)" className="font-sans">
              {inflowLabel}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
