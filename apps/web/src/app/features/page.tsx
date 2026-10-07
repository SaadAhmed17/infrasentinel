import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Activity,
  Bot,
  BrainCircuit,
  Check,
  LayoutDashboard,
  ShieldAlert,
  Siren,
} from 'lucide-react';
import { PublicPageHeader, PublicShell } from '@/components/public-shell';
import { buttonVariants } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Features',
  description:
    'Live server monitoring, a SIEM rule engine, AI anomaly detection, an incident assistant, incident management and a live dashboard in one platform.',
};

const SERVICES = [
  {
    icon: Activity,
    id: 'monitoring',
    title: 'Live server monitoring',
    text: 'CPU, memory, disk, network and more, sent from every registered server every 10 seconds.',
    points: [
      'A lightweight agent on each server',
      'One-time agent key per server, replaceable at any time',
      'Servers that stop reporting are marked offline',
    ],
  },
  {
    icon: ShieldAlert,
    id: 'rules',
    title: 'SIEM rule engine',
    text: 'Six rule types catch brute-force logins, credential stuffing, unapproved root access, API floods and more.',
    points: [
      'SSH and web login brute-force detection',
      'Sudo by unapproved users or outside business hours',
      'Your own thresholds and time windows',
    ],
  },
  {
    icon: BrainCircuit,
    id: 'anomaly',
    title: 'AI anomaly detection',
    text: 'An LSTM autoencoder trained per server flags unusual behavior that fixed thresholds miss.',
    points: [
      'A model trained on each server’s own history',
      'Catches gradual drift such as memory leaks',
      'Scores based on reconstruction error',
    ],
  },
  {
    icon: Bot,
    id: 'assistant',
    title: 'AI incident assistant',
    text: 'Ask about any incident in plain language and get answers grounded in your own incident history.',
    points: [
      'New incidents are indexed automatically',
      'Every answer lists the incidents it used',
      'Only your organization’s data is searched',
    ],
  },
  {
    icon: Siren,
    id: 'incidents',
    title: 'Incident management',
    text: 'Related alerts on the same server or from the same attacker are grouped into one incident.',
    points: [
      'Statuses: open, investigating, resolved',
      'Resolving an incident closes its alerts',
      'The full alert evidence stays with the incident',
    ],
  },
  {
    icon: LayoutDashboard,
    id: 'dashboard',
    title: 'Live dashboard',
    text: 'Server health, open incidents and recent alerts at a glance, refreshed automatically.',
    points: [
      'Fleet health and open incidents together',
      'Per-server metric charts',
      'Six roles, from Owner to Viewer',
    ],
  },
];

export default function FeaturesPage() {
  return (
    <PublicShell>
      <section className="mx-auto max-w-7xl px-6 pb-14 pt-10 lg:px-10 lg:pt-16">
        <PublicPageHeader title="Everything InfraSentinel does">
          Six capabilities that usually live in separate tools, in one console.
        </PublicPageHeader>
      </section>

      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-7xl divide-y divide-border px-6 lg:px-10">
          {SERVICES.map(({ id, icon: Icon, title, text, points }) => (
            <article key={title} id={id} className="grid scroll-mt-8 gap-5 py-10 md:grid-cols-2 md:gap-12 lg:py-12">
              <div>
                <h2 className="flex items-center gap-3 text-[19px] font-semibold text-foreground">
                  <Icon className="size-5 text-primary-bright" strokeWidth={1.75} aria-hidden />
                  {title}
                </h2>
                <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">{text}</p>
              </div>
              <ul className="space-y-3 md:pt-1">
                {points.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-[14.5px] leading-snug text-foreground/85">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary-bright" strokeWidth={2.2} aria-hidden />
                    {point}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto flex max-w-7xl flex-col items-start gap-8 px-6 py-20 lg:flex-row lg:items-end lg:justify-between lg:px-10">
        <div>
          <h2 className="max-w-xl font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] text-foreground sm:text-[36px]">
            See it running on your own servers.
          </h2>
          <p className="mt-4 max-w-md text-[15.5px] text-muted-foreground">
            Create an organization, register a server and watch its metrics arrive within seconds.
          </p>
        </div>
        <Link href="/signup" className={buttonVariants({ size: 'lg' })}>
          Create organization
        </Link>
      </section>
    </PublicShell>
  );
}
