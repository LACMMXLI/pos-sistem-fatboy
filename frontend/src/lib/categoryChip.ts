import type { CSSProperties } from 'react';

type ChipPalette = {
  bg: string;
  bgHover: string;
  bgActive: string;
  border: string;
  borderStrong: string;
  text: string;
  shadow: string;
};

const CATEGORY_CHIP_PALETTES: ChipPalette[] = [
  {
    bg: 'rgba(88, 129, 255, 0.14)',
    bgHover: 'rgba(88, 129, 255, 0.22)',
    bgActive: 'rgba(88, 129, 255, 0.34)',
    border: 'rgba(126, 160, 255, 0.22)',
    borderStrong: 'rgba(155, 183, 255, 0.44)',
    text: '#edf3ff',
    shadow: 'rgba(88, 129, 255, 0.22)',
  },
  {
    bg: 'rgba(60, 179, 113, 0.14)',
    bgHover: 'rgba(60, 179, 113, 0.22)',
    bgActive: 'rgba(60, 179, 113, 0.34)',
    border: 'rgba(116, 216, 162, 0.2)',
    borderStrong: 'rgba(145, 230, 183, 0.42)',
    text: '#ebfff4',
    shadow: 'rgba(60, 179, 113, 0.2)',
  },
  {
    bg: 'rgba(255, 159, 67, 0.15)',
    bgHover: 'rgba(255, 159, 67, 0.23)',
    bgActive: 'rgba(255, 159, 67, 0.34)',
    border: 'rgba(255, 190, 122, 0.22)',
    borderStrong: 'rgba(255, 205, 153, 0.44)',
    text: '#fff2e4',
    shadow: 'rgba(255, 159, 67, 0.2)',
  },
  {
    bg: 'rgba(233, 94, 136, 0.14)',
    bgHover: 'rgba(233, 94, 136, 0.22)',
    bgActive: 'rgba(233, 94, 136, 0.32)',
    border: 'rgba(244, 145, 176, 0.22)',
    borderStrong: 'rgba(249, 170, 197, 0.42)',
    text: '#fff0f5',
    shadow: 'rgba(233, 94, 136, 0.22)',
  },
  {
    bg: 'rgba(66, 184, 213, 0.14)',
    bgHover: 'rgba(66, 184, 213, 0.22)',
    bgActive: 'rgba(66, 184, 213, 0.34)',
    border: 'rgba(125, 215, 236, 0.2)',
    borderStrong: 'rgba(156, 225, 241, 0.4)',
    text: '#ecfbff',
    shadow: 'rgba(66, 184, 213, 0.2)',
  },
  {
    bg: 'rgba(168, 118, 255, 0.14)',
    bgHover: 'rgba(168, 118, 255, 0.22)',
    bgActive: 'rgba(168, 118, 255, 0.32)',
    border: 'rgba(200, 169, 255, 0.22)',
    borderStrong: 'rgba(214, 191, 255, 0.42)',
    text: '#f5efff',
    shadow: 'rgba(168, 118, 255, 0.2)',
  },
];

const ALL_CATEGORY_CHIP: ChipPalette = {
  bg: 'rgba(255, 215, 0, 0.12)',
  bgHover: 'rgba(255, 215, 0, 0.18)',
  bgActive: 'rgba(255, 215, 0, 0.28)',
  border: 'rgba(255, 215, 0, 0.18)',
  borderStrong: 'rgba(255, 215, 0, 0.4)',
  text: '#fff6c7',
  shadow: 'rgba(255, 215, 0, 0.18)',
};

function hashCategorySeed(seed: string): number {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

export function getCategoryChipStyle(categoryId: string, categoryName: string): CSSProperties {
  const palette =
    categoryId === 'all'
      ? ALL_CATEGORY_CHIP
      : CATEGORY_CHIP_PALETTES[hashCategorySeed(`${categoryId}:${categoryName}`) % CATEGORY_CHIP_PALETTES.length];

  return {
    '--category-chip-bg': palette.bg,
    '--category-chip-bg-hover': palette.bgHover,
    '--category-chip-bg-active': palette.bgActive,
    '--category-chip-border': palette.border,
    '--category-chip-border-strong': palette.borderStrong,
    '--category-chip-text': palette.text,
    '--category-chip-shadow': palette.shadow,
  } as CSSProperties;
}
