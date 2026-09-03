'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
} from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[oklch(0.16_0.01_265)] px-4 py-12">
      {/* Ambient glow — kept subtle behind a solid card, not blurring content */}
      <div
        className="pointer-events-none absolute -top-40 left-1/4 h-[30rem] w-[30rem] rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, oklch(0.62 0.19 265) 0%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-40 right-1/4 h-[26rem] w-[26rem] rounded-full opacity-15 blur-3xl"
        style={{ background: 'radial-gradient(circle, oklch(0.68 0.16 195) 0%, transparent 70%)' }}
      />

      <div className="relative w-full max-w-sm">
        {/* Brand header */}
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

        {/* Card — solid, not blurred */}
        <div className="rounded-2xl border border-white/10 bg-[oklch(0.21_0.01_265)] p-7 shadow-2xl shadow-black/40">
          <div className="mb-6 space-y-1">
            <h2 className="text-lg font-semibold text-white">Sign in</h2>
            <p className="text-[13px] text-slate-400">Access your organization&apos;s dashboard.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-slate-300">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" strokeWidth={1.75} />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-9.5 border-white/10 bg-[oklch(0.16_0.01_265)] pl-8.5 text-white placeholder:text-slate-500 focus-visible:border-[oklch(0.62_0.19_265)] focus-visible:ring-[oklch(0.62_0.19_265)]/30"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-slate-300">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" strokeWidth={1.75} />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-9.5 border-white/10 bg-[oklch(0.16_0.01_265)] px-8.5 text-white placeholder:text-slate-500 focus-visible:border-[oklch(0.62_0.19_265)] focus-visible:ring-[oklch(0.62_0.19_265)]/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-300"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="size-4" strokeWidth={1.75} /> : <Eye className="size-4" strokeWidth={1.75} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-[13px] text-red-300">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[oklch(0.62_0.19_265)] text-sm font-semibold text-white shadow-lg shadow-[oklch(0.62_0.19_265)]/30 transition-all hover:bg-[oklch(0.66_0.19_265)] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            No account?{' '}
            <Link href="/signup" className="font-medium text-white underline-offset-4 hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}