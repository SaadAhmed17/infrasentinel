// Data helpers for the metric charts: round ticks, gaps and thinning.

const MINUTE = 60_000;
const TIME_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 180, 360, 720].map((m) => m * MINUTE);

/** Ticks on round minutes ("01:20", "01:25", …), at most `target` of them. */
export function timeTicks(min: number, max: number, target = 5) {
  if (!(max > min)) return [];
  const span = max - min;
  const step = TIME_STEPS.find((s) => span / s <= target) ?? TIME_STEPS[TIME_STEPS.length - 1];
  const ticks: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max; t += step) ticks.push(t);
  return ticks;
}

/** 0 and evenly spaced round values up to at least `max` (1, 2, 2.5 or 5 × 10ⁿ steps). */
export function niceTicks(max: number, target = 4) {
  if (!(max > 0)) return [0, 1];
  const rough = max / target;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? 10 * magnitude;
  const ticks: number[] = [];
  for (let v = 0; v < max + step * 0.001; v += step) ticks.push(Number(v.toFixed(10)));
  if (ticks[ticks.length - 1] < max) ticks.push(Number((ticks[ticks.length - 1] + step).toFixed(10)));
  return ticks;
}

/**
 * Inserts an empty point where readings stop for longer than `maxGap` (the
 * server was offline), so lines break instead of drawing a straight line
 * across the outage.
 */
export function withGaps<T extends { t: number }>(rows: T[], maxGap = 60_000): (T | { t: number })[] {
  const out: (T | { t: number })[] = [];
  rows.forEach((row, i) => {
    if (i > 0 && row.t - rows[i - 1].t > maxGap) out.push({ t: rows[i - 1].t + 1 });
    out.push(row);
  });
  return out;
}

/**
 * Thins long ranges to about `points` rows by averaging each time bucket,
 * keeping charts smooth for 1 h and 6 h views.
 */
export function downsample<T extends { t: number }>(rows: T[], points = 300): T[] {
  if (rows.length <= points) return rows;
  const size = Math.ceil(rows.length / points);
  const out: T[] = [];
  for (let i = 0; i < rows.length; i += size) {
    const bucket = rows.slice(i, i + size);
    const merged: Record<string, unknown> = { ...bucket[bucket.length - 1] };
    for (const key of Object.keys(merged)) {
      if (key === 't') continue;
      const values = bucket.map((r) => (r as Record<string, unknown>)[key]).filter((v): v is number => typeof v === 'number');
      merged[key] = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    }
    out.push(merged as T);
  }
  return out;
}
