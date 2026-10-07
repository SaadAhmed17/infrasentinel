'use client';

import type { ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { cn } from '@/lib/utils';

export interface SetupStep {
  key: string;
  title: string;
  description: string;
  done: boolean;
  /** Buttons or links for the step. Hidden once it is done. */
  action?: ReactNode;
  /** Shown instead of an action when the user's role can't do the step. */
  note?: string;
}

// One segment per step: the setup progress as a row of rack lights.
function Progress({ steps, className }: { steps: SetupStep[]; className?: string }) {
  return (
    <span className={cn('flex gap-1', className)} aria-hidden>
      {steps.map((step) => (
        <span
          key={step.key}
          className={cn('h-1.5 w-6 rounded-full', step.done ? 'bg-status-online' : 'bg-surface-3 ring-1 ring-inset ring-border-strong')}
        />
      ))}
    </span>
  );
}

function StepMarker({ index, done }: { index: number; done: boolean }) {
  return (
    <span
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full border text-[13px] font-semibold tabular-nums',
        done ? 'border-status-online/40 bg-status-online/12 text-status-online' : 'border-border-strong bg-surface-2 text-foreground',
      )}
      aria-hidden
    >
      {done ? <Check className="size-3.5" strokeWidth={2.25} /> : index + 1}
    </span>
  );
}

/** First run: the whole setup sequence, numbered, each step with its action. */
export function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const doneCount = steps.filter((s) => s.done).length;
  return (
    <Panel
      brackets
      title="Set up InfraSentinel"
      meta={`${doneCount} of ${steps.length} done`}
      actions={<Progress steps={steps} />}
    >
      <p className="max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
        Four steps from an empty account to your first detection. Each step turns green here as soon as it is done.
      </p>
      <ol className="mt-5 divide-y divide-border border-t border-border">
        {steps.map((step, index) => (
          <li key={step.key} className="flex gap-3.5 py-4 last:pb-0 sm:gap-4">
            <StepMarker index={index} done={step.done} />
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className={cn('text-[14.5px] font-semibold', step.done ? 'text-muted-foreground' : 'text-foreground')}>
                  {step.title}
                </p>
                {step.done && <span className="text-[12.5px] font-medium text-status-online">Done</span>}
              </div>
              {!step.done && (
                <>
                  <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-muted-foreground">{step.description}</p>
                  {step.action && <div className="mt-3 flex flex-wrap items-center gap-2">{step.action}</div>}
                  {!step.action && step.note && <p className="mt-2 text-[13px] text-muted-foreground">{step.note}</p>}
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

/** Once servers exist: one line with the next open step and a way to hide it. */
export function SetupReminder({ steps, onDismiss }: { steps: SetupStep[]; onDismiss: () => void }) {
  const next = steps.find((s) => !s.done);
  if (!next) return null;
  const doneCount = steps.filter((s) => s.done).length;
  return (
    <section
      aria-label="Setup progress"
      className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-border bg-card px-4 py-3 shadow-[var(--shadow-panel)] sm:px-5"
    >
      <div className="min-w-0 flex-1 basis-64">
        <p className="flex items-center gap-3 text-[14px] font-semibold text-foreground">
          Finish setting up
          <Progress steps={steps} />
          <span className="text-[13px] font-normal text-muted-foreground">
            {doneCount} of {steps.length} done
          </span>
        </p>
        <p className="mt-0.5 text-[13.5px] text-muted-foreground">
          Next: <span className="font-medium text-foreground">{next.title}.</span> {next.action ? null : next.note}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {next.action}
        <Button variant="ghost" size="icon-sm" onClick={onDismiss} aria-label="Hide setup steps" title="Hide setup steps">
          <X />
        </Button>
      </div>
    </section>
  );
}
