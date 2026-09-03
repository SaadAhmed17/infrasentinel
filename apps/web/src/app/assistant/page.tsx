'use client';
import { useState } from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/app-shell';
import { apiClient } from '@/lib/api-client';
import { Bot, RefreshCw, Send, Sparkles } from 'lucide-react';
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

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400',
  HIGH: 'border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400',
  MEDIUM: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  LOW: 'border-border bg-muted text-muted-foreground',
};

function severityStyle(s: string) {
  return SEVERITY_STYLES[s] ?? SEVERITY_STYLES.LOW;
}

/** Renders bold (**text**), bullet lists, and simple pipe tables from LLM markdown — no external library. */
function FormattedAnswer({ text }: { text: string }) {
  function renderInline(line: string) {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? (
        <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  }

  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Table block: a line starting with | followed by a |---|---| separator
    if (line.trim().startsWith('|') && lines[i + 1]?.trim().match(/^\|?[\s:|-]+\|?$/)) {
      const headerCells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && lines[j].trim().startsWith('|')) {
        rows.push(lines[j].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
        j++;
      }
      blocks.push(
        <div key={key++} className="my-2 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="bg-muted/70">
                {headerCells.map((h, hi) => (
                  <th key={hi} className="border-b border-border px-2.5 py-1.5 text-left font-bold text-foreground">
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className={ri !== rows.length - 1 ? 'border-b border-border' : ''}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-2.5 py-1.5 align-top text-foreground/90">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      i = j;
      continue;
    }

    // Bullet list block
    if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
      const items: string[] = [];
      let j = i;
      while (j < lines.length && (lines[j].trim().startsWith('- ') || lines[j].trim().startsWith('• '))) {
        items.push(lines[j].trim().replace(/^[-•]\s+/, ''));
        j++;
      }
      blocks.push(
        <ul key={key++} className="my-1.5 list-disc space-y-1 pl-5">
          {items.map((item, ii) => (
            <li key={ii}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      i = j;
      continue;
    }

    // Plain paragraph line
    if (line.trim().length > 0) {
      blocks.push(
        <p key={key++} className="my-1">
          {renderInline(line)}
        </p>
      );
    }
    i++;
  }

  return <div className="text-[13.5px] leading-relaxed">{blocks}</div>;
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
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Reindexed ${result.indexed} incident(s). You can now ask questions about them.` },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reindex');
    } finally {
      setReindexing(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-104px)] flex-col">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[13.5px] font-semibold text-muted-foreground">
          Ask questions grounded in your organization&apos;s incident history.
        </p>
        <button
          onClick={handleReindex}
          disabled={reindexing}
          className="flex h-8.5 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-semibold text-foreground hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${reindexing ? 'animate-spin' : ''}`} strokeWidth={2} />
          {reindexing ? 'Reindexing...' : 'Reindex incidents'}
        </button>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <div
                className="flex size-11 items-center justify-center rounded-xl"
                style={{ background: 'oklch(0.62 0.19 265)' }}
              >
                <Sparkles className="size-5 text-white" strokeWidth={2} />
              </div>
              <p className="mt-1 text-[14.5px] font-bold text-foreground">AI Incident Assistant</p>
              <p className="max-w-sm text-[13px] text-muted-foreground">
                Ask about your incidents — e.g. &quot;What high severity incidents happened today?&quot; or
                &quot;Summarize recent alerts on InfraServer03&quot;
              </p>
            </div>
          )}

          {messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <div
                  className="max-w-[75%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-[13.5px] text-white"
                  style={{ background: 'oklch(0.62 0.19 265)' }}
                >
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex items-start gap-2.5">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Bot className="size-4 text-muted-foreground" strokeWidth={2} />
                </div>
                <div className="max-w-[80%] rounded-2xl rounded-tl-sm border border-border bg-muted/60 px-4 py-2.5 text-foreground">
                  <FormattedAnswer text={m.content} />
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-3 space-y-1.5 border-t border-border pt-2.5">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Sources</p>
                      {m.sources.map((s) => (
                        <div
                          key={s.incidentId}
                          className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[12px]"
                        >
                          <span className={`rounded-md border px-1.5 py-0.5 font-bold ${severityStyle(s.severity)}`}>
                            {s.severity}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-medium text-foreground">{s.title}</span>
                          <span className="shrink-0 text-muted-foreground">{(s.relevance * 100).toFixed(0)}% match</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          )}

          {loading && (
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Bot className="size-4 text-muted-foreground" strokeWidth={2} />
              </div>
              <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-border bg-muted/60 px-4 py-3">
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mx-5 mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[13px] font-medium text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSend} className="flex gap-2 border-t border-border p-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your incidents..."
            className="h-10 flex-1 rounded-lg border border-border bg-background px-3.5 text-[14px] text-foreground outline-none focus:border-[oklch(0.62_0.19_265)] focus:ring-2 focus:ring-[oklch(0.62_0.19_265)]/20"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex h-10 items-center gap-1.5 rounded-lg bg-[oklch(0.62_0.19_265)] px-4 text-[14px] font-bold text-white hover:bg-[oklch(0.66_0.19_265)] disabled:opacity-50"
          >
            <Send className="size-3.5" strokeWidth={2.25} />
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
      <AppShell title="AI Assistant">
        <AssistantContent />
      </AppShell>
    </ProtectedRoute>
  );
}