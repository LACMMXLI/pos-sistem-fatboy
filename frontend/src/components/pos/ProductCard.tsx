import React from 'react';
import { ProductVisual } from '../ui/ProductVisual';
import { cn } from '../../lib/utils';

interface ProductCardProps {
  product: {
    id: number | string;
    name: string;
    price: number | string;
    imageUrl?: string;
    image?: string;
    icon?: string;
  };
  onClick: (product: any) => void;
  className?: string;
}

export function ProductCard({ product, onClick, className }: ProductCardProps) {
  return (
    <button 
      onClick={() => onClick(product)} 
      className={cn(
        "relative group h-[4.5rem] bg-[#161616] overflow-hidden transition-all border border-white/10 hover:border-primary/50 flex flex-col rounded-[2px] active:scale-95 shadow-md",
        className
      )}
    >
      <ProductVisual 
        imageUrl={product.imageUrl || product.image} 
        icon={product.icon} 
        alt={product.name} 
        className="absolute inset-0 z-0 bg-black/40" 
        imageClassName="opacity-30 group-hover:opacity-60 transition-opacity" 
        fallbackClassName="opacity-60" 
        emojiClassName="text-3xl" 
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
      <div className="relative z-10 flex-1 p-1.5 flex flex-col justify-center items-center text-center w-full">
        <span className="font-headline text-[12px] sm:text-[14px] font-black uppercase leading-[1.05] tracking-tight text-white line-clamp-3 drop-shadow-lg">
          {product.name}
        </span>
      </div>
    </button>
  );
}
