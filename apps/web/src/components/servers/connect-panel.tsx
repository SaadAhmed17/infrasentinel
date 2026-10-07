'use client';

import { KeyRound } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { CodeBlock, CopyField } from '@/components/ui/copy-button';

/** The commands that start the agent from the repository, with the key filled in. */
export function agentSetupCommands(apiKey: string) {
  return [
    'cd apps/agent',
    'pip install -r requirements.txt',
    `printf "API_URL=${API_BASE_URL}\\nAPI_KEY=${apiKey}\\n" > .env`,
    'python agent.py',
  ].join('\n');
}

/**
 * Shown once, right after a server is added or its key is replaced: the key
 * and the agent setup, both ready to copy.
 */
export function ConnectPanel({
  title,
  apiKey,
  onDone,
}: {
  title: string;
  apiKey: string;
  onDone: () => void;
}) {
  return (
    <section
      aria-label={title}
      className="animate-fade-up rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-panel)] sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary-bright" aria-hidden>
          <KeyRound className="size-[18px]" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
            Copy the agent key now: it is shown only once. You can replace it later from the server&apos;s menu.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-4 sm:pl-12">
        <div>
          <p className="mb-1.5 text-[12.5px] font-medium text-muted-foreground">Agent key</p>
          <CopyField value={apiKey} label="Copy key" ariaLabel="Agent key" />
        </div>
        <div>
          <p className="mb-1.5 text-[12.5px] font-medium text-muted-foreground">Start the agent on the server</p>
          <CodeBlock code={agentSetupCommands(apiKey)} ariaLabel="Agent setup commands" />
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
            Run these from a copy of the InfraSentinel repository on the server. The agent reports every 10 seconds; the
            server turns online here with its first report.
          </p>
        </div>
        <Button onClick={onDone} className="w-full sm:w-auto">
          Done
        </Button>
      </div>
    </section>
  );
}
