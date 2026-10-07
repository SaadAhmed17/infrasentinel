'use client';

import { useCallback, useSyncExternalStore } from 'react';

// A yes/no preference kept in localStorage, read as an external store so the
// value is never copied into state in an effect. 'storage' covers other tabs;
// FLAG_EVENT covers this tab. When storage is blocked the value lives in
// memory until the page reloads.
const FLAG_EVENT = 'stored-flag-change';
const memory = new Map<string, boolean>();

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(FLAG_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(FLAG_EVENT, onChange);
  };
}

function read(key: string | null) {
  if (!key) return false;
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return memory.get(key) ?? false;
  }
}

/** [value, setValue]. False on the server and without a key. */
export function useStoredFlag(key: string | null): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(subscribe, () => read(key), () => false);
  const setValue = useCallback(
    (next: boolean) => {
      if (!key) return;
      try {
        localStorage.setItem(key, next ? '1' : '0');
      } catch {
        memory.set(key, next);
      }
      window.dispatchEvent(new Event(FLAG_EVENT));
    },
    [key],
  );
  return [value, setValue];
}
