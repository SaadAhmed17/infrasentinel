'use client';

import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Ellipsis, MessageSquarePlus, RefreshCw, RotateCcw, Send } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/app-shell';
import { LogoMark } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { CopyIconButton } from '@/components/ui/copy-button';
import { PixelArt } from '@/components/ui/empty-state';
import { DropdownMenu, MenuItem } from '@/components/ui/menu';
import { SeverityBadge } from '@/components/ui/status';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';
import { friendlyError } from '@/lib/errors';
import { plural } from '@/lib/format';
import { incidentTitle } from '@/lib/incidents';
import { canManageSecurity } from '@/lib/permissions';
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
  /** The question failed; it can be sent again. */
  failed?: string;
}

const SUGGESTIONS = [
  'Which incidents are still open?',
  'What happened in the last 24 hours?',
  'Summarize the critical incidents',
  'Which server has the most incidents?',
];
const STATUS_WORD: Record<string, string> = { OPEN: 'Open', INVESTIGATING: 'Investigating', RESOLVED: 'Resolved' };

// The conversation survives page changes and reloads in this tab only.
const historyKey = (orgId: string | undefined) => (orgId ? `assistantChat:${orgId}` : null);

function readHistory(key: string | null): ChatMessage[] {
  if (!key) return [];
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

/** Bold (**text**), bullet lists and simple pipe tables from the model's markdown. */
function FormattedAnswer({ text }: { text: string }) {
  function inline(line: string) {
    return line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
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
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith('|') && lines[i + 1]?.trim().match(/^\|?[\s:|-]+\|?$/)) {
      const cells = (row: string) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const header = cells(line);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && lines[j].trim().startsWith('|')) rows.push(cells(lines[j++]));
      blocks.push(
        <div key={key++} className="my-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-surface-2">
                {header.map((h, hi) => (
                  <th key={hi} className="border-b border-border px-3 py-2 text-left text-[12.5px] font-medium text-muted-foreground">
                    {inline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className={ri !== rows.length - 1 ? 'border-b border-border' : ''}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 align-top">
                      {inline(cell)}
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
    if (/^\s*([-•*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      let j = i;
      while (j < lines.length && /^\s*([-•*]|\d+\.)\s+/.test(lines[j])) items.push(lines[j++].replace(/^\s*([-•*]|\d+\.)\s+/, ''));
      const List = ordered ? 'ol' : 'ul';
      blocks.push(
        <List key={key++} className={cn('my-2 space-y-1 pl-5', ordered ? 'list-decimal' : 'list-disc marker:text-muted-foreground')}>
          {items.map((item, ii) => (
            <li key={ii}>{inline(item)}</li>
          ))}
        </List>,
      );
      i = j;
      continue;
    }
    if (line.trim()) {
      blocks.push(
        <p key={key++} className="my-2 first:mt-0">
          {inline(line)}
        </p>,
      );
    }
    i++;
  }
  return <div className="max-w-[68ch] text-[14.5px] leading-relaxed text-foreground/90">{blocks}</div>;
}

function AssistantMark() {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2" aria-hidden>
      <LogoMark className="w-[15px]" />
    </span>
  );
}

function Sources({ sources }: { sources: Source[] }) {
  return (
    <div className="mt-4">
      <p className="text-label mb-1.5">Sources</p>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {sources.map((s) => (
          <li key={s.incidentId}>
            <Link
              href={`/incidents?open=${s.incidentId}`}
              className="flex items-center gap-3 px-3 py-2 text-[13px] transition-colors duration-[120ms] hover:bg-accent/40"
            >
              <SeverityBadge severity={s.severity} compact />
              <span className="min-w-0 flex-1 truncate font-medium text-foreground">{incidentTitle(s.title)}</span>
              <span className="hidden shrink-0 text-muted-foreground sm:inline">{STATUS_WORD[s.status] ?? s.status}</span>
              <span className="shrink-0 text-[12.5px] text-muted-foreground">{s.relevance >= 0.8 ? 'Strong match' : 'Partial match'}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AssistantContent() {
  const { user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const question = useSearchParams().get('q');
  const key = historyKey(user?.organizationId);
  const [messages, setMessages] = useState<ChatMessage[]>(() => readHistory(key));
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const askedFromLink = useRef(false);
  const canReindex = canManageSecurity(user?.role);

  // keep the conversation for this tab
  useEffect(() => {
    if (!key) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(messages.slice(-40)));
    } catch {
      // storage full or blocked: the chat still works, it just won't survive a reload
    }
  }, [key, messages]);

  // follow new messages only when the reader is already at the bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (el && atBottom.current) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    atBottom.current = true;
    setMessages((prev) => [...prev.filter((m) => !(m.role === 'user' && m.failed === q)), { role: 'user', content: q }]);
    setInput('');
    setLoading(true);
    try {
      const result = await apiClient.post<RagResponse>('/rag/query', { question: q });
      setMessages((prev) => [...prev, { role: 'assistant', content: result.answer, sources: result.sources }]);
    } catch (err) {
      const reason = friendlyError(err, "The assistant couldn't answer. Try again.");
      setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 && m.role === 'user' ? { ...m, failed: reason } : m)));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  // /assistant?q=… (from an incident): ask once, then drop the question from the address
  useEffect(() => {
    if (!question || askedFromLink.current) return;
    askedFromLink.current = true;
    router.replace('/assistant');
    void Promise.resolve().then(() => send(question));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once for the link's question
  }, [question]);

  async function reindex() {
    setReindexing(true);
    try {
      const result = await apiClient.post<{ indexed: number }>('/rag/reindex', {});
      toast.success('Search index rebuilt', `Indexed ${plural(result.indexed, 'incident')}.`);
    } catch (err) {
      toast.error("Couldn't rebuild the index", friendlyError(err));
    } finally {
      setReindexing(false);
    }
  }

  function newChat() {
    setMessages([]);
    inputRef.current?.focus();
  }

  return (
    <AppShell
      title="AI assistant"
      meta="Answers come from your organization's incident history."
      inlineActions
      actions={
        <DropdownMenu
          trigger={
            <Button variant="ghost" size="icon" aria-label="Assistant options">
              <Ellipsis />
            </Button>
          }
        >
          <MenuItem icon={MessageSquarePlus} onClick={newChat}>
            New chat
          </MenuItem>
          {canReindex && (
            <MenuItem icon={RefreshCw} onClick={reindex}>
              {reindexing ? 'Rebuilding search index…' : 'Rebuild search index'}
            </MenuItem>
          )}
        </DropdownMenu>
      }
    >
      <section className="flex h-[calc(100dvh-19rem)] min-h-[22rem] flex-col md:h-[calc(100dvh-14rem)] md:rounded-xl md:border md:border-border md:bg-card md:shadow-[var(--shadow-panel)]">
        <div
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
          }}
          className="flex-1 overflow-y-auto py-4 md:px-6 md:py-6"
          aria-live="polite"
        >
          {messages.length === 0 && !loading ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-surface-3/70">
                <PixelArt name="chat" className="size-11" />
              </div>
              <p className="text-[16px] font-semibold text-foreground">Ask about your incidents</p>
              <p className="mt-1 max-w-sm text-[14px] text-muted-foreground">Pick a question to start, or write your own below.</p>
              <div className="mt-5 grid w-full max-w-lg gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-lg border border-border-strong bg-surface-2 px-3.5 py-2.5 text-left text-[13.5px] text-foreground transition-colors duration-[120ms] hover:border-primary/50 hover:bg-primary/8"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-[760px] space-y-6">
              {messages.map((m, i) =>
                m.role === 'user' ? (
                  <div key={i} className="animate-fade-up">
                    <div className="flex justify-end">
                      <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[14.5px] text-primary-foreground sm:max-w-[75%]">
                        {m.content}
                      </p>
                    </div>
                    {m.failed && (
                      <p role="alert" className="mt-2 flex flex-wrap items-center justify-end gap-2 text-[13px] text-destructive">
                        {m.failed}
                        <Button size="xs" variant="outline" onClick={() => send(m.content)} disabled={loading}>
                          <RotateCcw />
                          Try again
                        </Button>
                      </p>
                    )}
                  </div>
                ) : (
                  <div key={i} className="group flex animate-fade-up items-start gap-3">
                    <AssistantMark />
                    <div className="min-w-0 flex-1 pt-1">
                      <FormattedAnswer text={m.content} />
                      {m.sources && m.sources.length > 0 && <Sources sources={m.sources} />}
                      <div className="mt-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
                        <CopyIconButton value={m.content} label="Copy answer" />
                      </div>
                    </div>
                  </div>
                ),
              )}
              {loading && (
                <div className="flex items-center gap-3" role="status">
                  <AssistantMark />
                  <span className="flex items-center gap-1" aria-hidden>
                    {[0, 1, 2].map((n) => (
                      <span key={n} className="size-1.5 animate-rack-blink rounded-[1px] bg-primary-bright" style={{ animationDelay: `${n * 0.2}s` }} />
                    ))}
                  </span>
                  <span className="text-[13.5px] text-muted-foreground">Searching your incidents…</span>
                </div>
              )}
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="border-t border-border pt-3 md:p-4"
        >
          <div className="mx-auto flex max-w-[760px] items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder="Ask about your incidents"
              aria-label="Your question"
              className="max-h-36 min-h-11 flex-1 resize-none rounded-lg border border-input bg-surface-2 px-3.5 py-2.5 text-[14.5px] leading-snug text-foreground outline-none transition-[border-color,box-shadow] duration-[120ms] [field-sizing:content] placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20"
            />
            <Button type="submit" size="icon" disabled={loading || !input.trim()} aria-label="Send" className="size-11">
              <Send />
            </Button>
          </div>
          <p className="mx-auto mt-1.5 hidden max-w-[760px] text-[12px] text-muted-foreground md:block">Enter sends, Shift+Enter adds a line.</p>
        </form>
      </section>
    </AppShell>
  );
}

export default function AssistantPage() {
  return (
    <ProtectedRoute>
      {/* useSearchParams (?q= from an incident) needs a Suspense boundary */}
      <Suspense fallback={null}>
        <AssistantContent />
      </Suspense>
    </ProtectedRoute>
  );
}
