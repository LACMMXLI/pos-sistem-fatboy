import React from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 border border-dashed border-outline-variant/20 bg-surface-container-low p-8 text-center',
        className,
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center bg-primary/10 text-primary">
        <span className="material-symbols-outlined text-[32px]">{icon ?? 'ink_pen'}</span>
      </div>
      <p className="font-headline text-2xl font-black uppercase tracking-[0.08em] text-on-surface">
        {title}
      </p>
      {description ? (
        <p className="max-w-md text-[10px] font-bold uppercase tracking-[0.12em] text-outline">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

