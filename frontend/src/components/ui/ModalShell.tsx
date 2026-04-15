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
          'flex max-h-[85vh] flex-col overflow-hidden border border-outline-variant/15 bg-surface-container-low text-on-surface shadow-[0_30px_90px_rgba(0,0,0,0.72)] transition-all duration-300',
          size === 'sm' && 'max-w-md w-full',
          size === 'md' && 'max-w-xl w-full',
          size === 'lg' && 'max-w-3xl w-full',
          size === 'xl' && 'max-w-5xl w-full',
          className,
        )}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-outline-variant/10 bg-surface-container-lowest px-4 py-3">
          <div>
            <h3 className="font-headline text-[11px] font-black uppercase tracking-[0.2em] text-on-surface">{title}</h3>
            {description && (
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-outline">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            className="border border-outline-variant/10 bg-surface-container-high p-1.5 text-outline transition-all hover:border-primary/20 hover:text-white active:scale-95"
            onClick={onClose}
          >
             <X className="w-4 h-4" />
          </button>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto bg-surface px-4 py-3 md:px-5 md:py-4">
          {children}
        </div>

        {footer && (
          <div className="border-t border-outline-variant/10 bg-surface-container-lowest px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

