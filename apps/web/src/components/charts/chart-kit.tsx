'use client';

import { useState, type ReactNode } from 'react';
import { ReferenceLine, type TooltipContentProps } from 'recharts';
import { ChevronDown } from 'lucide-react';
import { formatTime } from '@/lib/format';
import { timeTicks } from '@/lib/chart-data';
import { cn } from '@/lib/utils';

export interface Threshold {
  /** Rule name, e.g. "High CPU". */
  name: string;
  value: number;
  /** Rule severity, used as the line color (CRITICAL, HIGH, …). */
  severity: string;
  operator: 'GREATER_THAN' | 'LESS_THAN';
}

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: 'var(--sev-critical)',
  HIGH: 'var(--sev-high)',
  MEDIUM: 'var(--sev-medium)',
  LOW: 'var(--sev-low)',
};

/**
 * A rule's threshold as a dashed line in the rule's severity color, labelled in
 * text color at the right. Call it as a function so the ReferenceLine stays a
 * direct child of the chart.
 */
export function thresholdLine(t: Threshold, format: (value: number) => string, key: string | number) {
  const color = SEVERITY_COLOR[t.severity] ?? 'var(--sev-high)';
  return (
    <ReferenceLine
      key={key}
      y={t.value}
      stroke={color}
      strokeWidth={1.25}
      strokeDasharray="4 4"
      ifOverflow="extendDomain"
      label={{
        value: `${t.name} ${t.operator === 'LESS_THAN' ? 'below' : ''} ${format(t.value)}`.replace(/\s+/g, ' '),
        position: 'insideTopRight',
        fill: 'var(--muted-foreground)',
        fontSize: 10.5,
        fontFamily: 'var(--font-geist)',
      }}
    />
  );
}

/**
 * X axis props for a time series keyed by `t` (ms): round-minute ticks as
 * "HH:MM". `timeWindow` fixes the axis to a time range, so a server that only just
 * started reporting shows a short line at the right instead of a stretched one.
 */
export function timeAxisProps(rows: { t: number }[], target = 5, timeWindow?: [number, number]) {
  const min = timeWindow?.[0] ?? rows[0]?.t ?? 0;
  const max = timeWindow?.[1] ?? rows[rows.length - 1]?.t ?? 0;
  return {
    dataKey: 't',
    type: 'number' as const,
    scale: 'time' as const,
    domain: [min, max] as [number, number],
    ticks: timeTicks(min, max, target),
    tickFormatter: (value: number) => formatTime(value),
    minTickGap: 24,
  };
}

/** Recharts tooltip content: time first, then each series with a short line key and its value. */
export function makeTooltip(format: (value: number, dataKey: string) => string) {
  return function ChartTooltip({ active, payload, label }: TooltipContentProps) {
    if (!active || !payload?.length || label === undefined) return null;
    const rows = payload.filter((p) => typeof p.value === 'number');
    if (!rows.length) return null;
    return (
      <div className="min-w-36 rounded-lg border border-border-strong bg-popover px-3 py-2 text-[12.5px] shadow-[0_8px_24px_-12px_rgb(0_0_0/0.45)]">
        <p className="mb-1 text-[11.5px] tabular-nums text-muted-foreground">{formatTime(Number(label), true)}</p>
        {rows.map((p) => (
          <div key={String(p.dataKey)} className="flex items-center gap-2 py-0.5">
            <span className="h-0.5 w-3 rounded-full" style={{ background: p.stroke ?? p.color }} aria-hidden />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="ml-auto pl-3 font-semibold tabular-nums text-foreground">
              {format(Number(p.value), String(p.dataKey))}
            </span>
          </div>
        ))}
      </div>
    );
  };
}

/** Legend item: line key, series name and its latest value. */
export function LegendKey({ color, label, value }: { color: string; label: string; value?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
      <span className="h-0.5 w-3 rounded-full" style={{ background: color }} aria-hidden />
      {label}
      {value && <span className="font-semibold tabular-nums text-foreground">{value}</span>}
    </span>
  );
}

/**
 * The table twin of a chart: the latest readings as text, for keyboard and
 * screen-reader users (and anyone who wants exact numbers).
 */
export function ChartReadings<T extends { t: number }>({
  rows,
  columns,
  caption,
}: {
  rows: T[];
  columns: { key: keyof T & string; label: string; format: (value: number) => string }[];
  caption: string;
}) {
  const [open, setOpen] = useState(false);
  const latest = rows.slice(-10).reverse();
  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-4 py-2.5 text-left text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:px-5"
      >
        <ChevronDown className={cn('size-3.5 transition-transform duration-150', open && 'rotate-180')} strokeWidth={1.75} aria-hidden />
        {open ? 'Hide readings' : 'Show readings'}
      </button>
      {open && (
        <div className="overflow-x-auto px-4 pb-4 sm:px-5">
          <table className="w-full text-[12.5px] tabular-nums">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr className="text-left text-muted-foreground">
                <th scope="col" className="py-1.5 pr-4 font-medium">
                  Time
                </th>
                {columns.map((c) => (
                  <th key={c.key} scope="col" className="py-1.5 pr-4 text-right font-medium">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {latest.map((row) => (
                <tr key={row.t} className="border-t border-border/70">
                  <td className="py-1.5 pr-4 text-muted-foreground">{formatTime(row.t, true)}</td>
                  {columns.map((c) => {
                    const value = row[c.key];
                    return (
                      <td key={c.key} className="py-1.5 pr-4 text-right text-foreground">
                        {typeof value === 'number' ? c.format(value) : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Shown instead of a chart until there are at least two readings to draw. */
export function ChartWaiting({ height, children }: { height: number; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-center text-center text-[13px] text-muted-foreground" style={{ height }}>
      {children ?? 'Waiting for more readings'}
    </div>
  );
}
