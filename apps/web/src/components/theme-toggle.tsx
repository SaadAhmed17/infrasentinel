'use client';

import { useSyncExternalStore } from 'react';
import { Sun, Moon } from 'lucide-react';

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

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  }

  return (
    <button
      onClick={toggle}
      className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      {dark ? <Sun className="size-4" strokeWidth={1.9} /> : <Moon className="size-4" strokeWidth={1.9} />}
    </button>
  );
}
