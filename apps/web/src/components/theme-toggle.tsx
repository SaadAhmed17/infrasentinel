'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
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