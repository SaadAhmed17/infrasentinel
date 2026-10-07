import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, CircleDot, Clock, GitBranch } from 'lucide-react';
import { PublicPageHeader, PublicShell } from '@/components/public-shell';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Questions about InfraSentinel or this Final Year Project? Reach the team on GitHub.',
};

const REPO_URL = 'https://github.com/SaadAhmed17/infrasentinel';

const CHANNELS = [
  {
    icon: CircleDot,
    title: 'Ask a question or report a bug',
    text: 'Open an issue on GitHub. The team reads every one.',
    href: `${REPO_URL}/issues`,
    linkLabel: 'Open an issue',
  },
  {
    icon: GitBranch,
    title: 'Browse the source code',
    text: 'The web console, API, AI service and agents are all in one repository.',
    href: REPO_URL,
    linkLabel: 'github.com/SaadAhmed17/infrasentinel',
  },
];

export default function ContactPage() {
  return (
    <PublicShell>
      <section className="mx-auto max-w-7xl px-6 pb-16 pt-10 lg:px-10 lg:pt-16">
        <PublicPageHeader title="Get in touch">
          Questions about InfraSentinel, its architecture or this Final Year Project? Reach the team through the
          channels below.
        </PublicPageHeader>

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {CHANNELS.map(({ icon: Icon, title, text, href, linkLabel }) => (
            <a
              key={title}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-panel)] transition-colors hover:border-primary/40"
            >
              <span className="flex size-10 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary-bright">
                <Icon className="size-5" strokeWidth={1.8} />
              </span>
              <h2 className="mt-5 text-[17px] font-semibold text-foreground">{title}</h2>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{text}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 break-all text-[14px] font-semibold text-primary">
                {linkLabel}
                <ArrowUpRight className="size-3.5 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
              </span>
            </a>
          ))}
        </div>

        <p className="mt-5 flex items-center gap-2.5 rounded-xl border border-border bg-surface/60 px-5 py-4 text-[13.5px] text-muted-foreground">
          <Clock className="size-4 shrink-0" strokeWidth={1.8} aria-hidden />
          This is a student project, so replies may be slower during exam periods.
        </p>
        <p className="mt-8 text-[14.5px] text-muted-foreground">
          The project team and supervisor are listed on the{' '}
          <Link href="/about#team" className="font-semibold text-primary underline-offset-4 hover:underline">
            About page
          </Link>
          .
        </p>
      </section>

    </PublicShell>
  );
}
