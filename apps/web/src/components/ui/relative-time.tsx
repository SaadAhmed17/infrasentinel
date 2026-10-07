'use client';

import { useSyncExternalStore } from 'react';
import { formatDateTime, formatRelative } from '@/lib/format';
import { Tooltip } from './tooltip';

// One shared clock for every relative time on the page ("12 s ago"), ticking
// every 5 seconds, so the texts age without each component running a timer.
const listeners = new Set<() => void>();
let now = 0;
let timer: number | undefined;

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  if (timer === undefined) {
    now = Date.now();
    timer = window.setInterval(() => {
      now = Date.now();
      listeners.forEach((listener) => listener());
    }, 5000);
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && timer !== undefined) {
      window.clearInterval(timer);
      timer = undefined;
    }
  };
}

const getNow = () => now || Date.now();
const getServerNow = () => 0;

/** The current time, refreshed every 5 seconds. 0 while rendering on the server. */
export function useNow() {
  return useSyncExternalStore(subscribe, getNow, getServerNow);
}

/** "12 min ago", with the exact date and time on hover. */
export function RelativeTime({
  value,
  className,
  withSeconds = false,
}: {
  value: string | Date | null | undefined;
  className?: string;
  withSeconds?: boolean;
}) {
  const current = useNow();
  if (!value) return <span className={className}>never</span>;
  const text = current ? formatRelative(value, current) : formatDateTime(value);
  const exact = formatDateTime(value, withSeconds);
  return (
    <Tooltip content={exact}>
      <time dateTime={new Date(value).toISOString()} className={className}>
        {text}
      </time>
    </Tooltip>
  );
}
