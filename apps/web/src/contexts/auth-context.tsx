'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

interface User {
  userId: string;
  email: string;
  role: string;
  organizationId: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, organizationName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reading localStorage (browser-only, unavailable during SSR) to hydrate initial auth state; this is the correct pattern here, not a derivable-during-render case.
        setUser({ userId: payload.sub, email: payload.email, role: payload.role, organizationId: payload.organizationId });
      } catch {
        localStorage.removeItem('accessToken');
      }
    }
    setLoading(false);
  }, []);

  async function login(email: string, password: string) {
    const data = await apiClient.post<{ accessToken: string; refreshToken: string }>('/auth/login', { email, password });
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    const payload = JSON.parse(atob(data.accessToken.split('.')[1]));
    setUser({ userId: payload.sub, email: payload.email, role: payload.role, organizationId: payload.organizationId });
    router.push('/dashboard');
  }

  async function signup(email: string, password: string, organizationName: string) {
    const data = await apiClient.post<{ accessToken: string; refreshToken: string }>('/auth/signup', { email, password, organizationName });
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    const payload = JSON.parse(atob(data.accessToken.split('.')[1]));
    setUser({ userId: payload.sub, email: payload.email, role: payload.role, organizationId: payload.organizationId });
    router.push('/dashboard');
  }

  function logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    router.push('/login');
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}