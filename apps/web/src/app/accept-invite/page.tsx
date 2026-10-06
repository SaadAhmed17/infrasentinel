'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Loader2, Lock } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { AuthShell, authButtonClassName, authLinkClassName } from '@/components/auth-shell';
import { IconInput, PasswordVisibilityToggle } from '@/components/ui/icon-input';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import { cn } from '@/lib/utils';

function AcceptInviteForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid invitation link — no token found.');
      return;
    }

    setLoading(true);

    try {
      const data = await apiClient.post<{
        accessToken: string;
        refreshToken: string;
      }>('/auth/accept-invitation', {
        token,
        password,
      });

      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);

      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
    } finally {
      setLoading(false);
    }
  }

  const signInInstead = (
    <>
      Already joined?{' '}
      <Link href="/login" className={authLinkClassName}>
        Sign in
      </Link>
    </>
  );

  if (!token) {
    return (
      <AuthShell title="Invalid invitation link" description="This link is missing its invitation code." footer={signInInstead}>
        <Notice tone="error">This invitation link is missing a token. Please check the link you were sent.</Notice>
      </AuthShell>
    );
  }

  const passwordValid = password.length >= 8;

  return (
    <AuthShell
      title="Join your team"
      description="Choose a password to accept your invitation to InfraSentinel."
      footer={signInInstead}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
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
          {password.length > 0 && (
            <p
              className={cn(
                'flex items-center gap-1.5 text-[12.5px] font-medium',
                passwordValid ? 'text-status-online' : 'text-muted-foreground',
              )}
            >
              {passwordValid && <Check className="size-3.5" strokeWidth={2.5} />}
              At least 8 characters
            </p>
          )}
        </div>

        {error && <Notice tone="error">{error}</Notice>}

        <button type="submit" disabled={loading} className={authButtonClassName}>
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Joining...
            </>
          ) : (
            'Accept invitation'
          )}
        </button>
      </form>
    </AuthShell>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <AcceptInviteForm />
    </Suspense>
  );
}
