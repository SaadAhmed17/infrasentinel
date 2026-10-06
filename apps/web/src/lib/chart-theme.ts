// Recharts styling taken from the theme tokens, so charts follow the
// light/dark switch without re-rendering logic.
export const chartColors = {
  series: ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'],
  grid: 'var(--border)',
  axis: 'var(--muted-foreground)',
  threshold: 'var(--sev-critical)',
};

export const axisProps = {
  stroke: 'var(--border-strong)',
  tickLine: false,
  axisLine: false,
  tick: { fill: 'var(--muted-foreground)', fontSize: 11, fontFamily: 'var(--font-geist-mono)' },
} as const;

export const gridProps = {
  stroke: 'var(--border)',
  strokeDasharray: '2 4',
  vertical: false,
} as const;

export const tooltipProps = {
  cursor: { stroke: 'var(--border-strong)', strokeWidth: 1 },
  contentStyle: {
    background: 'var(--popover)',
    border: '1px solid var(--border-strong)',
    borderRadius: 10,
    boxShadow: 'var(--shadow-panel)',
    padding: '8px 12px',
    fontSize: 12.5,
    color: 'var(--popover-foreground)',
  },
  labelStyle: {
    color: 'var(--muted-foreground)',
    fontFamily: 'var(--font-geist-mono)',
    fontSize: 11,
    marginBottom: 4,
  },
  itemStyle: { color: 'var(--popover-foreground)', padding: 0 },
} as const;
