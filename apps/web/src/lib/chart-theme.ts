// Recharts styling taken from the theme tokens, so charts follow the
// light/dark switch without re-rendering logic. Two series colors at most per
// chart (checked with the dataviz palette validator in both themes).
export const chartColors = {
  series: ['var(--chart-1)', 'var(--chart-2)'],
  grid: 'var(--chart-grid)',
  axis: 'var(--muted-foreground)',
};

export const axisProps = {
  stroke: 'var(--chart-grid)',
  tickLine: false,
  axisLine: false,
  tick: { fill: 'var(--muted-foreground)', fontSize: 11, fontFamily: 'var(--font-geist)', fontVariantNumeric: 'tabular-nums' },
} as const;

// Solid hairlines, horizontal only. Dashes are kept for rule thresholds.
export const gridProps = {
  stroke: 'var(--chart-grid)',
  vertical: false,
} as const;

export const tooltipCursor = { stroke: 'var(--border-strong)', strokeWidth: 1 };
