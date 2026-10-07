'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2, Lock, Mail } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { AuthShell, authButtonClassName, authLinkClassName } from '@/components/auth-shell';
import { IconInput, PasswordVisibilityToggle } from '@/components/ui/icon-input';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import { friendlyError } from '@/lib/errors';

function LoginForm() {
  const { login } = useAuth();
  const next = useSearchParams().get('next');
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
      await login(email, password, next);
    } catch (err) {
      setError(friendlyError(err, "Couldn't sign in. Try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      guestOnly
      title="Welcome back"
      description="Sign in to your organization's security console."
      footer={
        <>
          New to InfraSentinel?{' '}
          <Link href="/signup" className={authLinkClassName}>
            Create an organization
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <IconInput
            icon={Mail}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@company.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-[13px] font-medium text-primary underline-offset-4 hover:underline">
              Forgot password?
            </Link>
          </div>
          <IconInput
            icon={Lock}
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Your password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            trailing={<PasswordVisibilityToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
          />
        </div>

        {error && <Notice tone="error">{error}</Notice>}

        <button type="submit" disabled={loading} className={authButtonClassName}>
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    // useSearchParams (?next= after a session ran out) needs a Suspense boundary
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LoginForm />
    </Suspense>
  );
}
