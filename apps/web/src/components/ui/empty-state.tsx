import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
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

const TONE_STYLE = {
  default: 'bg-surface-3/70 text-muted-foreground',
  positive: 'bg-status-online/12 text-status-online',
  error: 'bg-destructive/10 text-destructive',
};

/**
 * Empty, positive ("all clear") and error states. Error and empty are never the
 * same screen: an error says what failed and how to retry.
 */
export function EmptyState({
  art,
  icon: Icon,
  tone = 'default',
  title,
  description,
  action,
  className,
}: {
  art?: PixelArtName;
  icon?: LucideIcon;
  tone?: keyof typeof TONE_STYLE;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {(art || Icon) && (
        <div className={cn('mb-4 flex size-16 items-center justify-center rounded-2xl', TONE_STYLE[tone])}>
          {art ? <PixelArt name={art} className="size-11" /> : Icon && <Icon className="size-7" strokeWidth={1.75} aria-hidden />}
        </div>
      )}
      <p className="text-[15px] font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
