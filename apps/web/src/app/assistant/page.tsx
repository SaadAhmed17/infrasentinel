'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/protected-route';
import { apiClient } from '@/lib/api-client';

interface Source {
  incidentId: string;
  title: string;
  severity: string;
  status: string;
  relevance: number;
}

interface RagResponse {
  answer: string;
  sources: Source[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
}

function severityColor(s: string) {
  switch (s) {
    case 'CRITICAL': return 'bg-red-100 text-red-700';
    case 'HIGH': return 'bg-orange-100 text-orange-700';
    case 'MEDIUM': return 'bg-yellow-100 text-yellow-700';
    default: return 'bg-gray-100 text-gray-600';
  }
}

function AssistantContent() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reindexing, setReindexing] = useState(false);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    const question = input;
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const result = await apiClient.post<RagResponse>('/rag/query', { question });
      setMessages((prev) => [...prev, { role: 'assistant', content: result.answer, sources: result.sources }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get an answer');
    } finally {
      setLoading(false);
    }
  }

  async function handleReindex() {
    setReindexing(true);
    setError('');
    try {
      const result = await apiClient.post<{ indexed: number }>('/rag/reindex', {});
      setMessages((prev) => [...prev, { role: 'assistant', content: `Reindexed ${result.indexed} incident(s). You can now ask questions about them.` }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reindex');
    } finally {
      setReindexing(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 p-8">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
            <h1 className="mt-1 text-xl font-semibold">AI Incident Assistant</h1>
          </div>
          <button
            onClick={handleReindex}
            disabled={reindexing}
            className="rounded-md border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {reindexing ? 'Reindexing...' : 'Reindex incidents'}
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto rounded-lg border bg-white p-4 shadow-sm">
          {messages.length === 0 && (
            <p className="text-center text-sm text-gray-400">
              Ask about your incidents — e.g. &quot;What high severity incidents happened today?&quot; or &quot;Summarize recent alerts on InfraServer03&quot;
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
              <div className={`inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm text-left ${
                m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
              }`}>
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
              {m.sources && m.sources.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs font-medium text-gray-500">Sources:</p>
                  {m.sources.map((s) => (
                    <div key={s.incidentId} className="flex items-center gap-2 text-xs text-gray-600">
                      <span className={`rounded-full px-2 py-0.5 font-medium ${severityColor(s.severity)}`}>{s.severity}</span>
                      <span>{s.title}</span>
                      <span className="text-gray-400">({(s.relevance * 100).toFixed(0)}% relevant)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {loading && <p className="text-sm text-gray-400">Thinking...</p>}
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <form onSubmit={handleSend} className="mt-4 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your incidents..."
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AssistantPage() {
  return (
    <ProtectedRoute>
      <AssistantContent />
    </ProtectedRoute>
  );
}