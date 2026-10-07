import type { Metadata } from 'next';
import { ArrowUpRight, CircleDot, Clock, GitBranch, GraduationCap } from 'lucide-react';
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

const TEAM = [
  { name: 'Farhan', role: 'Frontend and dashboard' },
  { name: 'Saad Ahmed', role: 'Backend and SIEM engine' },
  { name: 'Hashim Ahmed Khan', role: 'AI and anomaly detection' },
];

function initials(name: string) {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function ContactPage() {
  return (
    <PublicShell>
      <section className="mx-auto max-w-7xl px-6 pb-16 pt-10 lg:px-10 lg:pt-16">
        <PublicPageHeader eyebrow="Contact" title="Get in touch">
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
              className="group flex flex-col rounded-xl border border-border bg-card p-6 shadow-panel transition-colors hover:border-primary/40"
            >
              <span className="flex size-10 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary-bright">
                <Icon className="size-5" strokeWidth={1.8} />
              </span>
              <h2 className="mt-5 text-[17px] font-semibold text-foreground">{title}</h2>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{text}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 break-all font-mono text-[13px] font-medium text-primary-bright">
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
      </section>

      <section className="border-t border-border bg-surface/55 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-20">
          <p className="hud-label">People</p>
          <h2 className="mt-4 font-display text-[30px] font-semibold leading-tight tracking-[-0.03em] text-foreground sm:text-[36px]">
            Project team
          </h2>
          <ul className="mt-10 grid gap-5 sm:grid-cols-3">
            {TEAM.map((member) => (
              <li key={member.name} className="flex items-center gap-4 rounded-xl border border-border bg-card p-5">
                <span
                  className="flex size-12 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/12 font-mono text-[15px] font-semibold text-primary-bright"
                  aria-hidden
                >
                  {initials(member.name)}
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-foreground">{member.name}</p>
                  <p className="mt-0.5 text-[13.5px] text-muted-foreground">{member.role}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-8 flex items-center gap-2 text-[13.5px] text-muted-foreground">
            <GraduationCap className="size-4 shrink-0" strokeWidth={1.8} aria-hidden />
            Supervised by Dr. Quratulain Zahid
          </p>
        </div>
      </section>
    </PublicShell>
  );
}
