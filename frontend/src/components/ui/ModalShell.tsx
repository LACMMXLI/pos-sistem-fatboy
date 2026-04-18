import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalShellProps {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: React.ReactNode;
  closeOnBackdrop?: boolean;
  isDark?: boolean;
}

export default function ModalShell({
  title,
  description,
  onClose,
  children,
  className,
  size = 'md',
  footer,
  closeOnBackdrop = true,
  isDark = false,
}: ModalShellProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm"
      onClick={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          'flex max-h-[88vh] flex-col overflow-hidden rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(30,30,30,0.98),rgba(18,18,18,0.98))] text-on-surface shadow-[0_30px_90px_rgba(0,0,0,0.72)] transition-all duration-300',
          size === 'sm' && 'max-w-md w-full',
          size === 'md' && 'max-w-xl w-full',
          size === 'lg' && 'max-w-3xl w-full',
          size === 'xl' && 'max-w-5xl w-full',
          className,
        )}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/8 bg-black/20 px-5 py-4">
          <div>
            <h3 className="font-headline text-[13px] font-black uppercase tracking-[0.18em] text-on-surface">{title}</h3>
            {description && (
              <p className="mt-1 text-[11px] font-semibold text-on-surface-variant">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            className="rounded-full border border-white/10 bg-white/[0.05] p-2 text-outline transition-all hover:border-primary/20 hover:text-white active:scale-95"
            onClick={onClose}
          >
             <X className="w-4 h-4" />
          </button>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto bg-transparent px-5 py-4 md:px-6 md:py-5">
          {children}
        </div>

        {footer && (
          <div className="border-t border-white/8 bg-black/18 px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

