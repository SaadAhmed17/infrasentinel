'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from './button';

/** Copies text to the clipboard and says "Copied" for a moment. */
export function CopyButton({
  value,
  label = 'Copy',
  size = 'sm',
  variant = 'outline',
}: {
  value: string;
  label?: string;
  size?: 'xs' | 'sm';
  variant?: 'outline' | 'ghost';
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard can be blocked (insecure origin, permissions); the value stays selectable.
    }
  }

  return (
    <Button type="button" size={size} variant={variant} onClick={copy} aria-live="polite">
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      {copied ? 'Copied' : label}
    </Button>
  );
}

/** Icon-only copy button for short inline values (a hostname). */
export function CopyIconButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // clipboard blocked; the value stays selectable
    }
  }

  return (
    <Button type="button" size="icon-xs" variant="ghost" onClick={copy} aria-label={copied ? 'Copied' : label} title={label}>
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
    </Button>
  );
}

/** A read-only value (key, link) with a copy button. */
export function CopyField({ value, label = 'Copy', ariaLabel }: { value: string; label?: string; ariaLabel: string }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        readOnly
        value={value}
        aria-label={ariaLabel}
        onFocus={(e) => e.currentTarget.select()}
        className="h-10 min-w-0 flex-1 rounded-lg border border-border-strong bg-surface-2 px-3 font-mono text-[13px] text-foreground outline-none focus-visible:border-primary pointer-coarse:h-11"
      />
      <CopyButton value={value} label={label} />
    </div>
  );
}

/** A short shell snippet with a copy button. */
export function CodeBlock({ code, ariaLabel }: { code: string; ariaLabel: string }) {
  return (
    <div className="relative rounded-lg border border-border bg-surface-3/60">
      <pre aria-label={ariaLabel} className="overflow-x-auto p-3.5 pr-24 font-mono text-[12.5px] leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
      <div className="absolute right-2 top-2">
        <CopyButton value={code} size="xs" />
      </div>
    </div>
  );
}
