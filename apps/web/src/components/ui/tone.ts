// Semantic colours shared by tiles, badges and charts. Each maps to a theme token.
export type Tone = 'default' | 'primary' | 'critical' | 'high' | 'medium' | 'low' | 'online' | 'offline' | 'unknown';

export const TONE_COLOR: Record<Tone, string> = {
  default: 'var(--muted-foreground)',
  primary: 'var(--primary-bright)',
  critical: 'var(--sev-critical)',
  high: 'var(--sev-high)',
  medium: 'var(--sev-medium)',
  low: 'var(--sev-low)',
  online: 'var(--status-online)',
  offline: 'var(--status-offline)',
  unknown: 'var(--status-unknown)',
};

/** Tinted background + border for a tone, e.g. for badges. */
export function toneSurface(tone: Tone) {
  const color = TONE_COLOR[tone];
  return {
    color,
    backgroundColor: `color-mix(in oklab, ${color} 11%, transparent)`,
    borderColor: `color-mix(in oklab, ${color} 32%, transparent)`,
  };
}
