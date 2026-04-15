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
  primary: 'bg-primary text-on-primary hover:brightness-110 border-transparent shadow-lg shadow-primary/10 uppercase tracking-[0.16em]',
  secondary: 'bg-surface-container-highest text-outline hover:text-white hover:bg-surface-container border-outline-variant/10 uppercase tracking-[0.16em]',
  outline: 'bg-transparent text-on-surface border-outline-variant/20 hover:bg-surface-container-highest uppercase tracking-[0.16em]',
  ghost: 'bg-transparent text-outline hover:bg-surface-container-highest hover:text-on-surface border-transparent uppercase tracking-[0.16em]',
  danger: 'bg-error-container/20 text-error hover:bg-error-container/30 border-error/20 uppercase tracking-[0.16em]',
};

const sizeClassMap: Record<ActionButtonSize, string> = {
  sm: 'min-h-[2.25rem] px-2.5 text-[9px] gap-1.5 rounded-none',
  md: 'min-h-[2.5rem] px-3 text-[10px] gap-1.5 rounded-none',
  lg: 'min-h-[2.75rem] px-3.5 text-[11px] gap-2 rounded-none',
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
        'inline-flex w-fit max-w-full items-center justify-center font-headline font-black transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed border shrink-0 active:scale-[0.98] whitespace-nowrap',
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

