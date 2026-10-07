import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
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
    text: 'An LSTM autoencoder trained per server flags unusual behaviour that fixed thresholds miss.',
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
      <section className="mx-auto max-w-7xl px-6 pb-16 pt-10 lg:px-10 lg:pt-16">
        <PublicPageHeader
          title={
            <>
              Everything InfraSentinel <span className="text-primary-bright">does.</span>
            </>
          }
        >
          Six capabilities that usually live in separate tools, in one console.
        </PublicPageHeader>
      </section>

      <section className="border-y border-border bg-surface/55 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-20">
          <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map(({ id, icon: Icon, title, text, points }) => (
              <article key={title} id={id} className="flex scroll-mt-8 flex-col bg-card p-6 sm:p-7">
                <span className="flex size-10 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary-bright">
                  <Icon className="size-5" strokeWidth={1.8} />
                </span>
                <h2 className="mt-5 text-[17px] font-semibold text-foreground">{title}</h2>
                <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{text}</p>
                <ul className="mt-5 space-y-2.5 border-t border-border pt-5">
                  {points.map((point) => (
                    <li key={point} className="flex items-start gap-2.5 text-[13.5px] leading-snug text-muted-foreground">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-primary-bright" strokeWidth={2.4} aria-hidden />
                      {point}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto flex max-w-7xl flex-col items-start gap-8 px-6 py-20 lg:flex-row lg:items-end lg:justify-between lg:px-10">
        <div>
          <h2 className="max-w-xl font-display text-[30px] font-semibold leading-tight tracking-[-0.03em] text-foreground sm:text-[36px]">
            See it running on your own servers.
          </h2>
          <p className="mt-4 max-w-md text-[15.5px] text-muted-foreground">
            Create an organization, register a server and watch its metrics arrive within seconds.
          </p>
        </div>
        <Link href="/signup" className={buttonVariants({ size: 'lg' })}>
          Create organization
          <ArrowRight className="size-4" />
        </Link>
      </section>
    </PublicShell>
  );
}
