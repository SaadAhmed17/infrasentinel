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

const SERVICES = [
  {
    icon: Server,
    title: 'Live Server Monitoring',
    desc: 'CPU, memory, disk, network, and more, streamed from every registered server in real time.',
  },
  {
    icon: ListChecks,
    title: 'SIEM Rule Engine',
    desc: 'Six rule types detect brute-force logins, unauthorized root access, credential stuffing, API abuse, and more.',
  },
  {
    icon: ShieldCheck,
    title: 'AI Anomaly Detection',
    desc: 'An LSTM-Autoencoder trained per server flags unusual behaviour that static thresholds miss.',
  },
  {
    icon: Bot,
    title: 'AI Incident Assistant',
    desc: 'Ask questions about any incident in plain language and get answers grounded in real, indexed data.',
  },
  {
    icon: Siren,
    title: 'Alert & Incident Management',
    desc: 'Related alerts are automatically grouped into incidents you can triage and resolve.',
  },
  {
    icon: LayoutDashboard,
    title: 'Live Dashboard',
    desc: 'See server health, open incidents, and active rules at a glance, updating in real time.',
  },
];

const STEPS = [
  {
    step: '01',
    title: 'Agents collect data',
    desc: 'A lightweight agent on each server streams metrics and security events to the platform.',
  },
  {
    step: '02',
    title: 'Rules and AI detect threats',
    desc: 'The SIEM engine and LSTM anomaly model evaluate incoming data continuously.',
  },
  {
    step: '03',
    title: 'Dashboard and AI explain it',
    desc: 'Incidents appear on your dashboard, and the assistant explains them in plain language.',
  },
];

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#080b12] text-white">
      <PublicNavbar />

      {/* =========================================================
          HERO
      ========================================================= */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute left-1/2 top-[-240px] h-[650px] w-[950px] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
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

        <div className="relative mx-auto max-w-7xl px-6 pb-24 pt-20 lg:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">

            {/* =====================================================
                LEFT SIDE - HERO CONTENT
            ===================================================== */}
            <div className="text-center lg:text-left">

              <h1 className="max-w-3xl text-[44px] font-bold leading-[1.08] tracking-[-0.035em] text-white sm:text-[54px] lg:text-[60px]">
                Monitor.
                <span className="text-blue-400"> Detect.</span>
                <br />
                Understand.
              </h1>

              {/* AI BADGE BELOW HEADING */}
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/[0.07] px-4 py-2 text-[12px] font-semibold tracking-wide text-slate-300 shadow-[0_0_30px_rgba(59,130,246,0.06)]">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-50" />
                  <span className="relative inline-flex size-2 rounded-full bg-blue-400" />
                </span>

                <ShieldCheck
                  className="size-3.5 text-blue-400"
                  strokeWidth={2.4}
                />

                AI-Augmented Infrastructure Monitoring
              </div>

              <p className="mt-6 max-w-xl text-[16px] leading-7 text-slate-400 sm:text-[17px]">
                InfraSentinel watches your servers, catches security threats
                as they happen, and explains what it finds &mdash; in one
                platform.
              </p>

              {/* BUTTONS */}
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
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
                  href="#services"
                  className="flex min-h-12 items-center justify-center rounded-xl border border-slate-700/80 bg-white/[0.025] px-7 py-3 text-[14px] font-semibold text-slate-200 transition-all duration-300 hover:border-slate-600 hover:bg-white/[0.06]"
                >
                  See what it does
                </Link>
              </div>

              {/* FEATURE POINTS */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 lg:justify-start">
                {[
                  '6 SIEM rule types',
                  'Real-time LSTM anomaly detection',
                  'AI incident assistant',
                ].map((t) => (
                  <div
                    key={t}
                    className="flex items-center gap-2 text-[12px] text-slate-400"
                  >
                    <CheckCircle2
                      className="size-3.5 shrink-0 text-blue-400"
                      strokeWidth={2.5}
                    />
                    {t}
                  </div>
                ))}
              </div>
            </div>

            {/* =====================================================
                RIGHT SIDE - SMALLER HERO IMAGE
            ===================================================== */}
            <div className="relative mx-auto w-full max-w-md lg:max-w-[430px]">

              <div className="absolute -inset-5 rounded-[30px] bg-blue-500/[0.06] blur-3xl" />

              <div className="relative overflow-hidden rounded-3xl border border-slate-700/70 bg-slate-900/70 p-1.5 shadow-[0_25px_80px_rgba(0,0,0,0.45)]">

                <div className="overflow-hidden rounded-[21px]">

                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://images.pexels.com/photos/4508751/pexels-photo-4508751.jpeg?auto=compress&cs=tinysrgb&w=1200"
                    alt="Infrastructure monitoring data center"
                    className="aspect-[4/3] w-full object-cover transition-transform duration-700 hover:scale-[1.025]"
                  />

                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* =========================================================
          SERVICES
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
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-400">
              Platform capabilities
            </div>

            <h2 className="text-[30px] font-bold tracking-tight text-white sm:text-[36px]">
              What InfraSentinel provides
            </h2>

            <p className="mt-4 text-[15px] leading-7 text-slate-400">
              Three capabilities that are usually spread across separate
              tools, combined into one platform.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center">

            <div className="group relative overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/50 p-1 shadow-[0_25px_70px_rgba(0,0,0,0.25)]">
              <div className="overflow-hidden rounded-[13px]">

                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.pexels.com/photos/5480781/pexels-photo-5480781.jpeg?auto=compress&cs=tinysrgb&w=1200"
                  alt="Security monitoring and access control"
                  className="aspect-[4/3] w-full object-cover transition-transform duration-700 group-hover:scale-[1.025]"
                />

              </div>

              <div className="pointer-events-none absolute inset-x-1 bottom-1 h-1/2 rounded-b-[13px] bg-gradient-to-t from-[#080b12]/70 to-transparent" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {SERVICES.slice(0, 4).map((s) => (
                <div
                  key={s.title}
                  className="group rounded-2xl border border-slate-800 bg-[#10151f]/80 p-5 shadow-[0_10px_35px_rgba(0,0,0,0.12)] transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/30 hover:bg-[#121a27] hover:shadow-[0_15px_40px_rgba(0,0,0,0.22)]"
                >
                  <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-blue-400/10 bg-blue-500/[0.09] transition-colors duration-300 group-hover:bg-blue-500/[0.14]">
                    <s.icon
                      className="size-5 text-blue-400"
                      strokeWidth={1.9}
                    />
                  </div>

                  <h3 className="text-[15px] font-bold leading-6 text-white">
                    {s.title}
                  </h3>

                  <p className="mt-2 text-[13px] leading-6 text-slate-400">
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {SERVICES.slice(4).map((s) => (
              <div
                key={s.title}
                className="group rounded-2xl border border-slate-800 bg-[#10151f]/80 p-5 shadow-[0_10px_35px_rgba(0,0,0,0.12)] transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/30 hover:bg-[#121a27] hover:shadow-[0_15px_40px_rgba(0,0,0,0.22)]"
              >
                <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-blue-400/10 bg-blue-500/[0.09]">
                  <s.icon
                    className="size-5 text-blue-400"
                    strokeWidth={1.9}
                  />
                </div>

                <h3 className="text-[15px] font-bold leading-6 text-white">
                  {s.title}
                </h3>

                <p className="mt-2 text-[13px] leading-6 text-slate-400">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================
          HOW IT WORKS
      ========================================================= */}
      <section className="relative overflow-hidden border-t border-slate-800/80 bg-[#080b12] py-24">
        <div
          className="pointer-events-none absolute right-0 top-0 h-[450px] w-[450px] rounded-full opacity-20 blur-3xl"
          style={{
            background:
              'radial-gradient(circle, rgba(59,130,246,0.12), transparent 70%)',
          }}
        />

        <div className="relative mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-1 gap-14 lg:grid-cols-2 lg:items-center">

            <div>
              <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-400">
                Simple architecture
              </div>

              <h2 className="text-[30px] font-bold tracking-tight text-white sm:text-[36px]">
                How it works
              </h2>

              <div className="mt-10 space-y-7">
                {STEPS.map((s, index) => (
                  <div key={s.step} className="group relative flex gap-5">

                    {index !== STEPS.length - 1 && (
                      <div className="absolute left-[19px] top-12 h-[calc(100%+8px)] w-px bg-gradient-to-b from-blue-500/30 to-transparent" />
                    )}

                    <div className="relative flex size-10 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/[0.08] text-[11px] font-bold text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.06)]">
                      {s.step}
                    </div>

                    <div className="pb-1">
                      <h3 className="text-[16px] font-bold text-white">
                        {s.title}
                      </h3>

                      <p className="mt-2 max-w-lg text-[14px] leading-6 text-slate-400">
                        {s.desc}
                      </p>
                    </div>

                  </div>
                ))}
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/50 p-1 shadow-[0_30px_80px_rgba(0,0,0,0.3)]">

              <div className="overflow-hidden rounded-[13px]">

                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.pexels.com/photos/5203849/pexels-photo-5203849.jpeg?auto=compress&cs=tinysrgb&w=1200"
                  alt="Network data flowing through fiber connections"
                  className="aspect-[4/3] w-full object-cover transition-transform duration-700 group-hover:scale-[1.025]"
                />

              </div>

              <div className="pointer-events-none absolute inset-1 rounded-[13px] bg-gradient-to-tr from-blue-950/30 via-transparent to-transparent" />

            </div>

          </div>
        </div>
      </section>

      {/* =========================================================
          CTA
      ========================================================= */}
      <section className="relative border-t border-slate-800/80 bg-[#0b0f17] py-24">
        <div className="mx-auto max-w-5xl px-6">

          <div className="group relative overflow-hidden rounded-3xl border border-slate-700/70 bg-slate-900/50 p-1 shadow-[0_30px_100px_rgba(0,0,0,0.35)]">

            <div className="relative overflow-hidden rounded-[22px]">

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.pexels.com/photos/17489160/pexels-photo-17489160/free-photo-of-box-server-illuminated-on-blue.jpeg?auto=compress&cs=tinysrgb&w=2000"
                alt="AI-powered monitoring analytics"
                className="aspect-[21/9] w-full object-cover transition-transform duration-700 group-hover:scale-[1.015]"
              />

              <div className="absolute inset-0 bg-gradient-to-r from-[#05080e]/95 via-[#08101c]/80 to-[#0b1220]/65" />

              <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">

                <div className="mb-4 rounded-full border border-blue-400/20 bg-blue-500/[0.08] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300">
                  InfraSentinel
                </div>

                <h2 className="max-w-2xl text-[27px] font-bold tracking-tight text-white sm:text-[32px]">
                  Ready to see your infrastructure clearly?
                </h2>

                <p className="mt-3 max-w-md text-[14px] leading-6 text-slate-300">
                  Create an account and register your first server in minutes.
                </p>

                <Link
                  href="/signup"
                  className="group/btn mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-[14px] font-bold text-white shadow-[0_10px_35px_rgba(37,99,235,0.25)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-blue-500 hover:shadow-[0_15px_40px_rgba(37,99,235,0.35)]"
                >
                  Get started

                  <ArrowRight
                    className="size-4 transition-transform duration-300 group-hover/btn:translate-x-1"
                    strokeWidth={2.5}
                  />
                </Link>

              </div>
            </div>
          </div>

        </div>
      </section>

      <PublicFooter />
    </div>
  );
}