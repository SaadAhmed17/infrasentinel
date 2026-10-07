import type { Metadata } from 'next';
import { PublicPageHeader, PublicShell } from '@/components/public-shell';
import { initialsFromEmail } from '@/lib/format';
import { SUPERVISOR, TEAM } from '@/lib/team';

export const metadata: Metadata = {
  title: 'About',
  description: 'InfraSentinel is an AI-augmented infrastructure monitoring platform built as a Final Year Project at Air University Islamabad.',
};

const WHAT_IT_DOES = [
  'Collects live metrics from every registered server through a lightweight agent',
  'Detects attacks such as brute-force logins, unapproved root access and API abuse',
  'Runs a deep-learning model (LSTM autoencoder) to catch anomalies that fixed rules miss',
  'Groups related alerts into incidents, and lets an AI assistant explain them in plain language',
];

const PARTS = [
  { name: 'Web console', text: 'Next.js' },
  { name: 'API and SIEM engine', text: 'NestJS, PostgreSQL' },
  { name: 'AI service', text: 'FastAPI, LSTM, RAG' },
  { name: 'Agents', text: 'Python, on each server' },
];

const initials = (name: string) => initialsFromEmail(name.toLowerCase().replace(/\s+/g, '.'));

export default function AboutPage() {
  return (
    <PublicShell>
      <section className="mx-auto max-w-[1200px] px-6 pb-16 pt-10 lg:px-10 lg:pt-16">
        <PublicPageHeader title="About InfraSentinel">
          An AI-augmented infrastructure monitoring platform built as a Final Year Project at Air University Islamabad. It
          brings together three things usually kept in separate tools: server performance monitoring, security event
          detection (SIEM), and AI-based anomaly detection, with a plain-language assistant to explain what it finds.
        </PublicPageHeader>

        <div className="mt-14 grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-[24px] font-semibold tracking-[-0.02em] text-foreground">What it does</h2>
            <ul className="mt-5 space-y-3.5">
              {WHAT_IT_DOES.map((item) => (
                <li key={item} className="flex gap-3 text-[15px] leading-relaxed text-muted-foreground">
                  <span className="mt-3 h-px w-3 shrink-0 bg-primary-bright" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-display text-[24px] font-semibold tracking-[-0.02em] text-foreground">How it is built</h2>
            <dl className="mt-5 divide-y divide-border border-y border-border">
              {PARTS.map((part) => (
                <div key={part.name} className="flex items-baseline justify-between gap-4 py-3">
                  <dt className="text-[15px] font-medium text-foreground">{part.name}</dt>
                  <dd className="text-right text-[14px] text-muted-foreground">{part.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section id="team" className="scroll-mt-8 border-t border-border bg-surface">
        <div className="mx-auto max-w-[1200px] px-6 py-16 lg:px-10 lg:py-20">
          <h2 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] text-foreground sm:text-[34px]">
            The team
          </h2>
          <p className="mt-3 text-[15px] text-muted-foreground">Supervised by {SUPERVISOR}.</p>
          <ul className="mt-10 divide-y divide-border border-y border-border">
            {TEAM.map((member) => (
              <li key={member.name} className="grid gap-4 py-7 md:grid-cols-[17rem_minmax(0,1fr)] md:gap-10">
                <div className="flex items-start gap-3.5">
                  <span
                    aria-hidden
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[14px] font-semibold text-primary-bright"
                  >
                    {initials(member.name)}
                  </span>
                  <div>
                    <p className="text-[16px] font-semibold text-foreground">{member.name}</p>
                    <p className="mt-0.5 text-[14px] text-muted-foreground">{member.role}</p>
                  </div>
                </div>
                <p className="max-w-[68ch] text-[15px] leading-relaxed text-muted-foreground">{member.work}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </PublicShell>
  );
}
