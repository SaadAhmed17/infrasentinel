import { cn } from '@/lib/utils';

// Fixed page backdrop: a drafting grid in the light theme, a slow teal aurora
// with a fading HUD grid in the dark theme. Purely decorative.
// 'plain' (signed-in pages) drops the grid so it never competes with tables and
// charts; the dark aurora stays as a soft glow behind the top bar.
export function AppBackground({ intensity = 'subtle' }: { intensity?: 'plain' | 'subtle' | 'bold' }) {
  return (
    <div
      aria-hidden
      className={cn('app-backdrop', intensity === 'bold' && 'app-backdrop--bold', intensity === 'plain' && 'app-backdrop--plain')}
    >
      <div className="app-backdrop__aurora" />
      <div className="app-backdrop__grid" />
    </div>
  );
}
