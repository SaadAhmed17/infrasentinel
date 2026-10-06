import { CornerBrackets } from '@/components/ui/panel';
import { SeverityBadge } from '@/components/ui/status';

// Illustration for the landing page: what the console shows when the rule
// engine catches something. Example data, labelled as such.
const EVENTS = [
  { rule: 'SSH brute force', detail: '7 failed logins from 203.0.113.50', server: 'edge-gateway', severity: 'CRITICAL', age: 'now' },
  { rule: 'Unapproved sudo', detail: 'mallory ran /usr/bin/cat /etc/shadow', server: 'prod-db-01', severity: 'HIGH', age: '12 s' },
  { rule: 'LSTM anomaly', detail: 'reconstruction error 4.7× threshold', server: 'prod-web-01', severity: 'HIGH', age: '41 s' },
  { rule: 'Disk almost full', detail: 'disk usage 93.8% for 30 s', server: 'prod-db-01', severity: 'MEDIUM', age: '2 min' },
  { rule: 'Service crash', detail: 'no heartbeat for 64 s', server: 'staging-api', severity: 'CRITICAL', age: '5 min' },
];

export function DetectionFeed() {
  return (
    <div className="relative rounded-2xl border border-border-strong bg-card/85 shadow-[var(--shadow-panel)] backdrop-blur-md">
      <CornerBrackets />
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div>
          <p className="hud-label">Detections</p>
          <p className="mt-0.5 text-[14px] font-semibold text-foreground">Northwind Ops · example</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-md border border-sev-critical/30 bg-sev-critical/10 px-2 py-1 font-pixel text-[10px] uppercase leading-none text-sev-critical">
          <span className="size-1.5 animate-rack-blink rounded-[1px] bg-sev-critical" aria-hidden />
          Live
        </span>
      </div>
      <ul className="divide-y divide-border">
        {EVENTS.map((event, i) => (
          <li
            key={event.rule}
            className="grid animate-fade-up grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5"
            style={{ animationDelay: `${0.25 + i * 0.12}s` }}
          >
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-foreground">{event.rule}</p>
              <p className="truncate text-[13px] text-muted-foreground">{event.detail}</p>
            </div>
            <SeverityBadge severity={event.severity} />
            <p className="col-span-2 font-mono text-[11.5px] text-muted-foreground">
              <span className="text-foreground/80">{event.server}</span>
              <span className="mx-2 text-border-strong">/</span>
              {event.age}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
