'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

// The InfraSentinel symbol: an S ribbon wrapped around a server-rack pillar
// with three drive lights. Redrawn as a vector from the brand artwork; all
// colours come from the --logo-* theme tokens, so it works in both themes.
const S_PATH =
  'M60 16 C 40 15, 20 22, 18 40 C 16 58, 36 64, 52 70 C 72 77, 86 86, 84 102 C 82 116, 66 121, 48 121 C 34 121, 18 114, 16 100 L 16 88';

const WINDOWS = [15.5, 28.75, 41.25];
const SEPARATORS = [24.5, 37, 49.5];

function Pillar({ y, height }: { y: number; height: number }) {
  return (
    <>
      <rect x="38" y={y} width="13" height={height} fill="var(--logo-pillar-a)" />
      <rect x="51" y={y} width="13" height={height} fill="var(--logo-pillar-b)" />
    </>
  );
}

function Cap({ y }: { y: number }) {
  return (
    <>
      <rect x="34" y={y} width="17" height="8" fill="var(--logo-pillar-a)" />
      <rect x="51" y={y} width="17" height="8" fill="var(--logo-pillar-b)" />
    </>
  );
}

export function LogoMark({
  className,
  title = 'InfraSentinel',
  blink = false,
}: {
  className?: string;
  title?: string;
  /** Pulse the drive lights, e.g. while loading. */
  blink?: boolean;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const ribbonClip = `${id}-ribbon`;
  const tipClip = `${id}-tip`;

  return (
    <svg
      viewBox="0 0 100 130"
      role="img"
      aria-label={title}
      className={cn('h-auto shrink-0', className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* where the teal edge of the S is visible */}
        <clipPath id={ribbonClip}>
          <path d="M0 0 H38 V48 H100 V106 H40 V64 H0 Z" />
        </clipPath>
        {/* squares off the lower end of the S */}
        <clipPath id={tipClip}>
          <path d="M0 0 H100 V130 H0 V100 H30 V80 H0 Z" />
        </clipPath>
      </defs>

      <Pillar y={4} height={122} />

      <g clipPath={`url(#${tipClip})`} fill="none" strokeWidth="17">
        <path d={S_PATH} stroke="var(--logo-body)" />
        <path d={S_PATH} stroke="var(--logo-ribbon)" clipPath={`url(#${ribbonClip})`} />
        <path d={S_PATH} stroke="var(--logo-body)" transform="translate(3.4 -3.4)" />
      </g>
      <path d="M64 16 C 78 16, 88 27, 88 50" fill="none" stroke="var(--logo-ribbon)" strokeWidth="15" />

      {/* the S passes behind the top and bottom of the pillar */}
      <Pillar y={4} height={47} />
      <Pillar y={104} height={22} />
      <Cap y={4} />
      <Cap y={118} />

      {SEPARATORS.map((y) => (
        <rect key={y} x="38" y={y} width="26" height="1.5" fill="var(--logo-window)" />
      ))}
      {WINDOWS.map((y, i) => (
        <rect
          key={y}
          x="54.75"
          y={y}
          width="5.5"
          height="5.5"
          fill={blink ? 'var(--primary-bright)' : 'var(--logo-window)'}
          className={blink ? 'animate-rack-blink' : undefined}
          style={blink ? { animationDelay: `${i * 0.2}s` } : undefined}
        />
      ))}
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('whitespace-nowrap font-sans tracking-[-0.03em]', className)}>
      <span className="font-bold text-[var(--wordmark-strong)]">Infra</span>
      <span className="font-normal text-[var(--wordmark-soft)]">Sentinel</span>
    </span>
  );
}

export function Logo({
  className,
  markClassName,
  wordmarkClassName,
}: {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className={cn('w-6', markClassName)} />
      <Wordmark className={cn('text-[17px]', wordmarkClassName)} />
    </span>
  );
}
