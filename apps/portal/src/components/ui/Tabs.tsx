import { Tabs as RadixTabs } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem {
  value: string;
  label: ReactNode;
  count?: number;
}

/** Onglets accessibles (Radix), soulignés sous l'onglet actif. */
export function Tabs({
  items,
  value,
  onValueChange,
  children,
  label,
}: {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  label: string;
}) {
  return (
    <RadixTabs.Root value={value} onValueChange={onValueChange}>
      <RadixTabs.List aria-label={label} className="flex max-w-full gap-1 overflow-x-auto border-b border-line no-scrollbar">
        {items.map((item) => (
          <RadixTabs.Trigger
            key={item.value}
            value={item.value}
            className={cn(
              '-mb-px inline-flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors',
              value === item.value ? 'border-brand text-ink' : 'border-transparent text-ink-3 hover:border-line-strong hover:text-ink',
            )}
          >
            <span>{item.label}</span>
            {item.count !== undefined ? (
              <span className="rounded px-1.5 text-xs tabular bg-hover text-ink-3">{item.count}</span>
            ) : null}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {children}
    </RadixTabs.Root>
  );
}

export const TabPanel = RadixTabs.Content;
