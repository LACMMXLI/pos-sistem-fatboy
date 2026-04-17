export type ThemePresetId = 'obsidian';

type ThemePalette = {
  id: ThemePresetId;
  label: string;
  description: string;
  family: 'premium';
  mode: 'dark';
  accentColor: string;
  panelColor: string;
  paperColor: string;
  inkColor: string;
  vars: Record<string, string>;
};

export const themePalettes: ThemePalette[] = [
  {
    id: 'obsidian',
    label: 'Oscuro',
    description: 'Grafito elegante con acento dorado.',
    family: 'premium',
    mode: 'dark',
    accentColor: '#FFD700',
    panelColor: '#1c1b1b',
    paperColor: '#0e0e0e',
    inkColor: '#e5e2e1',
    vars: {
      '--color-primary': '#FFD700',
      '--color-primary-container': '#B8860B',
      '--color-on-primary': '#000000',
      '--color-primary-fixed-dim': '#FFD700',
      '--color-secondary': '#b7c8e1',
      '--color-secondary-container': '#3a4a5f',
      '--color-on-secondary': '#213145',
      '--color-tertiary': '#ffb595',
      '--color-tertiary-container': '#ef6719',
      '--color-on-tertiary': '#571e00',
      '--color-surface': '#131313',
      '--color-surface-dim': '#131313',
      '--color-surface-bright': '#393939',
      '--color-surface-variant': '#353534',
      '--color-surface-container-lowest': '#0e0e0e',
      '--color-surface-container-low': '#1c1b1b',
      '--color-surface-container': '#201f1f',
      '--color-surface-container-high': '#2a2a2a',
      '--color-surface-container-highest': '#353534',
      '--color-on-surface': '#e5e2e1',
      '--color-on-surface-variant': '#c1c6d7',
      '--color-outline': '#8b90a0',
      '--color-outline-variant': '#414755',
      '--color-error': '#ffb4ab',
      '--color-error-container': '#93000a',
      '--color-on-error': '#690005',
    },
  },
];

export const defaultThemePresetId: ThemePresetId = 'obsidian';

export const themeFamilies: Array<{
  id: ThemePalette['family'];
  label: string;
  description: string;
}> = [
  {
    id: 'premium',
    label: 'Premium',
    description: 'Diseño exclusivo con acabados elegantes.',
  },
];

export function getThemePalette(_themeId?: string | null) {
  return themePalettes[0];
}

export function resolveThemePresetFromSettings(_settings?: any) {
  return defaultThemePresetId;
}

export function applyThemePreset(_themeId?: string | null) {
  if (typeof document === 'undefined') {
    return;
  }

  const theme = themePalettes[0];
  const root = document.documentElement;

  Object.entries(theme.vars).forEach(([token, value]) => {
    root.style.setProperty(token, value);
  });

  root.dataset.themePreset = theme.id;
  root.style.colorScheme = theme.mode;
  
  // Enforce dark mode class
  root.classList.add('dark');
}
