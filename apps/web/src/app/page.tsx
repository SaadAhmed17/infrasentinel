'use client';

import Link from 'next/link';
import { Activity, BrainCircuit, Bot, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { RackSkyline } from '@/components/auth/rack-skyline';
import { DetectionFeed } from '@/components/landing/detection-feed';
import { PublicShell } from '@/components/public-shell';
import { buttonVariants } from '@/components/ui/button';

const CAPABILITIES = [
  {
    icon: Activity,
    title: 'Server health',
    text: 'A small agent sends CPU, memory, disk and network figures every 10 seconds. Servers that stop reporting are marked offline.',
    href: '/features#monitoring',
    link: 'More about server health',
  },
  {
    icon: ShieldAlert,
    title: 'Detection rules',
    text: 'SSH and web login brute force, credential stuffing, sudo by unapproved users, API floods, crashes and threshold breaches.',
    href: '/features#rules',
    link: 'More about detection rules',
  },
  {
    icon: BrainCircuit,
    title: 'Anomaly detection',
    text: 'An LSTM autoencoder learns what normal looks like for each server and flags behavior no fixed threshold would catch.',
    href: '/features#anomaly',
    link: 'More about anomaly detection',
  },
  {
    icon: Bot,
    title: 'AI assistant',
    text: 'Ask what happened in plain language. Answers come from your own incident history, with the incidents they are based on.',
    href: '/features#assistant',
    link: 'More about the assistant',
  },
];

const STEPS = [
  { title: 'Add a server', text: 'Register it in the console and start the agent with its one-time key.' },
  { title: 'Rules run every 30 s', text: 'Metrics and security events are checked against your active rules.' },
  { title: 'Alerts become incidents', text: 'Related alerts on the same server or attacker are grouped into one incident.' },
  { title: 'Investigate and resolve', text: 'Review the evidence, ask the assistant, and mark the incident resolved.' },
];

const SPECS = [
  { label: 'Agent reports', value: 'Every 10 seconds' },
  { label: 'Rule evaluation', value: 'Every 30 seconds' },
  { label: 'Rule types', value: '6: metric threshold, event frequency, heartbeat missing, credential stuffing, anomaly, unusual access' },
  { label: 'Anomaly model', value: 'LSTM autoencoder, one per server' },
  { label: 'Roles', value: '6, from Owner to Viewer' },
  { label: 'Automated tests', value: '500+ across the API, AI service and agents' },
];

const sectionTitle = 'font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] text-foreground sm:text-[36px]';

export default function Home() {
  const { user } = useAuth();
  const primaryCta = user ? { href: '/dashboard', label: 'Open dashboard' } : { href: '/signup', label: 'Create organization' };

  return (
    <PublicShell>
      {/* hero */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 pb-20 pt-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14 lg:px-10 lg:pb-28 lg:pt-16">
        <div className="animate-fade-up">
          <h1 className="font-display text-[40px] font-semibold leading-[1.04] tracking-[-0.04em] text-foreground sm:text-[56px] xl:text-[64px]">
            Your servers, under watch.
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-muted-foreground sm:mt-7">
            InfraSentinel collects live metrics and security events from your servers, checks them against detection rules
            every 30 seconds, and uses an LSTM model to spot what the rules miss.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Link href={primaryCta.href} className={buttonVariants({ size: 'lg' })}>
              {primaryCta.label}
            </Link>
            {!user && (
              <Link href="/login" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
                Sign in
              </Link>
            )}
          </div>
        </div>
        <div className="animate-fade-up [animation-delay:120ms]">
          <DetectionFeed />
        </div>
      </section>

      {/* capabilities */}
      <section id="capabilities" className="scroll-mt-8 border-y border-border bg-surface">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-24">
          <h2 className={`${sectionTitle} max-w-2xl`}>One console for health, threats and the unknown.</h2>
          <ul className="mt-12 grid divide-y divide-border sm:grid-cols-2 sm:gap-x-10 sm:gap-y-12 sm:divide-y-0 lg:grid-cols-4">
            {CAPABILITIES.map(({ icon: Icon, title, text, href, link }) => (
              <li key={title} className="flex flex-col py-6 first:pt-0 last:pb-0 sm:py-0">
                <h3 className="flex items-center gap-2.5 text-[16px] font-semibold text-foreground">
                  <Icon className="size-5 text-primary-bright" strokeWidth={1.75} aria-hidden />
                  {title}
                </h3>
                <p className="mt-2.5 flex-1 text-[14.5px] leading-relaxed text-muted-foreground">{text}</p>
                <Link href={href} className="mt-3 text-[14px] font-semibold text-primary underline-offset-4 hover:underline">
                  {link}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/features" className="mt-12 inline-block text-[14.5px] font-semibold text-primary underline-offset-4 hover:underline">
            All features
          </Link>
        </div>
      </section>

      {/* how it works */}
      <section id="how-it-works" className="scroll-mt-8 mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-24">
        <h2 className={`${sectionTitle} max-w-2xl`}>From agent to answer in four steps.</h2>
        <ol className="relative mt-12 grid gap-8 lg:grid-cols-4 lg:gap-10">
          {/* the timeline: down the side on phones, along the top on desktop */}
          <span aria-hidden className="absolute bottom-2 left-[5px] top-2 w-px bg-border-strong lg:inset-x-0 lg:bottom-auto lg:left-0 lg:top-[5px] lg:h-px lg:w-auto" />
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative pl-8 lg:pl-0 lg:pt-8">
              <span aria-hidden className="absolute left-0 top-1 size-[11px] rounded-full border-2 border-primary-bright bg-background lg:top-0" />
              <p className="text-[13px] font-semibold text-primary-bright">Step {i + 1}</p>
              <h3 className="mt-1.5 text-[16px] font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* at a glance */}
      <section className="mx-auto max-w-7xl px-6 pb-20 lg:px-10 lg:pb-24">
        <h2 className={sectionTitle}>At a glance</h2>
        <dl className="mt-8 divide-y divide-border border-y border-border">
          {SPECS.map((spec) => (
            <div key={spec.label} className="grid gap-1 py-4 sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-6">
              <dt className="text-[14px] text-muted-foreground">{spec.label}</dt>
              <dd className="text-[15px] text-foreground">{spec.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* closing call to action */}
      <section className="relative overflow-hidden border-t border-border">
        <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-start gap-8 px-6 pt-20 lg:flex-row lg:items-end lg:justify-between lg:px-10">
          <div>
            <h2 className={`${sectionTitle} max-w-xl`}>Start watching your fleet today.</h2>
            <p className="mt-4 max-w-md text-[15.5px] text-muted-foreground">
              Create an organization, add your first server and invite your team when you are ready.
            </p>
          </div>
          <Link href={primaryCta.href} className={buttonVariants({ size: 'lg' })}>
            {primaryCta.label}
          </Link>
        </div>
        {/* the narrow scene on phones, so the sun stays whole */}
        <RackSkyline className="mt-12 h-48 w-full sm:hidden" />
        <RackSkyline variant="wide" className="mt-12 hidden h-72 w-full sm:block xl:h-80" />
      </section>
    </PublicShell>
  );
}
