// One way to show times, durations and numbers across the app.
// Dates use day-month order and a 24-hour clock ("7 Oct 2026, 01:22").

type DateInput = string | number | Date;

const toDate = (value: DateInput) => (value instanceof Date ? value : new Date(value));

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const dateTimeSecondsFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});
const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
const timeSecondsFormat = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/** "7 Oct 2026" */
export function formatDate(value: DateInput) {
  return dateFormat.format(toDate(value));
}

/** "7 Oct 2026, 01:22" (or "…, 01:22:30" with seconds) */
export function formatDateTime(value: DateInput, withSeconds = false) {
  return (withSeconds ? dateTimeSecondsFormat : dateTimeFormat).format(toDate(value));
}

/** "01:22" (or "01:22:30" with seconds) */
export function formatTime(value: DateInput, withSeconds = false) {
  return (withSeconds ? timeSecondsFormat : timeFormat).format(toDate(value));
}

/** "just now", "45 s ago", "12 min ago", "3 h ago", "2 days ago", then the date. */
export function formatRelative(value: DateInput | null | undefined, now = Date.now()) {
  if (value === null || value === undefined) return 'never';
  const seconds = Math.max(0, Math.round((now - toDate(value).getTime()) / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds} s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return days === 1 ? '1 day ago' : `${days} days ago`;
  return formatDate(value);
}

/** Time left until a moment: "in 6 days", "in 5 h", "in 12 min"; null once it has passed. */
export function formatTimeUntil(value: DateInput, now = Date.now()) {
  const seconds = Math.round((toDate(value).getTime() - now) / 1000);
  if (seconds <= 0) return null;
  const days = Math.floor(seconds / 86400);
  if (days >= 1) return days === 1 ? 'in 1 day' : `in ${days} days`;
  const hours = Math.floor(seconds / 3600);
  if (hours >= 1) return `in ${hours} h`;
  return `in ${Math.max(1, Math.floor(seconds / 60))} min`;
}

/** 30 -> "30 s", 300 -> "5 min", 5400 -> "1 h 30 min", 172800 -> "2 days" */
export function formatDuration(totalSeconds: number) {
  const seconds = Math.round(totalSeconds);
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
  }
  const days = Math.round(seconds / 86400);
  return days === 1 ? '1 day' : `${days} days`;
}

const RATE_UNITS = ['B/s', 'KB/s', 'MB/s', 'GB/s'];

/** Bytes per second in the largest unit that keeps the number at or above 1. */
export function formatRate(bytesPerSecond: number | null | undefined) {
  if (bytesPerSecond === null || bytesPerSecond === undefined) return '—';
  let value = bytesPerSecond;
  let unit = 0;
  while (value >= 1024 && unit < RATE_UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value >= 100 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${RATE_UNITS[unit]}`;
}

/** The unit an axis should use for its largest value, so every tick shares one unit. */
export function rateScale(maxBytesPerSecond: number) {
  let unit = 0;
  let divisor = 1;
  while (maxBytesPerSecond / divisor >= 1024 && unit < RATE_UNITS.length - 1) {
    divisor *= 1024;
    unit++;
  }
  return { divisor, unit: RATE_UNITS[unit] };
}

export function formatPercent(value: number, decimals = 0) {
  return `${value.toFixed(decimals)}%`;
}

const numberFormat = new Intl.NumberFormat('en-US');

export function formatNumber(value: number) {
  return numberFormat.format(value);
}

/** "1 alert", "2 alerts" */
export function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** "bilal.ahmed@northwind.io" -> "BA", "audit@northwind.io" -> "AU" */
export function initialsFromEmail(email?: string | null) {
  if (!email) return '?';
  const local = email.split('@')[0];
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}
