import { CornerBrackets } from '@/components/ui/panel';
import { SeverityBadge } from '@/components/ui/status';

// Illustration for the landing page: what the console shows when the rule
// engine catches something. Example data, labelled as such.
const EVENTS = [
  { rule: 'SSH brute force', detail: '7 failed logins from 203.0.113.50', server: 'edge-gateway', severity: 'CRITICAL', age: 'just now' },
  { rule: 'Unapproved sudo', detail: 'mallory ran /usr/bin/cat /etc/shadow', server: 'prod-db-01', severity: 'HIGH', age: '12 s ago' },
  { rule: 'LSTM anomaly', detail: 'Reconstruction error 4.7× its threshold', server: 'prod-web-01', severity: 'HIGH', age: '41 s ago' },
  { rule: 'Disk almost full', detail: 'Disk usage 93.8% for 30 s', server: 'prod-db-01', severity: 'MEDIUM', age: '2 min ago' },
  { rule: 'Service crash', detail: 'No report for 64 s', server: 'staging-api', severity: 'CRITICAL', age: '5 min ago' },
];

export function DetectionFeed() {
  return (
    <figure className="relative rounded-2xl border border-border-strong bg-card shadow-[var(--shadow-panel)]">
      <CornerBrackets />
      <figcaption className="border-b border-border px-5 py-3.5">
        <p className="text-[14px] font-semibold text-foreground">Example detections</p>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">What the console shows when a rule fires</p>
      </figcaption>
      <ul className="divide-y divide-border">
        {EVENTS.map((event, i) => (
          <li
            key={event.rule}
            className="flex animate-fade-up items-start gap-3 px-5 py-3.5 sm:gap-4"
            style={{ animationDelay: `${0.2 + i * 0.08}s` }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-foreground">{event.rule}</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">{event.detail}</p>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                <span className="font-mono text-[12px] text-foreground/80">{event.server}</span> · {event.age}
              </p>
            </div>
            <SeverityBadge severity={event.severity} compact className="mt-0.5 sm:hidden" />
            <SeverityBadge severity={event.severity} className="hidden shrink-0 sm:inline-flex" />
          </li>
        ))}
      </ul>
    </figure>
  );
}
