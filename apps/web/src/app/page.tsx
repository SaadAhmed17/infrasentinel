'use client';

import Link from 'next/link';
import { Activity, ArrowRight, BrainCircuit, Bot, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { RackSkyline } from '@/components/auth/rack-skyline';
import { DetectionFeed } from '@/components/landing/detection-feed';
import { PublicShell } from '@/components/public-shell';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const CAPABILITIES = [
  {
    icon: Activity,
    title: 'Server health',
    text: 'A small agent sends CPU, memory, disk and network figures every 10 seconds. Servers that stop reporting are marked offline.',
  },
  {
    icon: ShieldAlert,
    title: 'Detection rules',
    text: 'SSH and web login brute force, credential stuffing, sudo by unapproved users, API floods, crashes and threshold breaches.',
  },
  {
    icon: BrainCircuit,
    title: 'Anomaly detection',
    text: 'An LSTM autoencoder learns what normal looks like for each server and flags behaviour no fixed threshold would catch.',
  },
  {
    icon: Bot,
    title: 'AI assistant',
    text: 'Ask what happened in plain language. Answers come from your own incident history, with the incidents they are based on.',
  },
];

const STEPS = [
  { title: 'Add a server', text: 'Register it in the console and start the agent with its one-time key.' },
  { title: 'Rules run every 30 s', text: 'Metrics and security events are checked against your active rules.' },
  { title: 'Alerts become incidents', text: 'Related alerts on the same server or attacker are grouped into one incident.' },
  { title: 'Investigate and resolve', text: 'Review the evidence, ask the assistant, and mark the incident resolved.' },
];

const FACTS = [
  { value: '10 s', label: 'between agent reports' },
  { value: '30 s', label: 'between rule evaluations' },
  { value: '6', label: 'roles, from Owner to Viewer' },
  { value: '500+', label: 'automated tests on every change' },
];

export default function Home() {
  const { user } = useAuth();
  const primaryCta = user
    ? { href: '/dashboard', label: 'Open dashboard' }
    : { href: '/signup', label: 'Create organization' };

  return (
    <PublicShell>
      {/* Hero */}
      <section className="mx-auto grid max-w-7xl items-center gap-14 px-6 pb-20 pt-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:px-10 lg:pb-28 lg:pt-16">
        <div className="animate-fade-up">
          <p className="hud-label">Infrastructure security monitoring</p>
          <h1 className="mt-6 font-display text-[44px] font-semibold leading-[1.02] tracking-[-0.04em] text-foreground sm:text-[56px] xl:text-[68px]">
            Your servers, <span className="text-primary-bright">under watch.</span>
          </h1>
          <p className="mt-7 max-w-xl text-[17px] leading-relaxed text-muted-foreground">
            InfraSentinel collects live metrics and security events from your servers, checks them against
            detection rules every 30 seconds, and uses an LSTM model to spot what the rules miss.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link href={primaryCta.href} className={buttonVariants({ size: 'lg' })}>
              {primaryCta.label}
              <ArrowRight className="size-4" />
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

      {/* Capabilities */}
      <section id="capabilities" className="scroll-mt-8 border-y border-border bg-surface/55 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-24">
          <p className="hud-label">What it watches</p>
          <h2 className="mt-4 max-w-2xl font-display text-[30px] font-semibold leading-tight tracking-[-0.03em] text-foreground sm:text-[36px]">
            One console for health, threats and the unknown.
          </h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {CAPABILITIES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="bg-card p-6">
                <span className="flex size-10 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary-bright">
                  <Icon className="size-5" strokeWidth={1.8} />
                </span>
                <h3 className="mt-5 text-[16px] font-semibold text-foreground">{title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
          <Link href="/services" className={cn(buttonVariants({ variant: 'outline' }), 'mt-8')}>
            See everything it does
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-8 mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-24">
        <p className="hud-label">How it works</p>
        <h2 className="mt-4 max-w-2xl font-display text-[30px] font-semibold leading-tight tracking-[-0.03em] text-foreground sm:text-[36px]">
          From agent to answer in four steps.
        </h2>
        <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative border-t border-border-strong pt-6">
              <span className="absolute -top-px left-0 h-px w-12 bg-primary-bright" aria-hidden />
              <p className="font-mono text-[12px] font-semibold text-primary-bright">Step {i + 1}</p>
              <h3 className="mt-3 text-[16px] font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>

        <dl className="mt-20 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border lg:grid-cols-4">
          {FACTS.map((fact) => (
            <div key={fact.label} className="bg-card px-6 py-7">
              <dt className="sr-only">{fact.label}</dt>
              <dd>
                <span className="block font-display text-[34px] font-semibold leading-none tracking-[-0.03em] text-foreground">
                  {fact.value}
                </span>
                <span className="mt-3 block text-[13.5px] text-muted-foreground">{fact.label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Closing call to action */}
      <section className="relative overflow-hidden border-t border-border">
        <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-start gap-8 px-6 pt-20 lg:flex-row lg:items-end lg:justify-between lg:px-10">
          <div>
            <h2 className="max-w-xl font-display text-[30px] font-semibold leading-tight tracking-[-0.03em] text-foreground sm:text-[38px]">
              Start watching your fleet today.
            </h2>
            <p className="mt-4 max-w-md text-[15.5px] text-muted-foreground">
              Create an organization, add your first server and invite your team when you are ready.
            </p>
          </div>
          <Link href={primaryCta.href} className={buttonVariants({ size: 'lg' })}>
            {primaryCta.label}
            <ArrowRight className="size-4" />
          </Link>
        </div>
        <RackSkyline variant="wide" className="mt-12 h-56 w-full sm:h-72 xl:h-80" />
      </section>
    </PublicShell>
  );
}
