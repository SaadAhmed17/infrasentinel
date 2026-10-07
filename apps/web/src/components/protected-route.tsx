'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { AppBackground } from '@/components/app-background';
import { LogoMark } from '@/components/brand/logo';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center" role="status">
        <AppBackground intensity="plain" />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <LogoMark className="w-10" blink title="Loading" />
          <p className="text-[13px] font-medium text-muted-foreground">Loading</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // briefly rendered while redirect happens
  }

  return <>{children}</>;
}
