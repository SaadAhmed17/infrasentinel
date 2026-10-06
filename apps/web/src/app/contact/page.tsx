import { PublicNavbar } from '@/components/public-navbar';
import { PublicFooter } from '@/components/public-footer';
import { Mail, ExternalLink, Clock, GraduationCap } from 'lucide-react';

const TEAM = [
  { name: 'Farhan', role: 'Frontend & Dashboard' },
  { name: 'Saad Ahmed', role: 'Backend & SIEM Engine' },
  { name: 'Hashim Ahmed Khan', role: 'AI & Anomaly Detection' },
];

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />

      {/* Header */}
      <section className="mx-auto max-w-4xl px-6 pb-4 pt-20 text-center">
        <div className="mx-auto mb-5 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[12.5px] font-semibold text-muted-foreground">
          <Mail className="size-3.5" style={{ color: 'oklch(0.55 0.19 265)' }} strokeWidth={2.5} />
          Get in Touch
        </div>
        <h1 className="text-[38px] font-bold tracking-tight text-foreground">
          Contact Us
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-[16px] text-muted-foreground">
          Questions about InfraSentinel, its architecture, or this Final Year
          Project? Reach out through any of the channels below.
        </p>
      </section>

      {/* Contact methods */}
      <section className="mx-auto max-w-4xl px-6 py-14">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div
              className="mb-4 flex size-11 items-center justify-center rounded-lg"
              style={{ background: 'oklch(0.62 0.19 265 / 0.12)' }}
            >
              <Mail className="size-5" style={{ color: 'oklch(0.55 0.19 265)' }} strokeWidth={2} />
            </div>
            <h3 className="text-[16px] font-bold text-foreground">Email</h3>
            <p className="mt-1 text-[14px] text-muted-foreground">
              For general questions about the project.
            </p>
            <a
              href="mailto:your-email@example.com"
              className="mt-3 inline-block text-[14px] font-semibold"
              style={{ color: 'oklch(0.55 0.19 265)' }}
            >
              your-email@example.com
            </a>
          </div>

          <a
            href="https://github.com/SaadAhmed17/infrasentinel"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <div
              className="mb-4 flex size-11 items-center justify-center rounded-lg"
              style={{ background: 'oklch(0.62 0.19 265 / 0.12)' }}
            >
              <ExternalLink className="size-5" style={{ color: 'oklch(0.55 0.19 265)' }} strokeWidth={2} />
            </div>
            <h3 className="text-[16px] font-bold text-foreground">GitHub Repository</h3>
            <p className="mt-1 text-[14px] text-muted-foreground">
              Browse the source code, or open an issue.
            </p>
            <span className="mt-3 inline-block text-[14px] font-semibold" style={{ color: 'oklch(0.55 0.19 265)' }}>
              github.com/SaadAhmed17/infrasentinel
            </span>
          </a>
        </div>

        <div className="mt-5 flex items-center gap-2.5 rounded-xl border border-border bg-card/50 px-5 py-4">
          <Clock className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
          <p className="text-[13.5px] text-muted-foreground">
            This is a student project, so response times may vary during exam periods.
          </p>
        </div>
      </section>

      {/* Team */}
      <section className="border-t border-border bg-card/50 py-16">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center text-[24px] font-bold tracking-tight text-foreground">
            Project Team
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {TEAM.map((m) => (
              <div
                key={m.name}
                className="rounded-xl border border-border bg-card p-5 text-center shadow-sm"
              >
                <div
                  className="mx-auto flex size-14 items-center justify-center rounded-full text-[16px] font-bold text-white"
                  style={{ background: 'oklch(0.62 0.19 265)' }}
                >
                  {initials(m.name)}
                </div>
                <h3 className="mt-3 text-[15px] font-bold text-foreground">{m.name}</h3>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{m.role}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-[13.5px] text-muted-foreground">
            <GraduationCap className="size-4" strokeWidth={2} />
            Supervised by Dr. Quratulain Zahid
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}