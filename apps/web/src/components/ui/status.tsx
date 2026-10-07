import { cn } from '@/lib/utils';
import { TONE_COLOR, toneSurface, type Tone } from './tone';

const SERVER_TONE: Record<string, Tone> = { ONLINE: 'online', OFFLINE: 'offline', UNKNOWN: 'unknown' };
const SERVER_LABEL: Record<string, string> = { ONLINE: 'Online', OFFLINE: 'Offline', UNKNOWN: 'Waiting for first report' };
const SERVER_SHORT_LABEL: Record<string, string> = { ONLINE: 'Online', OFFLINE: 'Offline', UNKNOWN: 'Waiting' };
const SEVERITY_LEVEL: Record<string, { tone: Tone; level: number }> = {
  LOW: { tone: 'low', level: 1 },
  MEDIUM: { tone: 'medium', level: 2 },
  HIGH: { tone: 'high', level: 3 },
  CRITICAL: { tone: 'critical', level: 4 },
};

function sentence(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export function serverStatusLabel(status: string, short = false) {
  return (short ? SERVER_SHORT_LABEL : SERVER_LABEL)[status] ?? sentence(status);
}

export function severityLabel(severity: string) {
  return sentence(severity);
}

/** A server's state as a dot. Waiting (never reported) is a hollow ring. Pulses only when asked. */
export function StatusDot({ status, pulse = false, className }: { status: string; pulse?: boolean; className?: string }) {
  const color = TONE_COLOR[SERVER_TONE[status] ?? 'unknown'];
  const hollow = status === 'UNKNOWN';
  return (
    <span className={cn('relative inline-flex size-2 shrink-0', className)} aria-hidden>
      {pulse && <span className="absolute inset-0 animate-status-ping rounded-full" style={{ background: color }} />}
      <span
        className="relative inline-flex size-2 rounded-full"
        style={hollow ? { boxShadow: `inset 0 0 0 1.5px ${color}` } : { background: color }}
      />
    </span>
  );
}

/** Dot and word, e.g. "● Online". The word stays in the text colour; the dot carries the state colour. */
export function ServerStatusBadge({
  status,
  short = false,
  className,
}: {
  status: string;
  short?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-[13px] font-medium text-foreground', className)}>
      <StatusDot status={status} />
      {serverStatusLabel(status, short)}
    </span>
  );
}

/** Severity as "rack lights": the more lights lit, the more severe. */
export function SeverityLights({ severity, className }: { severity: string; className?: string }) {
  const { tone, level } = SEVERITY_LEVEL[severity] ?? { tone: 'unknown' as Tone, level: 0 };
  const color = TONE_COLOR[tone];
  return (
    <span className={cn('flex items-center gap-[2px]', className)} aria-hidden>
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className="size-[5px] rounded-[1px]" style={{ background: color, opacity: i <= level ? 1 : 0.22 }} />
      ))}
    </span>
  );
}

/**
 * Severity badge: rack lights and the level in words. `compact` shows the lights
 * only (for phones and dense rows); the level stays available to screen readers.
 */
export function SeverityBadge({
  severity,
  compact = false,
  className,
}: {
  severity: string;
  compact?: boolean;
  className?: string;
}) {
  const { tone } = SEVERITY_LEVEL[severity] ?? { tone: 'unknown' as Tone };
  const label = `${severityLabel(severity)} severity`;
  if (compact) {
    return (
      <span className={cn('inline-flex h-5 items-center', className)} title={label}>
        <SeverityLights severity={severity} />
        <span className="sr-only">{label}</span>
      </span>
    );
  }
  return (
    <span
      className={cn('inline-flex h-6 items-center gap-2 rounded-md border px-2 text-[12px] font-semibold', className)}
      style={toneSurface(tone)}
      title={label}
    >
      <SeverityLights severity={severity} />
      {severityLabel(severity)}
    </span>
  );
}

const INCIDENT_LABEL: Record<string, string> = { OPEN: 'Open', INVESTIGATING: 'Investigating', RESOLVED: 'Resolved' };

// ○ open (not started), ◐ investigating (in progress), ✓ resolved
function IncidentGlyph({ status }: { status: string }) {
  if (status === 'RESOLVED') {
    return (
      <svg viewBox="0 0 12 12" className="size-3 text-status-online" aria-hidden>
        <circle cx="6" cy="6" r="5.25" fill="currentColor" opacity="0.18" />
        <path d="M3.6 6.2 5.2 7.8 8.4 4.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === 'INVESTIGATING') {
    return (
      <svg viewBox="0 0 12 12" className="size-3 text-foreground" aria-hidden>
        <circle cx="6" cy="6" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6 1.25a4.75 4.75 0 0 1 0 9.5z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 12 12" className="size-3 text-foreground" aria-hidden>
      <circle cx="6" cy="6" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** Incident status: a neutral pill with a glyph. Colour is kept for severity (and green for resolved). */
export function IncidentStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full border border-border-strong bg-surface-2 px-2.5 text-[12px] font-medium',
        status === 'RESOLVED' ? 'text-muted-foreground' : 'text-foreground',
        className,
      )}
    >
      <IncidentGlyph status={status} />
      {INCIDENT_LABEL[status] ?? sentence(status)}
    </span>
  );
}
