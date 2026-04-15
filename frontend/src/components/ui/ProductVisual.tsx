import { UtensilsCrossed } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ProductIconOption = {
  value: string;
  label: string;
  emoji: string;
};

export const PRODUCT_ICON_OPTIONS: ProductIconOption[] = [
  { value: 'burger', label: 'Hamburguesa', emoji: '🍔' },
  { value: 'hotdog', label: 'Hot dog', emoji: '🌭' },
  { value: 'nachos', label: 'Nachos', emoji: '🧀' },
  { value: 'burrito', label: 'Burrito', emoji: '🌯' },
  { value: 'sushi', label: 'Sushi', emoji: '🍣' },
  { value: 'pizza', label: 'Pizza', emoji: '🍕' },
  { value: 'taco', label: 'Taco', emoji: '🌮' },
  { value: 'fries', label: 'Papas', emoji: '🍟' },
  { value: 'drink', label: 'Bebida', emoji: '🥤' },
  { value: 'dessert', label: 'Postre', emoji: '🍨' },
];

export function getProductIconOption(icon?: string | null) {
  return PRODUCT_ICON_OPTIONS.find((option) => option.value === icon) ?? null;
}

type ProductVisualProps = {
  imageUrl?: string | null;
  icon?: string | null;
  alt: string;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  emojiClassName?: string;
};

export function ProductVisual({
  imageUrl,
  icon,
  alt,
  className,
  imageClassName,
  fallbackClassName,
  emojiClassName,
}: ProductVisualProps) {
  const iconOption = getProductIconOption(icon);
  const hasImage = Boolean(imageUrl?.trim());

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {hasImage ? (
        <img
          src={imageUrl!}
          alt={alt}
          className={cn('h-full w-full object-cover', imageClassName)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <div
          className={cn(
            'flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_58%),linear-gradient(135deg,_rgba(24,24,27,0.95),_rgba(52,52,58,0.94))]',
            fallbackClassName,
          )}
        >
          {iconOption ? (
            <span className={cn('select-none text-4xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)]', emojiClassName)}>
              {iconOption.emoji}
            </span>
          ) : (
            <UtensilsCrossed className="h-8 w-8 text-outline opacity-70" />
          )}
        </div>
      )}
    </div>
  );
}
