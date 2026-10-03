'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { AuthShell, authButtonClassName, authInputClassName } from '@/components/auth-shell';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, MailCheck, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';

// Must match PASSWORD_RESET_TOKEN_MINUTES in the API.
const RESET_LINK_MINUTES = 30;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the reset link');
    } finally {
      setLoading(false);
    }
  }

  const backToSignIn = (
    <p className="mt-6 text-center text-sm text-slate-400">
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 font-medium text-white underline-offset-4 hover:underline"
      >
        <ArrowLeft className="size-3.5" strokeWidth={2} />
        Back to sign in
      </Link>
    </p>
  );

  if (sent) {
    return (
      <AuthShell title="Check your email" description="Follow the link in the email to choose a new password.">
        <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-3 text-[13px] text-emerald-200">
          <MailCheck className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          <p>
            If an account exists for <span className="font-medium text-white">{email.trim()}</span>, a
            password reset link is on its way. The link expires in {RESET_LINK_MINUTES} minutes and can
            be used once.
          </p>
        </div>
        <p className="mt-4 text-[13px] text-slate-400">
          Didn&apos;t get it? Check your spam folder, or{' '}
          <button
            type="button"
            onClick={() => setSent(false)}
            className="font-medium text-white underline-offset-4 hover:underline"
          >
            try again
          </button>
          .
        </p>
        {backToSignIn}
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Forgot your password?"
      description="Enter your account email and we'll send you a link to choose a new one."
    >
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
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={authInputClassName}
            />
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-[13px] text-red-300">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" disabled={loading} className={authButtonClassName}>
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Sending link...
            </>
          ) : (
            'Send reset link'
          )}
        </button>
      </form>
      {backToSignIn}
    </AuthShell>
  );
}
