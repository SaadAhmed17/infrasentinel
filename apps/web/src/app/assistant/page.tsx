'use client';
import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Send } from 'lucide-react';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/app-shell';
import { apiClient } from '@/lib/api-client';
import { LogoMark } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { PixelArt } from '@/components/ui/empty-state';
import { fieldControlClass } from '@/components/ui/form-styles';
import { Notice } from '@/components/ui/notice';
import { SeverityBadge } from '@/components/ui/status';
import { cn } from '@/lib/utils';

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

const SUGGESTIONS = [
  'Which incidents are still open?',
  'What happened most recently?',
  'Summarize the critical incidents',
];

/** Renders bold (**text**), bullet lists, and simple pipe tables from LLM markdown — no external library. */
function FormattedAnswer({ text }: { text: string }) {
  function renderInline(line: string) {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      ) : (
        <span key={i}>{part}</span>
      ),
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
        <div key={key++} className="my-2.5 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-surface-2/80">
                {headerCells.map((h, hi) => (
                  <th
                    key={hi}
                    className="border-b border-border px-3 py-2 text-left font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground"
                  >
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className={ri !== rows.length - 1 ? 'border-b border-border' : ''}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 align-top text-foreground/90">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
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
        <ul key={key++} className="my-2 list-disc space-y-1 pl-5 marker:text-primary-bright">
          {items.map((item, ii) => (
            <li key={ii}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
      i = j;
      continue;
    }

    // Plain paragraph line
    if (line.trim().length > 0) {
      blocks.push(
        <p key={key++} className="my-1.5">
          {renderInline(line)}
        </p>,
      );
    }
    i++;
  }

  return <div className="text-[14px] leading-relaxed text-foreground/90">{blocks}</div>;
}

function AssistantAvatar() {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2">
      <LogoMark className="w-[15px]" title="InfraSentinel assistant" />
    </span>
  );
}

function AssistantContent() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reindexing, setReindexing] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // keep the newest message in view
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

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

  function applySuggestion(text: string) {
    setInput(text);
    inputRef.current?.focus();
  }

  return (
    <AppShell
      title="AI assistant"
      description="Ask about your incidents in plain language. Answers come from your organization's incident history, with the incidents they are based on."
      actions={
        <Button variant="outline" onClick={handleReindex} disabled={reindexing}>
          <RefreshCw className={cn(reindexing && 'animate-spin')} />
          {reindexing ? 'Reindexing...' : 'Reindex incidents'}
        </Button>
      }
    >
      <section className="relative flex h-[calc(100vh-17.5rem)] min-h-[24rem] flex-col overflow-hidden rounded-xl border border-border bg-card/90 shadow-[var(--shadow-panel)] backdrop-blur-[2px]">
        <div className="flex-1 overflow-y-auto px-5 py-6">
          {messages.length === 0 && !loading ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-5 flex size-20 items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface-2/60">
                <PixelArt name="chat" className="size-12" />
              </div>
              <p className="text-[17px] font-semibold tracking-tight text-foreground">Ask about your incidents</p>
              <p className="mt-1.5 max-w-md text-[14px] text-muted-foreground">
                If the assistant does not know an incident yet, reindex your incidents first.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => applySuggestion(s)}
                    className="rounded-full border border-border-strong bg-surface-2/60 px-3.5 py-1.5 text-[13px] text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-6">
              {messages.map((m, i) =>
                m.role === 'user' ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-primary px-4 py-2.5 text-[14px] text-primary-foreground shadow-[0_8px_24px_-14px_var(--primary)]">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex items-start gap-3">
                    <AssistantAvatar />
                    <div className="min-w-0 max-w-[85%] rounded-2xl rounded-tl-md border border-border bg-surface-2/70 px-4 py-3">
                      <FormattedAnswer text={m.content} />
                      {m.sources && m.sources.length > 0 && (
                        <div className="mt-3 border-t border-border pt-3">
                          <p className="hud-label mb-2">Based on</p>
                          <ul className="space-y-1.5">
                            {m.sources.map((s) => (
                              <li
                                key={s.incidentId}
                                className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
                              >
                                <SeverityBadge severity={s.severity} />
                                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{s.title}</span>
                                <span className="flex shrink-0 items-center gap-2 font-mono text-[11.5px] text-muted-foreground">
                                  <span className="hidden h-1 w-12 overflow-hidden rounded-full bg-muted sm:block" aria-hidden>
                                    <span
                                      className="block h-full rounded-full bg-primary-bright"
                                      style={{ width: `${Math.round(s.relevance * 100)}%` }}
                                    />
                                  </span>
                                  {(s.relevance * 100).toFixed(0)}% match
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ),
              )}

              {loading && (
                <div className="flex items-center gap-3" role="status" aria-label="The assistant is answering">
                  <AssistantAvatar />
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-border bg-surface-2/70 px-4 py-3.5">
                    {[0, 1, 2].map((n) => (
                      <span
                        key={n}
                        className="size-2 animate-rack-blink rounded-[2px] bg-primary-bright"
                        style={{ animationDelay: `${n * 0.2}s` }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {error && (
          <div className="px-5 pb-3">
            <Notice tone="error">{error}</Notice>
          </div>
        )}

        <form onSubmit={handleSend} className="flex gap-2 border-t border-border bg-surface-2/40 p-4">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your incidents..."
            aria-label="Your question"
            className={cn(fieldControlClass, 'h-11 flex-1')}
          />
          <Button type="submit" disabled={loading || !input.trim()} className="h-11 px-4">
            <Send />
            Send
          </Button>
        </form>
      </section>
    </AppShell>
  );
}
export default function AssistantPage() {
  return (
    <ProtectedRoute>
      <AssistantContent />
    </ProtectedRoute>
  );
}
