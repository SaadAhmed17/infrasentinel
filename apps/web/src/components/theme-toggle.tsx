'use client';

import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';

// The theme lives on <html class="dark"> (set before hydration by the script in
// layout.tsx). Read it as an external store instead of copying it into state in
// an effect, so the icon always matches the page without an extra render.
function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

const isDarkTheme = () => document.documentElement.classList.contains('dark');

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribeToTheme, isDarkTheme, () => false);
  const label = dark ? 'Switch to light theme' : 'Switch to dark theme';

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  }

  return (
    <button
      onClick={toggle}
      className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface-2/50 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      aria-label={label}
      title={label}
    >
      {dark ? <Sun className="size-[17px]" strokeWidth={1.8} /> : <Moon className="size-[17px]" strokeWidth={1.8} />}
    </button>
  );
}
