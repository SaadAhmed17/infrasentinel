'use client';

import { Tabs } from '@base-ui/react/tabs';
import { cn } from '@/lib/utils';

export interface FilterTab {
  value: string;
  label: string;
  count?: number;
}

// Segmented filter (arrow keys move between options). Scrolls sideways on
// narrow screens instead of being cut off.
export function FilterTabs({
  value,
  onValueChange,
  tabs,
  label,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  tabs: FilterTab[];
  label: string;
  className?: string;
}) {
  return (
    <Tabs.Root value={value} onValueChange={(next) => onValueChange(String(next))} className={cn('min-w-0', className)}>
      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <Tabs.List
          aria-label={label}
          className="relative inline-flex rounded-lg border border-border bg-surface-3/60 p-1"
        >
          {tabs.map((tab) => (
            <Tabs.Tab
              key={tab.value}
              value={tab.value}
              className="relative z-10 inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-md px-3 text-[13px] font-medium text-muted-foreground outline-none transition-colors duration-[120ms] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring data-[active]:text-foreground pointer-coarse:h-9"
            >
              {tab.label}
              {tab.count !== undefined && <span className="text-[12px] tabular-nums text-muted-foreground">{tab.count}</span>}
            </Tabs.Tab>
          ))}
          <Tabs.Indicator className="absolute left-0 top-1/2 z-0 h-[calc(100%-0.5rem)] w-[var(--active-tab-width)] -translate-y-1/2 translate-x-[var(--active-tab-left)] rounded-md bg-card shadow-sm ring-1 ring-border transition-[translate,width] duration-200 ease-[cubic-bezier(0.2,0.7,0.2,1)]" />
        </Tabs.List>
      </div>
    </Tabs.Root>
  );
}
