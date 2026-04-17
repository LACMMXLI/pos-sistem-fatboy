import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getCategoryChipStyle } from '../../lib/categoryChip';

interface Category {
  id: string | number;
  name: string;
}

interface CategoryRailProps {
  categories: Category[];
  activeCategoryId: string | null;
  onCategorySelect: (id: string | null) => void;
  className?: string;
}

export function CategoryRail({ 
  categories, 
  activeCategoryId, 
  onCategorySelect,
  className 
}: CategoryRailProps) {
  const railRef = useRef<HTMLDivElement | null>(null);

  const scroll = (direction: 'left' | 'right') => {
    railRef.current?.scrollBy({ 
      left: direction === 'left' ? -240 : 240, 
      behavior: 'smooth' 
    });
  };

  const handleWheel = (event: React.WheelEvent) => {
    const rail = railRef.current;
    if (!rail) return;
    if (Math.abs(event.deltaY) < Math.abs(event.deltaX) && event.deltaX === 0) return;
    rail.scrollLeft += event.deltaY !== 0 ? event.deltaY : event.deltaX;
  };

  return (
    <div className={cn("relative flex items-center gap-1.5", className)}>
      <button 
        onClick={() => scroll('left')} 
        className="h-7 w-7 flex items-center justify-center bg-white/5 border border-white/5 text-outline hover:text-white rounded-[1px] shrink-0"
      >
        <ChevronLeft className="h-3 w-3" />
      </button>

      <div 
        ref={railRef} 
        onWheel={handleWheel}
        className="flex-1 flex gap-2 overflow-x-auto no-scrollbar py-0.5"
      >
        <button 
          onClick={() => onCategorySelect(null)} 
          className={cn(
            "px-4 h-7 flex items-center justify-center font-black uppercase text-[9px] rounded-[1px] border transition-all whitespace-nowrap", 
            activeCategoryId === null 
              ? "bg-primary text-black border-primary" 
              : "bg-[#111111] text-outline/50 border-white/5"
          )}
          style={getCategoryChipStyle('all', 'Todos')}
        >
          Todos
        </button>
        {categories.map((cat) => (
          <button 
            key={cat.id} 
            onClick={() => onCategorySelect(cat.id.toString())} 
            className={cn(
              "px-4 h-7 flex items-center justify-center font-black uppercase text-[9px] rounded-[1px] border transition-all whitespace-nowrap", 
              activeCategoryId === cat.id.toString() 
                ? "bg-primary text-black border-primary" 
                : "bg-[#111111] text-outline/50 border-white/5 opacity-80"
            )}
            style={getCategoryChipStyle(cat.id.toString(), cat.name)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <button 
        onClick={() => scroll('right')} 
        className="h-7 w-7 flex items-center justify-center bg-white/5 border border-white/5 text-outline hover:text-white rounded-[1px] shrink-0"
      >
        <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  );
}
