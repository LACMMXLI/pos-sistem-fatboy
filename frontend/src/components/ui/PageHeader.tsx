import React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export default function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('border border-outline-variant/10 bg-surface-container-low p-3 shadow-xl', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-headline text-base font-black uppercase tracking-[0.08em] text-on-surface">{title}</h1>
          {description ? <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-outline">{description}</p> : null}
        </div>
        {actions ? <div>{actions}</div> : null}
      </div>
    </div>
  );
}

