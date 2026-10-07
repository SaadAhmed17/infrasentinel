'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Building2, Loader2, Lock, Mail } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { AuthShell, PasswordRule, authButtonClassName, authLinkClassName } from '@/components/auth-shell';
import { IconInput, PasswordVisibilityToggle } from '@/components/ui/icon-input';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import { friendlyError } from '@/lib/errors';

export default function SignupPage() {
  const { signup } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signup(email, password, organizationName);
    } catch (err) {
      setError(friendlyError(err, "Couldn't create the organization. Try again."));
    } finally {
      setLoading(false);
    }
  }

  const passwordValid = password.length >= 8;

  return (
    <AuthShell
      guestOnly
      title="Create your organization"
      description="Set up a workspace for your servers. You can invite your team afterwards."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className={authLinkClassName}>
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="orgName">Organization name</Label>
          <IconInput
            icon={Building2}
            id="orgName"
            name="organization"
            type="text"
            autoFocus
            autoComplete="organization"
            placeholder="Acme Corp"
            required
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <IconInput
            icon={Mail}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <IconInput
            icon={Lock}
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            required
            minLength={8}
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
              Creating organization…
            </>
          ) : (
            'Create organization'
          )}
        </button>
      </form>
    </AuthShell>
  );
}
