'use client';

import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { niceTicks } from '@/lib/chart-data';
import { axisProps, chartColors, gridProps, tooltipCursor } from '@/lib/chart-theme';
import { formatRate, rateScale } from '@/lib/format';
import { ChartWaiting, makeTooltip, thresholdLine, timeAxisProps, type Threshold } from './chart-kit';

export interface MetricRow {
  t: number;
  cpu?: number | null;
  mem?: number | null;
  disk?: number | null;
  netIn?: number | null;
  netOut?: number | null;
  read?: number | null;
  write?: number | null;
  processes?: number | null;
  load?: number | null;
}

type MetricKey = Exclude<keyof MetricRow, 't'>;

const lastValue = (rows: MetricRow[], key: MetricKey) => {
  for (let i = rows.length - 1; i >= 0; i--) {
    const v = rows[i][key];
    if (typeof v === 'number') return v;
  }
  return null;
};

const maxOf = (rows: MetricRow[], keys: MetricKey[]) =>
  rows.reduce((m, r) => Math.max(m, ...keys.map((k) => (typeof r[k] === 'number' ? (r[k] as number) : 0))), 0);

// Thresholds far above the data would squash the lines; those are left out.
const visibleThresholds = (thresholds: Threshold[], max: number) => thresholds.filter((t) => t.value <= Math.max(max * 3, 1));

const percent = (v: number) => `${Math.round(v)}%`;

const USAGE: { key: 'cpu' | 'mem' | 'disk'; label: string }[] = [
  { key: 'cpu', label: 'CPU' },
  { key: 'mem', label: 'Memory' },
  { key: 'disk', label: 'Disk' },
];

/**
 * CPU, memory and disk as three aligned charts on one time axis (small
 * multiples), each with its own rule thresholds. One series per chart, so no
 * legend: the row label names it and shows the latest value.
 */
export function UsageCharts({
  rows,
  thresholds,
  timeWindow,
}: {
  rows: MetricRow[];
  thresholds: Record<string, Threshold[]>;
  timeWindow?: [number, number];
}) {
  if (rows.length < 2) return <ChartWaiting height={240} />;
  const tooltip = makeTooltip((v) => `${v.toFixed(1)}%`);
  return (
    <div className="space-y-1">
      {USAGE.map(({ key, label }, i) => {
        const last = i === USAGE.length - 1;
        const latest = lastValue(rows, key);
        return (
          <div key={key} className="grid grid-cols-[4.75rem_minmax(0,1fr)] items-start gap-3 sm:grid-cols-[6rem_minmax(0,1fr)]">
            <div className="pt-1.5">
              <p className="text-[12.5px] font-medium text-muted-foreground">{label}</p>
              <p className="text-[18px] font-semibold leading-tight text-foreground">{latest === null ? '—' : percent(latest)}</p>
            </div>
            <div style={{ height: last ? 96 : 72 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis {...axisProps} {...timeAxisProps(rows, 5, timeWindow)} hide={!last} height={24} />
                  <YAxis {...axisProps} domain={[0, 100]} ticks={[0, 50, 100]} width={40} tickFormatter={percent} />
                  <Tooltip content={tooltip} cursor={tooltipCursor} isAnimationActive={false} />
                  {(thresholds[key] ?? []).map((t, n) => thresholdLine(t, percent, n))}
                  <Area
                    type="monotone"
                    dataKey={key}
                    name={label}
                    stroke={chartColors.series[0]}
                    strokeWidth={2}
                    fill={chartColors.series[0]}
                    fillOpacity={0.1}
                    connectNulls={false}
                    isAnimationActive={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export interface SeriesSpec {
  key: MetricKey;
  label: string;
}

// Round ticks for a rate axis, all in one unit; a top tick of 1000 KB/s or more moves up to MB/s.
function rateTicks(max: number) {
  let { divisor, unit } = rateScale(max);
  let ticks = niceTicks(max / divisor);
  if (ticks[ticks.length - 1] >= 1000 && unit !== 'GB/s') {
    divisor *= 1024;
    unit = unit === 'B/s' ? 'KB/s' : unit === 'KB/s' ? 'MB/s' : 'GB/s';
    ticks = niceTicks(max / divisor);
  }
  return { ticks: ticks.map((v) => v * divisor), divisor, unit };
}

const tickNumber = (n: number) => (Number.isInteger(n) ? `${n}` : `${Number(n.toFixed(2))}`);

/** Two rates (bytes/s) as lines on one axis whose ticks all share one unit. */
export function RateChart({
  rows,
  series,
  thresholds = [],
  height = 200,
  timeWindow,
}: {
  rows: MetricRow[];
  series: SeriesSpec[];
  thresholds?: Threshold[];
  height?: number;
  timeWindow?: [number, number];
}) {
  if (rows.length < 2) return <ChartWaiting height={height} />;
  const dataMax = maxOf(rows, series.map((s) => s.key));
  const shown = visibleThresholds(thresholds, dataMax);
  const { ticks, divisor, unit } = rateTicks(Math.max(dataMax, ...shown.map((t) => t.value)));
  const tooltip = makeTooltip((v) => formatRate(v));
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis {...axisProps} {...timeAxisProps(rows, 5, timeWindow)} height={24} />
          <YAxis
            {...axisProps}
            domain={[0, ticks[ticks.length - 1]]}
            ticks={ticks}
            width={76}
            tickFormatter={(v: number) => `${tickNumber(v / divisor)} ${unit}`}
          />
          <Tooltip content={tooltip} cursor={tooltipCursor} isAnimationActive={false} />
          {shown.map((t, n) => thresholdLine(t, (v) => formatRate(v), n))}
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={chartColors.series[i]}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** One plain number over time (load average, process count) from a zero baseline. */
export function SingleChart({
  rows,
  dataKey,
  label,
  format,
  thresholds = [],
  height = 180,
  timeWindow,
}: {
  rows: MetricRow[];
  dataKey: MetricKey;
  label: string;
  format: (value: number) => string;
  thresholds?: Threshold[];
  height?: number;
  timeWindow?: [number, number];
}) {
  if (rows.length < 2) return <ChartWaiting height={height} />;
  const dataMax = maxOf(rows, [dataKey]);
  const shown = visibleThresholds(thresholds, dataMax);
  const ticks = niceTicks(Math.max(dataMax, ...shown.map((t) => t.value)));
  const tooltip = makeTooltip((v) => format(v));
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis {...axisProps} {...timeAxisProps(rows, 4, timeWindow)} height={24} />
          <YAxis {...axisProps} domain={[0, ticks[ticks.length - 1]]} ticks={ticks} width={40} tickFormatter={tickNumber} />
          <Tooltip content={tooltip} cursor={tooltipCursor} isAnimationActive={false} />
          {shown.map((t, n) => thresholdLine(t, format, n))}
          <Line
            type="monotone"
            dataKey={dataKey}
            name={label}
            stroke={chartColors.series[0]}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export { lastValue };
