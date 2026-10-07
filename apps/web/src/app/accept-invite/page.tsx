'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { AuthShell, PasswordRule, authButtonClassName, authLinkClassName } from '@/components/auth-shell';
import { friendlyError } from '@/lib/errors';
import { IconInput, PasswordVisibilityToggle } from '@/components/ui/icon-input';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';

function AcceptInviteForm() {
  const searchParams = useSearchParams();
  const { acceptInvitation } = useAuth();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('This invitation link is incomplete.');
      return;
    }

    setLoading(true);

    try {
      // Signs the new member in, like login and signup, and opens the dashboard.
      await acceptInvitation(token, password);
    } catch (err) {
      const message = friendlyError(err, "Couldn't accept the invitation. Try again.");
      setError(/expired|invalid|not found|already/i.test(message) ? 'This invitation has expired or was already used. Ask your admin for a new link.' : message);
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
      <AuthShell
        title="This invitation link is incomplete"
        description="Open the link exactly as you received it, or ask your admin for a new one."
        footer={signInInstead}
      >
        {null}
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
          <PasswordRule met={passwordValid} />
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
