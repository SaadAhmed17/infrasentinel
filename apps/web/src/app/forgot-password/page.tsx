'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Mail, MailCheck } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { AuthShell, authButtonClassName, authLinkClassName } from '@/components/auth-shell';
import { IconInput } from '@/components/ui/icon-input';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import { friendlyError } from '@/lib/errors';

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
      setError('Enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(friendlyError(err, "Couldn't send the reset link. Try again."));
    } finally {
      setLoading(false);
    }
  }

  const backToSignIn = (
    <Link href="/login" className={`inline-flex items-center gap-1.5 ${authLinkClassName}`}>
      <ArrowLeft className="size-3.5" strokeWidth={2} />
      Back to sign in
    </Link>
  );

  if (sent) {
    return (
      <AuthShell
        title="Check your email"
        description="Follow the link in the email to choose a new password."
        footer={backToSignIn}
      >
        <Notice tone="success" icon={MailCheck}>
          If an account exists for <span className="font-semibold">{email.trim()}</span>, a password reset link
          is on its way. The link expires in {RESET_LINK_MINUTES} minutes and can be used once.
        </Notice>
        <p className="mt-5 text-[14px] text-muted-foreground">
          Didn&apos;t get it? Check your spam folder, or{' '}
          <button type="button" onClick={() => setSent(false)} className={authLinkClassName}>
            try again
          </button>
          .
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Forgot your password?"
      description="Enter your account email and we'll send you a link to choose a new one."
      footer={backToSignIn}
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <IconInput
            icon={Mail}
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {error && <Notice tone="error">{error}</Notice>}

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
    </AuthShell>
  );
}
