import React from 'react';
import { cn } from '@/lib/utils';

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
};

export default function Switch({
  checked,
  onChange,
  disabled,
  className,
  ariaLabel,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        'relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-all duration-300',
        checked
          ? 'border-primary/35 bg-primary/90 shadow-[0_0_24px_rgba(255,215,0,0.18)]'
          : 'border-white/10 bg-black/30',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <span
        className={cn(
          'absolute left-1 top-1 h-[1.35rem] w-[1.35rem] rounded-full bg-white shadow-[0_4px_16px_rgba(0,0,0,0.35)] transition-transform duration-300',
          checked ? 'translate-x-6' : 'translate-x-0',
        )}
      />
    </button>
  );
}
