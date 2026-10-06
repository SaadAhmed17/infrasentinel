import { cn } from '@/lib/utils';
import { TONE_COLOR, toneSurface, type Tone } from './tone';

const SERVER_TONE: Record<string, Tone> = { ONLINE: 'online', OFFLINE: 'offline', UNKNOWN: 'unknown' };
const SEVERITY_LEVEL: Record<string, { tone: Tone; level: number }> = {
  LOW: { tone: 'low', level: 1 },
  MEDIUM: { tone: 'medium', level: 2 },
  HIGH: { tone: 'high', level: 3 },
  CRITICAL: { tone: 'critical', level: 4 },
};
const INCIDENT_TONE: Record<string, Tone> = { OPEN: 'critical', INVESTIGATING: 'medium', RESOLVED: 'online' };

function label(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export function StatusDot({ status, pulse, className }: { status: string; pulse?: boolean; className?: string }) {
  const color = TONE_COLOR[SERVER_TONE[status] ?? 'unknown'];
  const live = pulse ?? status === 'ONLINE';
  return (
    <span className={cn('relative inline-flex size-2 shrink-0', className)} aria-hidden>
      {live && (
        <span className="absolute inset-0 animate-status-ping rounded-full" style={{ background: color }} />
      )}
      <span className="relative inline-flex size-2 rounded-full" style={{ background: color }} />
    </span>
  );
}

export function ServerStatusBadge({ status }: { status: string }) {
  const color = TONE_COLOR[SERVER_TONE[status] ?? 'unknown'];
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[12px] font-medium uppercase tracking-[0.08em]" style={{ color }}>
      <StatusDot status={status} />
      {status}
    </span>
  );
}

// Severity as "rack lights": the more lights lit, the more severe.
export function SeverityBadge({ severity, className }: { severity: string; className?: string }) {
  const { tone, level } = SEVERITY_LEVEL[severity] ?? { tone: 'unknown' as Tone, level: 0 };
  const color = TONE_COLOR[tone];
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-2 rounded-md border px-2 font-mono text-[11px] font-semibold uppercase tracking-[0.08em]',
        className,
      )}
      style={toneSurface(tone)}
      title={`${label(severity)} severity`}
    >
      <span className="flex items-center gap-[2px]" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="size-[5px] rounded-[1px]"
            style={{ background: color, opacity: i <= level ? 1 : 0.22 }}
          />
        ))}
      </span>
      {severity}
    </span>
  );
}

export function IncidentStatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = INCIDENT_TONE[status] ?? 'unknown';
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em]',
        className,
      )}
      style={toneSurface(tone)}
    >
      <span className="size-1.5 rounded-full" style={{ background: TONE_COLOR[tone] }} aria-hidden />
      {status}
    </span>
  );
}
