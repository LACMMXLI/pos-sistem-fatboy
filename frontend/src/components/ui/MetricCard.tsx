import React from 'react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  icon?: string;
  hint?: React.ReactNode;
  className?: string;
}

export default function MetricCard({
  label,
  value,
  hint,
  icon,
  className,
}: MetricCardProps) {
  return (
    <div className={cn('group relative overflow-hidden border border-outline-variant/10 bg-surface-container-low px-3 py-2.5 shadow-xl transition-all duration-200 hover:border-primary/20', className)}>
      <div className="absolute top-0 right-0 h-20 w-20 -mr-6 -mt-6 bg-primary/6 blur-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      
      <div className="relative z-10 mb-2 flex items-center justify-between gap-2">
        <span className="text-[8px] font-black uppercase tracking-[0.16em] text-outline">{label}</span>
        {icon && (
          <div className="flex h-7 w-7 items-center justify-center border border-outline-variant/10 bg-surface-container-highest text-outline transition-all group-hover:border-primary/20 group-hover:text-primary">
            <span className="material-symbols-outlined !text-[18px]">{icon}</span>
          </div>
        )}
      </div>
      
      <div className="relative z-10 text-2xl font-headline font-black tracking-tight text-on-surface">
        {value}
      </div>
      
      {hint && (
        <div className="relative z-10 mt-2 border-t border-outline-variant/10 pt-2 text-[8px] font-black uppercase tracking-[0.1em] text-outline">
          {hint}
        </div>
      )}
    </div>
  );
}


