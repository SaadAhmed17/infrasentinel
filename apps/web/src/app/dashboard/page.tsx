'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { ProtectedRoute } from '@/components/protected-route';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';

interface Member {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

function DashboardContent() {
  const { user, logout } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .get<Member[]>('/organizations/members')
      .then(setMembers)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">InfraSentinel Dashboard</h1>
            <p className="text-sm text-gray-600">Logged in as {user?.email} ({user?.role})</p>
          </div>

         <div className="flex items-center gap-3">
        <Link href="/servers" className="text-sm text-blue-600 hover:underline">
        Servers
        </Link>

          <button onClick={logout} className="rounded-md border px-4 py-2 text-sm hover:bg-gray-100">
            Log out
          </button>
        </div>
        </div>
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium">Organization Members</h2>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2">Email</th>
                <th className="pb-2">Role</th>
                <th className="pb-2">Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="py-2">{m.email}</td>
                  <td className="py-2">{m.role}</td>
                  <td className="py-2">{new Date(m.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
