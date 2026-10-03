'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { AuthShell, authButtonClassName, authInputClassName } from '@/components/auth-shell';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Eye, EyeOff, Loader2, AlertCircle, Check, CircleCheck, KeyRound } from 'lucide-react';

function ResetPasswordForm() {
  const token = useSearchParams().get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const passwordValid = password.length >= 8;
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!passwordValid) {
      setError('Your new password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/auth/reset-password', { token, password });
      // Sessions from before the reset no longer work, so drop any saved on this device.
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset your password');
    } finally {
      setLoading(false);
    }
  }

  const requestNewLink = (
    <p className="mt-6 text-center text-sm text-slate-400">
      Link expired?{' '}
      <Link href="/forgot-password" className="font-medium text-white underline-offset-4 hover:underline">
        Request a new one
      </Link>
    </p>
  );

  if (!token) {
    return (
      <AuthShell title="Invalid reset link" description="This link is missing its reset code.">
        <div className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-[13px] text-red-300">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
          <span>Open the link exactly as it appears in the email, or request a new one.</span>
        </div>
        {requestNewLink}
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title="Password updated" description="You can now sign in with your new password.">
        <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-3 text-[13px] text-emerald-200">
          <CircleCheck className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          <p>Your password has been reset. For your security, you have been signed out on all devices.</p>
        </div>
        <Link href="/login" className={authButtonClassName}>
          Sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" description="Enter a new password for your account.">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-slate-300">New password</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" strokeWidth={1.75} />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              required
              minLength={8}
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${authInputClassName} pr-8.5`}
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
          {password.length > 0 && (
            <p className={`flex items-center gap-1.5 text-xs ${passwordValid ? 'text-emerald-400' : 'text-slate-500'}`}>
              {passwordValid && <Check className="size-3" strokeWidth={2.5} />}
              At least 8 characters
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className="text-slate-300">Confirm new password</Label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" strokeWidth={1.75} />
            <Input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Repeat the new password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={authInputClassName}
            />
          </div>
          {confirmPassword.length > 0 && (
            <p className={`flex items-center gap-1.5 text-xs ${passwordsMatch ? 'text-emerald-400' : 'text-slate-500'}`}>
              {passwordsMatch && <Check className="size-3" strokeWidth={2.5} />}
              {passwordsMatch ? 'Passwords match' : 'Passwords do not match yet'}
            </p>
          )}
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
              Saving...
            </>
          ) : (
            'Reset password'
          )}
        </button>
      </form>
      {requestNewLink}
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[oklch(0.16_0.01_265)]" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
