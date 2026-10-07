'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Check, Loader2, Lock } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { AuthShell, PasswordRule, authButtonClassName, authLinkClassName } from '@/components/auth-shell';
import { friendlyError } from '@/lib/errors';
import { IconInput, PasswordVisibilityToggle } from '@/components/ui/icon-input';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import { cn } from '@/lib/utils';

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
      setError('Your new password needs at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords don't match.");
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
      setError(friendlyError(err, "Couldn't reset your password. Try again."));
    } finally {
      setLoading(false);
    }
  }

  const requestNewLink = (
    <>
      Link expired?{' '}
      <Link href="/forgot-password" className={authLinkClassName}>
        Request a new one
      </Link>
    </>
  );

  if (!token) {
    return (
      <AuthShell
        title="This reset link is incomplete"
        description="Open the link exactly as it appears in the email, or request a new one."
      >
        <Link href="/forgot-password" className={authButtonClassName}>
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title="Password updated" description="You can now sign in with your new password.">
        <Notice tone="success" className="mb-6">
          Your password has been reset. For your security, you have been signed out on all devices.
        </Notice>
        <Link href="/login" className={authButtonClassName}>
          Sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" description="Enter a new password for your account." footer={requestNewLink}>
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <IconInput
            icon={Lock}
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            required
            minLength={8}
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            trailing={<PasswordVisibilityToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
          />
          <PasswordRule met={passwordValid} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <IconInput
            icon={Lock}
            id="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Repeat the new password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {confirmPassword.length > 0 && (
            <p
              className={cn(
                'flex items-center gap-1.5 text-[12.5px] font-medium',
                passwordsMatch ? 'text-status-online' : 'text-muted-foreground',
              )}
            >
              {passwordsMatch && <Check className="size-3.5" strokeWidth={2.5} />}
              {passwordsMatch ? 'Passwords match' : 'Passwords do not match yet'}
            </p>
          )}
        </div>

        {error && <Notice tone="error">{error}</Notice>}

        <button type="submit" disabled={loading} className={authButtonClassName}>
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving…
            </>
          ) : (
            'Reset password'
          )}
        </button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
