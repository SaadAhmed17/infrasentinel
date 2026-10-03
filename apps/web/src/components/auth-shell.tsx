import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';

// Shared look of the password-reset screens, matching the login and signup pages.
export const authInputClassName =
  'h-9.5 border-white/10 bg-[oklch(0.16_0.01_265)] pl-8.5 text-white placeholder:text-slate-500 focus-visible:border-[oklch(0.62_0.19_265)] focus-visible:ring-[oklch(0.62_0.19_265)]/30';

export const authButtonClassName =
  'flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[oklch(0.62_0.19_265)] text-sm font-semibold text-white shadow-lg shadow-[oklch(0.62_0.19_265)]/30 transition-all hover:bg-[oklch(0.66_0.19_265)] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50';

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[oklch(0.16_0.01_265)] px-4 py-12">
      <div
        className="pointer-events-none absolute -top-40 left-1/4 h-[30rem] w-[30rem] rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, oklch(0.62 0.19 265) 0%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-40 right-1/4 h-[26rem] w-[26rem] rounded-full opacity-15 blur-3xl"
        style={{ background: 'radial-gradient(circle, oklch(0.68 0.16 195) 0%, transparent 70%)' }}
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div
            className="mb-4 flex size-12 items-center justify-center rounded-2xl shadow-lg shadow-black/30 ring-1 ring-white/10"
            style={{ background: 'oklch(0.62 0.19 265)' }}
          >
            <ShieldCheck className="size-6 text-white" strokeWidth={2.25} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-white">InfraSentinel</h1>
          <p className="mt-1 text-[13px] text-slate-400">AI-Augmented Infrastructure Monitoring</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[oklch(0.21_0.01_265)] p-7 shadow-2xl shadow-black/40">
          <div className="mb-6 space-y-1">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="text-[13px] text-slate-400">{description}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
