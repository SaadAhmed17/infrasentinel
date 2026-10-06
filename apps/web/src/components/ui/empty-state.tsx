import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type PixelArtName = 'server' | 'shield' | 'rules' | 'incidents' | 'chat';

// 16×16 pixel icons. '#' = outline (muted ink), '+' = signal (teal), '.' = empty.
const ART: Record<PixelArtName, string[]> = {
  server: [
    '................',
    '..############..',
    '..#..........#..',
    '..#.++..####.#..',
    '..#..........#..',
    '..############..',
    '..#..........#..',
    '..#.++..####.#..',
    '..#..........#..',
    '..############..',
    '..#..........#..',
    '..#.++..####.#..',
    '..#..........#..',
    '..############..',
    '...##......##...',
    '................',
  ],
  shield: [
    '................',
    '.......##.......',
    '.....##..##.....',
    '...##......##...',
    '..#..........#..',
    '..#..........#..',
    '..#.....+....#..',
    '..#....++....#..',
    '..#.+.++.....#..',
    '...#.++.....#...',
    '...#..+.....#...',
    '....#......#....',
    '.....#....#.....',
    '......#..#......',
    '.......##.......',
    '................',
  ],
  rules: [
    '................',
    '..############..',
    '..#..........#..',
    '..#.++.#####.#..',
    '..#..........#..',
    '..#.++.####..#..',
    '..#..........#..',
    '..#.++.#####.#..',
    '..#..........#..',
    '..#.++.###...#..',
    '..#..........#..',
    '..#..........#..',
    '..############..',
    '................',
    '................',
    '................',
  ],
  incidents: [
    '................',
    '.......##.......',
    '......#..#......',
    '......#..#......',
    '.....#....#.....',
    '.....#.++.#.....',
    '....#..++..#....',
    '....#..++..#....',
    '...#...++...#...',
    '...#........#...',
    '..#....++....#..',
    '..#..........#..',
    '.#............#.',
    '.##############.',
    '................',
    '................',
  ],
  chat: [
    '................',
    '................',
    '..############..',
    '.#............#.',
    '.#............#.',
    '.#..++....++..#.',
    '.#............#.',
    '.#....####....#.',
    '.#............#.',
    '..############..',
    '....##..........',
    '...#............',
    '................',
    '................',
    '................',
    '................',
  ],
};

export function PixelArt({ name, className }: { name: PixelArtName; className?: string }) {
  const rows = ART[name];
  return (
    <svg viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden className={className}>
      {rows.flatMap((row, y) =>
        [...row].map((cell, x) =>
          cell === '.' ? null : (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="1"
              height="1"
              fill={cell === '+' ? 'var(--primary-bright)' : 'var(--muted-foreground)'}
            />
          ),
        ),
      )}
    </svg>
  );
}

export function EmptyState({
  art,
  title,
  description,
  action,
  className,
}: {
  art: PixelArtName;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="relative mb-5 flex size-20 items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface-2/60">
        <PixelArt name={art} className="size-12 opacity-90" />
      </div>
      <p className="text-[16px] font-semibold tracking-tight text-foreground">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-[14px] text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
