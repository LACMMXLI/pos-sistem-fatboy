import React from 'react';
import { cn } from '@/lib/utils';

interface SectionCardProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  footer?: React.ReactNode;
  variant?: 'default' | 'danger';
}

export default function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
  footer,
  variant = 'default',
}: SectionCardProps) {
  return (
    <div className={cn(
      'relative flex flex-col overflow-hidden border bg-surface-container-low shadow-xl transition-all duration-200',
      variant === 'danger' ? 'border-error/20' : 'border-outline-variant/10',
      className
    )}>
      {(title || description || actions) && (
        <div className={cn(
          'relative z-10 flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5',
          variant === 'danger' ? 'border-error/10 bg-error-container/10' : 'border-outline-variant/10 bg-surface-container-lowest'
        )}>
          <div>
            {title && <h3 className={cn('font-headline text-[10px] font-black uppercase tracking-[0.16em]', variant === 'danger' ? 'text-error' : 'text-on-surface')}>{title}</h3>}
            {description && <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.12em] text-outline">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
        </div>
      )}
      <div className={cn('relative z-10 min-h-0 flex-1 p-3', contentClassName)}>
        {children}
      </div>
      {footer && (
        <div className="relative z-10 border-t border-outline-variant/10 bg-surface-container-lowest px-3 py-2.5">
          {footer}
        </div>
      )}
    </div>
  );
}

