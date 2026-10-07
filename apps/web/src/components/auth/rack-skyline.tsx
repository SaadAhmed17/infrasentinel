import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Pixel-art scene: a skyline of server racks with blinking drive lights in
// front of a striped sun. Colours come from the --scene-* tokens, so it is a
// night scene in the dark theme and an ink print in the light theme.
// Deterministic, so server and client render the same.
const H = 108;
const HORIZON = 84;

type LedKind = 'ok' | 'warn' | 'alert';
interface RackSpec {
  x: number;
  w: number;
  h: number;
}

const SCENES: Record<'standard' | 'wide', { width: number; sunX: number; racks: RackSpec[] }> = {
  // for side panels and strips
  standard: {
    width: 192,
    sunX: 124,
    racks: [
      { x: 6, w: 13, h: 38 },
      { x: 22, w: 11, h: 27 },
      { x: 36, w: 15, h: 46 },
      { x: 55, w: 11, h: 31 },
      { x: 69, w: 13, h: 22 },
      { x: 160, w: 12, h: 30 },
      { x: 175, w: 14, h: 42 },
    ],
  },
  // for full-width banners: twice as wide, so the sun stays whole
  wide: {
    width: 384,
    sunX: 192,
    racks: [
      { x: 8, w: 13, h: 30 },
      { x: 24, w: 15, h: 44 },
      { x: 43, w: 11, h: 26 },
      { x: 57, w: 14, h: 38 },
      { x: 75, w: 12, h: 48 },
      { x: 91, w: 11, h: 24 },
      { x: 106, w: 13, h: 34 },
      { x: 124, w: 11, h: 20 },
      { x: 250, w: 11, h: 22 },
      { x: 265, w: 14, h: 36 },
      { x: 283, w: 12, h: 28 },
      { x: 299, w: 15, h: 46 },
      { x: 318, w: 11, h: 30 },
      { x: 333, w: 14, h: 40 },
      { x: 351, w: 12, h: 26 },
      { x: 366, w: 14, h: 36 },
    ],
  },
};

// A few lights are not "ok": the scene is a security console.
const LED_OVERRIDES: Partial<Record<string, LedKind>> = { '2-3': 'warn', '6-5': 'alert', '11-4': 'warn', '13-7': 'alert' };

function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

// Five flat colour bands from the top of the sun to the horizon, pixel-art style.
function sunBand(offset: number, r: number) {
  if (offset < -0.55 * r) return 'var(--scene-sun-1)';
  if (offset < -0.2 * r) return 'color-mix(in oklab, var(--scene-sun-1), var(--scene-sun-2))';
  if (offset < 0.15 * r) return 'var(--scene-sun-2)';
  if (offset < 0.5 * r) return 'color-mix(in oklab, var(--scene-sun-2), var(--scene-sun-3))';
  return 'var(--scene-sun-3)';
}

function Sun({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const rows: ReactNode[] = [];
  for (let y = cy - r; y < HORIZON; y++) {
    const dy = y - cy + 0.5;
    if (Math.abs(dy) > r) continue;
    // stripes widen towards the horizon, like a retro sunset
    const below = y - cy;
    if (below > 2 && below % 5 >= 5 - Math.min(3, Math.floor(below / 6) + 1)) continue;
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    rows.push(<rect key={y} x={cx - half} y={y} width={half * 2} height={1} style={{ fill: sunBand(y - cy, r) }} />);
  }
  return <g>{rows}</g>;
}

function FarSkyline({ width }: { width: number }) {
  const next = random(11);
  const blocks: ReactNode[] = [];
  let x = 0;
  while (x < width) {
    const w = 4 + Math.floor(next() * 8);
    const h = 3 + Math.floor(next() * 7);
    blocks.push(<rect key={x} x={x} y={HORIZON - h} width={w} height={h} fill="var(--scene-far)" />);
    x += w + Math.floor(next() * 3);
  }
  return <g>{blocks}</g>;
}

function Rack({ index, x, w, h }: RackSpec & { index: number }) {
  const top = HORIZON - h;
  const units = Math.floor((h - 2) / 4);
  const next = random(index * 97 + 5);
  const parts: ReactNode[] = [
    <rect key="body" x={x} y={top} width={w} height={h} fill="var(--scene-rack)" />,
    <rect key="edge" x={x} y={top} width={1} height={h} fill="var(--scene-rack-edge)" />,
    <rect key="cap" x={x} y={top} width={w} height={1} fill="var(--scene-rack-edge)" />,
  ];
  for (let u = 0; u < units; u++) {
    const y = top + 2 + u * 4;
    parts.push(<rect key={`line-${u}`} x={x + 1} y={y + 3} width={w - 1} height={1} fill="var(--scene-rack-line)" />);
    const kind: LedKind = LED_OVERRIDES[`${index}-${u}`] ?? 'ok';
    const blinking = kind !== 'ok' || next() > 0.85;
    parts.push(
      <rect
        key={`led-${u}`}
        x={x + 2}
        y={y + 1}
        width={2}
        height={1}
        fill={`var(--scene-led-${kind})`}
        className={blinking ? 'animate-rack-blink' : undefined}
        style={blinking ? { animationDuration: '2.4s', animationDelay: `${(next() * 2.4).toFixed(2)}s` } : undefined}
      />,
    );
    if (w > 11) {
      parts.push(<rect key={`bay-${u}`} x={x + 6} y={y + 1} width={w - 8} height={1} fill="var(--scene-rack-edge)" />);
    }
  }
  return <g>{parts}</g>;
}

export function RackSkyline({
  className,
  variant = 'standard',
}: {
  className?: string;
  variant?: 'standard' | 'wide';
}) {
  const { width, sunX, racks } = SCENES[variant];
  const next = random(3);
  const stars = Array.from({ length: Math.round(width / 5.6) }, (_, i) => ({
    x: Math.floor(next() * width),
    y: Math.floor(next() * 50),
    twinkle: i % 4 === 0,
  }));

  return (
    <svg
      viewBox={`0 0 ${width} ${H}`}
      preserveAspectRatio="xMidYMax slice"
      shapeRendering="crispEdges"
      aria-hidden
      className={cn('block', className)}
    >
      {stars.map((s, i) => (
        <rect
          key={i}
          x={s.x}
          y={s.y}
          width={1}
          height={1}
          fill="var(--scene-star)"
          className={s.twinkle ? 'animate-rack-blink' : undefined}
          style={s.twinkle ? { animationDuration: '3.2s', animationDelay: `${(i % 7) * 0.4}s` } : undefined}
        />
      ))}
      <Sun cx={sunX} cy={58} r={26} />
      <FarSkyline width={width} />
      {racks.map((rack, i) => (
        <Rack key={i} index={i} {...rack} />
      ))}
      <rect x={0} y={HORIZON} width={width} height={H - HORIZON} fill="var(--scene-ground)" />
      <rect x={0} y={HORIZON} width={width} height={1} fill="var(--scene-horizon)" opacity={0.85} />
      {[88, 93, 100].map((y, i) => (
        <rect key={y} x={0} y={y} width={width} height={1} fill="var(--scene-ground-line)" opacity={1 - i * 0.2} />
      ))}
      {[86, 90, 96].map((y, i) => (
        <rect
          key={y}
          x={sunX - 14 + i * 3}
          y={y}
          width={28 - i * 6}
          height={1}
          fill="var(--scene-sun-2)"
          opacity={0.45 - i * 0.12}
        />
      ))}
    </svg>
  );
}
