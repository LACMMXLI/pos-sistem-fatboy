import React from 'react';
import { cn } from '@/lib/utils';

type ActionButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ActionButtonSize = 'sm' | 'md' | 'lg';

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  icon?: string;
  fullWidth?: boolean;
}

const variantClassMap: Record<ActionButtonVariant, string> = {
  primary: 'border-primary/20 bg-primary text-on-primary shadow-[0_14px_34px_rgba(255,215,0,0.16)] hover:-translate-y-[1px] hover:brightness-105 uppercase tracking-[0.14em]',
  secondary: 'border-white/10 bg-white/[0.05] text-on-surface hover:-translate-y-[1px] hover:border-primary/20 hover:bg-white/[0.08] uppercase tracking-[0.14em]',
  outline: 'bg-transparent text-on-surface border-white/14 hover:-translate-y-[1px] hover:bg-white/[0.04] uppercase tracking-[0.14em]',
  ghost: 'bg-transparent text-outline hover:bg-white/[0.04] hover:text-on-surface border-transparent uppercase tracking-[0.14em]',
  danger: 'bg-error-container/20 text-error hover:-translate-y-[1px] hover:bg-error-container/30 border-error/20 uppercase tracking-[0.14em]',
};

const sizeClassMap: Record<ActionButtonSize, string> = {
  sm: 'min-h-[2.5rem] px-3 text-[10px] gap-1.5 rounded-[0.95rem]',
  md: 'min-h-[2.85rem] px-3.5 text-[11px] gap-2 rounded-[1rem]',
  lg: 'min-h-[3.15rem] px-4 text-[12px] gap-2 rounded-[1rem]',
};

export default function ActionButton({
  className,
  children,
  variant = 'primary',
  size = 'md',
  icon,
  fullWidth = false,
  type = 'button',
  disabled,
  ...props
}: ActionButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        'inline-flex w-fit max-w-full items-center justify-center whitespace-nowrap border font-headline font-black transition-all duration-200 shrink-0 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50',
        sizeClassMap[size],
        variantClassMap[variant],
        fullWidth ? 'w-full' : '',
        className,
      )}
      {...props}
    >
      {icon ? <span className="material-symbols-outlined !text-[1.2em]">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}

