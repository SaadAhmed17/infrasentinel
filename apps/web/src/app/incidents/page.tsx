'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/protected-route';
import { apiClient } from '@/lib/api-client';

interface Alert {
  id: string;
  status: string;
  details: Record<string, unknown>;
  rule: { name: string; ruleType: string };
  server: { name: string } | null;
  createdAt: string;
}

interface Incident {
  id: string;
  title: string;
  severity: string;
  status: string;
  alerts: Alert[];
  createdAt: string;
}

type TabKey = 'OPEN' | 'INVESTIGATING' | 'RESOLVED';

function severityColor(s: string) {
  switch (s) {
    case 'CRITICAL': return 'bg-red-100 text-red-700';
    case 'HIGH': return 'bg-orange-100 text-orange-700';
    case 'MEDIUM': return 'bg-yellow-100 text-yellow-700';
    default: return 'bg-gray-100 text-gray-600';
  }
}

function statusColor(s: string) {
  switch (s) {
    case 'RESOLVED': return 'bg-green-100 text-green-700';
    case 'INVESTIGATING': return 'bg-blue-100 text-blue-700';
    default: return 'bg-red-100 text-red-700';
  }
}

function IncidentsContent() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('OPEN');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState('');

  function loadIncidents() {
    apiClient.get<Incident[]>('/incidents').then(setIncidents).catch((err) => setError(err.message));
  }

  useEffect(() => {
    loadIncidents();
    const interval = setInterval(loadIncidents, 15000);
    return () => clearInterval(interval);
  }, []);

  async function updateStatus(incidentId: string, status: string) {
    await apiClient.patch(`/incidents/${incidentId}/status`, { status });
    loadIncidents();
  }

  const counts: Record<TabKey, number> = {
    OPEN: incidents.filter((i) => i.status === 'OPEN').length,
    INVESTIGATING: incidents.filter((i) => i.status === 'INVESTIGATING').length,
    RESOLVED: incidents.filter((i) => i.status === 'RESOLVED').length,
  };

  const visibleIncidents = incidents.filter((i) => i.status === activeTab);

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'OPEN', label: 'Open' },
    { key: 'INVESTIGATING', label: 'Investigating' },
    { key: 'RESOLVED', label: 'Resolved' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
        <h1 className="mt-1 mb-6 text-xl font-semibold">Incidents</h1>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <div className="mb-4 flex gap-1 border-b">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setExpandedId(null); }}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label} <span className="ml-1 text-xs text-gray-400">({counts[tab.key]})</span>
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {visibleIncidents.map((inc) => (
            <div key={inc.id} className="rounded-lg border bg-white shadow-sm">
              <button
                onClick={() => setExpandedId(expandedId === inc.id ? null : inc.id)}
                className="flex w-full items-center justify-between p-4 text-left"
              >
                <div>
                  <p className="font-medium">{inc.title}</p>
                  <p className="text-xs text-gray-500">{new Date(inc.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${severityColor(inc.severity)}`}>{inc.severity}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(inc.status)}`}>{inc.status}</span>
                </div>
              </button>

              {expandedId === inc.id && (
                <div className="border-t p-4">
                  <div className="mb-3 flex gap-2">
                    {inc.status !== 'INVESTIGATING' && (
                      <button onClick={() => updateStatus(inc.id, 'INVESTIGATING')} className="rounded-md border px-3 py-1 text-xs hover:bg-gray-50">
                        Mark investigating
                      </button>
                    )}
                    {inc.status !== 'RESOLVED' && (
                      <button onClick={() => updateStatus(inc.id, 'RESOLVED')} className="rounded-md border px-3 py-1 text-xs hover:bg-gray-50">
                        Mark resolved
                      </button>
                    )}
                    {inc.status === 'RESOLVED' && (
                      <button onClick={() => updateStatus(inc.id, 'OPEN')} className="rounded-md border px-3 py-1 text-xs hover:bg-gray-50">
                        Reopen
                      </button>
                    )}
                  </div>
                  <p className="mb-2 text-xs font-medium text-gray-500">Alerts in this incident:</p>
                  <ul className="space-y-2">
                    {inc.alerts.map((a) => (
                      <li key={a.id} className="rounded-md bg-gray-50 p-2 text-xs">
                        <span className="font-medium">{a.rule.name}</span>
                        {a.server && <span className="text-gray-500"> · {a.server.name}</span>}
                        <pre className="mt-1 whitespace-pre-wrap text-gray-500">{JSON.stringify(a.details)}</pre>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
          {visibleIncidents.length === 0 && (
            <div className="rounded-lg border bg-white p-6 text-center text-gray-400 shadow-sm">
              No {activeTab.toLowerCase()} incidents.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function IncidentsPage() {
  return (
    <ProtectedRoute>
      <IncidentsContent />
    </ProtectedRoute>
  );
}