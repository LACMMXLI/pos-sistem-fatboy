import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface BottomNavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}

export function BottomNavButton({ active, onClick, icon, label }: BottomNavButtonProps) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center w-full h-full transition-all duration-200 active:scale-95 border-t-2 relative overflow-hidden group",
        active
          ? "text-primary bg-primary/10 border-primary/50 shadow-[inset_0_1px_0_rgba(255,215,0,0.15)]"
          : "text-outline border-transparent hover:bg-surface-container-low hover:text-white"
      )}
    >
      {active && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-primary shadow-[0_0_12px_rgba(255,215,0,0.5)]" />
      )}
      <div className={cn(
        "mb-1 transition-transform duration-200 group-hover:scale-110",
        active ? "scale-90" : "scale-75 opacity-70 group-hover:opacity-100"
      )}>
        {icon}
      </div>
      <span className={cn(
        "font-headline text-[9px] font-black uppercase tracking-[0.15em] leading-none transition-all",
        active ? "text-primary" : "group-hover:text-white"
      )}>
        {label}
      </span>
    </button>
  );
}
