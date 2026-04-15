export type ThemePresetId =
  | 'obsidian'
  | 'clear'
  | 'pearl'
  | 'sunset'
  | 'ocean'
  | 'ember'
  | 'mint';

type ThemePalette = {
  id: ThemePresetId;
  label: string;
  description: string;
  family: 'sobrios' | 'vivos' | 'premium';
  mode: 'light' | 'dark';
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
  {
    id: 'clear',
    label: 'Blanco puro',
    description: 'Fondo blanco con negro sólido y acento azul limpio.',
    family: 'sobrios',
    mode: 'light',
    accentColor: '#127bff',
    panelColor: '#eef4fb',
    paperColor: '#ffffff',
    inkColor: '#111111',
    vars: {
      '--color-primary': '#127bff',
      '--color-primary-container': '#dbeaff',
      '--color-on-primary': '#ffffff',
      '--color-primary-fixed-dim': '#0f67d4',
      '--color-secondary': '#3b4f67',
      '--color-secondary-container': '#dfe8f3',
      '--color-on-secondary': '#0f1720',
      '--color-tertiary': '#ff8f1f',
      '--color-tertiary-container': '#ffe6cc',
      '--color-on-tertiary': '#341700',
      '--color-surface': '#ffffff',
      '--color-surface-dim': '#f6f9fc',
      '--color-surface-bright': '#ffffff',
      '--color-surface-variant': '#dde6f0',
      '--color-surface-container-lowest': '#ffffff',
      '--color-surface-container-low': '#f7faff',
      '--color-surface-container': '#f1f6fb',
      '--color-surface-container-high': '#e9eff6',
      '--color-surface-container-highest': '#dfe7f0',
      '--color-on-surface': '#111111',
      '--color-on-surface-variant': '#435366',
      '--color-outline': '#8493a5',
      '--color-outline-variant': '#c8d3de',
      '--color-error': '#ffb4ab',
      '--color-error-container': '#93000a',
      '--color-on-error': '#690005',
    },
  },
  {
    id: 'pearl',
    label: 'Perla',
    description: 'Premium claro con marfil suave, negro elegante y oro sobrio.',
    family: 'premium',
    mode: 'light',
    accentColor: '#b88a1b',
    panelColor: '#f4efe7',
    paperColor: '#fffdf8',
    inkColor: '#181512',
    vars: {
      '--color-primary': '#b88a1b',
      '--color-primary-container': '#f3e2b7',
      '--color-on-primary': '#ffffff',
      '--color-primary-fixed-dim': '#8e6a0f',
      '--color-secondary': '#5d5448',
      '--color-secondary-container': '#eae1d5',
      '--color-on-secondary': '#1a1713',
      '--color-tertiary': '#4f88c6',
      '--color-tertiary-container': '#dbe9f7',
      '--color-on-tertiary': '#091521',
      '--color-surface': '#fffdf8',
      '--color-surface-dim': '#f8f3eb',
      '--color-surface-bright': '#ffffff',
      '--color-surface-variant': '#e4dbcf',
      '--color-surface-container-lowest': '#fffdf8',
      '--color-surface-container-low': '#faf5ee',
      '--color-surface-container': '#f4efe7',
      '--color-surface-container-high': '#ede5da',
      '--color-surface-container-highest': '#e5dccf',
      '--color-on-surface': '#181512',
      '--color-on-surface-variant': '#5a5147',
      '--color-outline': '#968a7d',
      '--color-outline-variant': '#d5c9bb',
      '--color-error': '#ba1a1a',
      '--color-error-container': '#ffdad6',
      '--color-on-error': '#ffffff',
    },
  },
  {
    id: 'sunset',
    label: 'Naranja',
    description: 'Carbón volcánico con naranjas encendidos y cálidos.',
    family: 'vivos',
    mode: 'dark',
    accentColor: '#ff7a00',
    panelColor: '#25130d',
    paperColor: '#160a06',
    inkColor: '#fff4eb',
    vars: {
      '--color-primary': '#ff7a00',
      '--color-primary-container': '#d45b00',
      '--color-on-primary': '#220d00',
      '--color-primary-fixed-dim': '#ffad52',
      '--color-secondary': '#ffd4b5',
      '--color-secondary-container': '#7a4320',
      '--color-on-secondary': '#200d04',
      '--color-tertiary': '#ffcf4a',
      '--color-tertiary-container': '#a26000',
      '--color-on-tertiary': '#241400',
      '--color-surface': '#190d09',
      '--color-surface-dim': '#120906',
      '--color-surface-bright': '#3a2118',
      '--color-surface-variant': '#4a2b20',
      '--color-surface-container-lowest': '#100603',
      '--color-surface-container-low': '#25130d',
      '--color-surface-container': '#2d1811',
      '--color-surface-container-high': '#3a2017',
      '--color-surface-container-highest': '#49291d',
      '--color-on-surface': '#fff4eb',
      '--color-on-surface-variant': '#f1cbb5',
      '--color-outline': '#cf9b7a',
      '--color-outline-variant': '#6a3d2c',
      '--color-error': '#ffb4ab',
      '--color-error-container': '#93000a',
      '--color-on-error': '#690005',
    },
  },
  {
    id: 'ocean',
    label: 'Azulado',
    description: 'Azul eléctrico con profundidad oscura y contraste frío.',
    family: 'sobrios',
    mode: 'dark',
    accentColor: '#1fa8ff',
    panelColor: '#0f2332',
    paperColor: '#08141d',
    inkColor: '#eef7ff',
    vars: {
      '--color-primary': '#1fa8ff',
      '--color-primary-container': '#006fb8',
      '--color-on-primary': '#001521',
      '--color-primary-fixed-dim': '#6bc9ff',
      '--color-secondary': '#cfe2ff',
      '--color-secondary-container': '#294f7a',
      '--color-on-secondary': '#07131f',
      '--color-tertiary': '#5ef0ff',
      '--color-tertiary-container': '#007d90',
      '--color-on-tertiary': '#00181c',
      '--color-surface': '#0c1822',
      '--color-surface-dim': '#071018',
      '--color-surface-bright': '#20384b',
      '--color-surface-variant': '#2a4a61',
      '--color-surface-container-lowest': '#050d14',
      '--color-surface-container-low': '#0f2332',
      '--color-surface-container': '#123043',
      '--color-surface-container-high': '#18415a',
      '--color-surface-container-highest': '#20516f',
      '--color-on-surface': '#eef7ff',
      '--color-on-surface-variant': '#d0e1f0',
      '--color-outline': '#8eb6d8',
      '--color-outline-variant': '#30536f',
      '--color-error': '#ffb4ab',
      '--color-error-container': '#93000a',
      '--color-on-error': '#690005',
    },
  },
  {
    id: 'ember',
    label: 'Rojo intenso',
    description: 'Borgoña encendido con fondos oscuros y contraste fuerte.',
    family: 'vivos',
    mode: 'dark',
    accentColor: '#ff4b57',
    panelColor: '#281015',
    paperColor: '#16080b',
    inkColor: '#fff0f2',
    vars: {
      '--color-primary': '#ff4b57',
      '--color-primary-container': '#c9202f',
      '--color-on-primary': '#230307',
      '--color-primary-fixed-dim': '#ff8891',
      '--color-secondary': '#ffd0d5',
      '--color-secondary-container': '#7d2f3b',
      '--color-on-secondary': '#21070b',
      '--color-tertiary': '#ffb36b',
      '--color-tertiary-container': '#b35b00',
      '--color-on-tertiary': '#261200',
      '--color-surface': '#16090c',
      '--color-surface-dim': '#100608',
      '--color-surface-bright': '#381720',
      '--color-surface-variant': '#4a212d',
      '--color-surface-container-lowest': '#0d0405',
      '--color-surface-container-low': '#281015',
      '--color-surface-container': '#32151c',
      '--color-surface-container-high': '#421c26',
      '--color-surface-container-highest': '#552632',
      '--color-on-surface': '#fff0f2',
      '--color-on-surface-variant': '#f0c8cd',
      '--color-outline': '#cf98a0',
      '--color-outline-variant': '#6d3640',
      '--color-error': '#ffb4ab',
      '--color-error-container': '#93000a',
      '--color-on-error': '#690005',
    },
  },
  {
    id: 'mint',
    label: 'Verde vivo',
    description: 'Verde menta brillante con paneles profundos y lectura limpia.',
    family: 'premium',
    mode: 'dark',
    accentColor: '#2ee6a6',
    panelColor: '#0f241d',
    paperColor: '#071611',
    inkColor: '#ecfff8',
    vars: {
      '--color-primary': '#2ee6a6',
      '--color-primary-container': '#00a86b',
      '--color-on-primary': '#021a12',
      '--color-primary-fixed-dim': '#74f2c6',
      '--color-secondary': '#c7f7e7',
      '--color-secondary-container': '#266652',
      '--color-on-secondary': '#071711',
      '--color-tertiary': '#8ce8ff',
      '--color-tertiary-container': '#007c96',
      '--color-on-tertiary': '#00171c',
      '--color-surface': '#091811',
      '--color-surface-dim': '#05110c',
      '--color-surface-bright': '#1d3b2f',
      '--color-surface-variant': '#275140',
      '--color-surface-container-lowest': '#040d09',
      '--color-surface-container-low': '#0f241d',
      '--color-surface-container': '#143027',
      '--color-surface-container-high': '#1b4135',
      '--color-surface-container-highest': '#235347',
      '--color-on-surface': '#ecfff8',
      '--color-on-surface-variant': '#cce8dd',
      '--color-outline': '#8bc4b1',
      '--color-outline-variant': '#2f6654',
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
    id: 'sobrios',
    label: 'Sobrios',
    description: 'Tonos equilibrados, limpios y profesionales.',
  },
  {
    id: 'vivos',
    label: 'Vivos',
    description: 'Acentos más intensos y presencia visual fuerte.',
  },
  {
    id: 'premium',
    label: 'Premium',
    description: 'Combinaciones elegantes con acabado más distintivo.',
  },
];

export function getThemePalette(themeId?: string | null) {
  return themePalettes.find((theme) => theme.id === themeId) ?? themePalettes[0];
}

export function resolveThemePresetFromSettings(settings?: {
  accentColor?: string | null;
  panelColor?: string | null;
  paperColor?: string | null;
  inkColor?: string | null;
}) {
  const accentColor = String(settings?.accentColor ?? '').toLowerCase();
  const panelColor = String(settings?.panelColor ?? '').toLowerCase();
  const paperColor = String(settings?.paperColor ?? '').toLowerCase();
  const inkColor = String(settings?.inkColor ?? '').toLowerCase();

  const match = themePalettes.find(
    (theme) =>
      theme.accentColor.toLowerCase() === accentColor &&
      theme.panelColor.toLowerCase() === panelColor &&
      theme.paperColor.toLowerCase() === paperColor &&
      theme.inkColor.toLowerCase() === inkColor,
  );

  return match?.id ?? defaultThemePresetId;
}

export function applyThemePreset(themeId?: string | null) {
  if (typeof document === 'undefined') {
    return;
  }

  const theme = getThemePalette(themeId);
  const root = document.documentElement;

  Object.entries(theme.vars).forEach(([token, value]) => {
    root.style.setProperty(token, value);
  });

  root.dataset.themePreset = theme.id;
  root.style.colorScheme = theme.mode;
}
