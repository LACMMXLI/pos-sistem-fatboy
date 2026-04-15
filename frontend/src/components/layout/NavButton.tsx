import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}

export function NavButton({ active, onClick, icon, label }: NavButtonProps) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex h-full w-fit shrink-0 items-center justify-center gap-1.5 px-2.5 py-1 transition-all duration-75 active:scale-95 ease-in-out border-b-2 whitespace-nowrap",
        active 
          ? "text-primary bg-surface-container-high border-primary" 
          : "text-outline hover:text-white hover:bg-surface-container-high border-transparent"
      )}
    >
      <div className="shrink-0">{icon}</div>
      <span className="font-headline font-bold tracking-tight uppercase text-[8px] leading-none">{label}</span>
    </button>
  );
}
