import type { Metadata } from 'next';
import { GraduationCap } from 'lucide-react';
import { PublicPageHeader, PublicShell } from '@/components/public-shell';
import { Panel } from '@/components/ui/panel';

export const metadata: Metadata = {
  title: 'About',
  description: 'InfraSentinel is an AI-augmented infrastructure monitoring platform built as a Final Year Project.',
};

const WHAT_IT_DOES = [
  'Collects live metrics from every registered server through a lightweight agent',
  'Detects attacks such as brute-force logins, unapproved root access and API abuse',
  'Runs a deep-learning model (LSTM autoencoder) to catch anomalies that fixed rules miss',
  'Groups related alerts into incidents, and lets an AI assistant explain them in plain language',
];

const TEAM = ['Farhan', 'Saad Ahmed', 'Hashim Ahmed Khan'];

export default function AboutPage() {
  return (
    <PublicShell>
      <section className="mx-auto max-w-7xl px-6 pb-20 pt-10 lg:px-10 lg:pt-16">
        <PublicPageHeader title="About InfraSentinel">
          An AI-augmented infrastructure monitoring platform built as a Final Year Project. It brings together
          three things usually kept in separate tools: server performance monitoring, security event detection
          (SIEM), and AI-based anomaly detection, with a plain-language assistant to explain what it finds.
        </PublicPageHeader>

        <div className="mt-14 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Panel label="Scope" title="What it does" brackets>
            <ul className="space-y-3.5">
              {WHAT_IT_DOES.map((item) => (
                <li key={item} className="flex gap-3 text-[15px] leading-relaxed text-muted-foreground">
                  <span className="mt-2.5 h-px w-3 shrink-0 bg-primary-bright" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel label="People" title="Project team">
            <ul className="space-y-2.5">
              {TEAM.map((name) => (
                <li key={name} className="text-[15px] font-medium text-foreground">
                  {name}
                </li>
              ))}
            </ul>
            <p className="mt-6 flex items-center gap-2 border-t border-border pt-5 text-[13.5px] text-muted-foreground">
              <GraduationCap className="size-4 shrink-0" strokeWidth={1.8} aria-hidden />
              Supervised by Dr. Quratulain Zahid
            </p>
          </Panel>
        </div>
      </section>
    </PublicShell>
  );
}
