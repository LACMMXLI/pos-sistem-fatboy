import React from 'react';
import { cn } from '@/lib/utils';

type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

interface StatusBadgeProps {
  children: React.ReactNode;
  tone?: StatusTone;
  className?: string;
}

const toneClassMap: Record<StatusTone, string> = {
  neutral: 'bg-[var(--color-panel-strong)] text-[var(--color-ink)] border-[var(--color-line-strong)]',
  info: 'bg-[rgba(184,106,62,0.12)] text-[var(--color-accent)] border-[rgba(184,106,62,0.22)]',
  success: 'bg-[rgba(39,122,84,0.12)] text-[var(--color-success)] border-[rgba(39,122,84,0.22)]',
  warning: 'bg-[rgba(160,108,56,0.14)] text-[var(--color-warning)] border-[rgba(160,108,56,0.24)]',
  danger: 'bg-[rgba(148,61,47,0.12)] text-[var(--color-danger)] border-[rgba(148,61,47,0.24)]',
};

export default function StatusBadge({
  children,
  tone = 'neutral',
  className,
}: StatusBadgeProps) {
  return (
    <span className={cn('inline-flex rounded-none border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em]', toneClassMap[tone], className)}>
      {children}
    </span>
  );
}

