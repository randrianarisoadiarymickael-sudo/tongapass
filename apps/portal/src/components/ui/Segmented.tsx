import { RadioGroup } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Option<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
}

/** Contrôle segmenté : l'option choisie a un fond plein. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <RadioGroup.Root value={value} onValueChange={(next) => onChange(next as T)} orientation="horizontal" aria-label={label} className={cn('inline-flex max-w-full overflow-x-auto rounded-lg border border-line-strong bg-surface p-1 no-scrollbar', className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <RadioGroup.Item
            key={option.value}
            value={option.value}
            className={cn(
              'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors',
              active ? 'bg-brand text-on-brand' : 'text-ink-2 hover:bg-hover hover:text-ink',
            )}
          >
            <span>{option.label}</span>
            {option.count !== undefined ? <span className={cn('tabular text-xs', active ? 'text-on-brand/80' : 'text-ink-3')}>{option.count}</span> : null}
          </RadioGroup.Item>
        );
      })}
    </RadioGroup.Root>
  );
}
