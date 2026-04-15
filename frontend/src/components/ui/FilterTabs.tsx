import React from 'react';
import { cn } from '@/lib/utils';

interface FilterOption<T extends string | number> {
  label: string;
  value: T;
  icon?: string;
}

interface FilterTabsProps<T extends string | number> {
  options: Array<FilterOption<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export default function FilterTabs<T extends string | number>({
  options,
  value,
  onChange,
  className,
}: FilterTabsProps<T>) {
  return (
    <div
      className={cn(
        'flex flex-wrap gap-1.5 border border-outline-variant/10 bg-surface-container-low p-1.5',
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'border px-3 py-2 text-[9px] font-black uppercase tracking-[0.16em] transition-all active:scale-95',
            option.value === value
              ? 'border-primary/20 bg-primary text-on-primary shadow-lg shadow-primary/15'
              : 'border-outline-variant/10 bg-surface-container-high text-outline hover:text-white',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

