import Link from 'next/link';
import { PublicNavbar } from '@/components/public-navbar';
import { PublicFooter } from '@/components/public-footer';
import {
  ShieldCheck,
  Server,
  Bot,
  ListChecks,
  LayoutDashboard,
  Siren,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

export const metadata = {
  title: 'Services — InfraSentinel',
  description:
    'Live server monitoring, SIEM rule engine, AI anomaly detection, incident assistant, alert management, and a real-time dashboard — one platform.',
};

const SERVICES = [
  {
    icon: Server,
    title: 'Live Server Monitoring',
    desc: 'CPU, memory, disk, network, and more, streamed from every registered server in real time.',
    points: [
      'CPU, memory, disk & network metrics',
      'Lightweight agent installed per server',
      'Streams to one central backend over HTTPS',
    ],
  },
  {
    icon: ListChecks,
    title: 'SIEM Rule Engine',
    desc: 'Six rule types detect brute-force logins, unauthorized root access, credential stuffing, API abuse, and more.',
    points: [
      'Brute-force SSH & web login detection',
      'Credential stuffing & API abuse rules',
      'Configurable thresholds & time windows',
    ],
  },
  {
    icon: ShieldCheck,
    title: 'AI Anomaly Detection',
    desc: 'An LSTM-Autoencoder trained per server flags unusual behaviour that static thresholds miss.',
    points: [
      'LSTM-Autoencoder trained per server',
      'Catches gradual drift like memory leaks',
      'Reconstruction-error based scoring',
    ],
  },
  {
    icon: Bot,
    title: 'AI Incident Assistant',
    desc: 'Ask questions about any incident in plain language and get answers grounded in real, indexed data.',
    points: [
      'Retrieval over real, indexed incidents',
      'Plain-language alert explanations',
      'Root-cause context in seconds',
    ],
  },
  {
    icon: Siren,
    title: 'Alert & Incident Management',
    desc: 'Related alerts are automatically grouped into incidents you can triage and resolve.',
    points: [
      'Related alerts auto-grouped into incidents',
      'Full lifecycle: open → resolved → closed',
      'Automated responses: block IPs, restart services',
    ],
  },
  {
    icon: LayoutDashboard,
    title: 'Live Dashboard',
    desc: 'See server health, open incidents, and active rules at a glance, updating in real time.',
    points: [
      'Real-time metrics, alerts & incidents',
      'Per-server health at a glance',
      'Role-based access for Admin & Analyst',
    ],
  },
];

export default function ServicesPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#080b12] text-white">
      <PublicNavbar />

      {/* =========================================================
          PAGE HERO
      ========================================================= */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute left-1/2 top-[-240px] h-[520px] w-[820px] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
          style={{
            background:
              'radial-gradient(circle, rgba(59,130,246,0.26) 0%, rgba(37,99,235,0.10) 38%, transparent 70%)',
          }}
        />

        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(148,163,184,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.6) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-16 text-center lg:pt-20">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/[0.07] px-4 py-2 text-[12px] font-semibold tracking-wide text-slate-300">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-50" />
              <span className="relative inline-flex size-2 rounded-full bg-blue-400" />
            </span>
            Platform capabilities
          </div>

          <h1 className="mx-auto max-w-3xl text-[38px] font-bold leading-[1.1] tracking-[-0.03em] text-white sm:text-[48px]">
            Everything InfraSentinel <span className="text-blue-400">does</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-[16px] leading-7 text-slate-400">
            Six capabilities that are usually spread across separate tools,
            combined into one platform.
          </p>
        </div>
      </section>

      {/* =========================================================
          SERVICES GRID
      ========================================================= */}
      <section
        id="services"
        className="relative border-t border-slate-800/80 bg-[#0b0f17] py-24"
      >
        <div
          className="pointer-events-none absolute left-0 top-20 h-80 w-80 rounded-full opacity-20 blur-3xl"
          style={{
            background:
              'radial-gradient(circle, rgba(59,130,246,0.16), transparent 70%)',
          }}
        />

        <div className="relative mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s) => (
              <div
                key={s.title}
                className="group flex flex-col rounded-2xl border border-slate-800 bg-[#10151f]/80 p-6 shadow-[0_10px_35px_rgba(0,0,0,0.12)] transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/30 hover:bg-[#121a27] hover:shadow-[0_15px_40px_rgba(0,0,0,0.22)]"
              >
                <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-blue-400/10 bg-blue-500/[0.09] transition-colors duration-300 group-hover:bg-blue-500/[0.14]">
                  <s.icon className="size-5 text-blue-400" strokeWidth={1.9} />
                </div>

                <h3 className="text-[16px] font-bold leading-6 text-white">
                  {s.title}
                </h3>

                <p className="mt-2 text-[13px] leading-6 text-slate-400">
                  {s.desc}
                </p>

                <ul className="mt-4 space-y-2 border-t border-slate-800/80 pt-4">
                  {s.points.map((p) => (
                    <li
                      key={p}
                      className="flex items-start gap-2 text-[12.5px] leading-5 text-slate-400"
                    >
                      <CheckCircle2
                        className="mt-0.5 size-3.5 shrink-0 text-blue-400/80"
                        strokeWidth={2.4}
                      />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================
          CTA
      ========================================================= */}
      <section className="relative overflow-hidden border-t border-slate-800/80 bg-[#080b12] py-24">
        <div
          className="pointer-events-none absolute right-0 top-0 h-[420px] w-[420px] rounded-full opacity-20 blur-3xl"
          style={{
            background:
              'radial-gradient(circle, rgba(59,130,246,0.12), transparent 70%)',
          }}
        />

        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <div className="mb-4 inline-flex rounded-full border border-blue-400/20 bg-blue-500/[0.08] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300">
            Get started
          </div>

          <h2 className="text-[28px] font-bold tracking-tight text-white sm:text-[34px]">
            See it running on your own servers.
          </h2>

          <p className="mx-auto mt-3 max-w-md text-[14px] leading-6 text-slate-400">
            Create an account, register a server, and watch the platform come
            alive in minutes.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="group flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 py-3 text-[14px] font-bold text-white shadow-[0_10px_35px_rgba(37,99,235,0.22)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-blue-500 hover:shadow-[0_14px_40px_rgba(37,99,235,0.30)]"
            >
              Get started
              <ArrowRight
                className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                strokeWidth={2.5}
              />
            </Link>

            <Link
              href="/"
              className="flex min-h-12 items-center justify-center rounded-xl border border-slate-700/80 bg-white/[0.025] px-7 py-3 text-[14px] font-semibold text-slate-200 transition-all duration-300 hover:border-slate-600 hover:bg-white/[0.06]"
            >
              Back to home
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}