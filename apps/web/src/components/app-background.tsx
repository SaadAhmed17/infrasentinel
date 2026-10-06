import { cn } from '@/lib/utils';

// Fixed page backdrop: a drafting grid in the light theme, a slow teal aurora
// with a fading HUD grid in the dark theme. Purely decorative.
export function AppBackground({ intensity = 'subtle' }: { intensity?: 'subtle' | 'bold' }) {
  return (
    <div aria-hidden className={cn('app-backdrop', intensity === 'bold' && 'app-backdrop--bold')}>
      <div className="app-backdrop__aurora" />
      <div className="app-backdrop__grid" />
    </div>
  );
}
