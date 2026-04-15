import { create } from 'zustand';

interface SettingsState {
  taxEnabled: boolean;
  taxRate: number;
  restaurantName?: string;
  restaurantAddress?: string;
  receiptAutoPrint?: boolean;
  receiptPaperWidth?: '58' | '80';
  receiptPrinterName?: string;
  kitchenPrinterName?: string;
  kitchenPaperWidth?: '58' | '80';
  receiptCutEnabled?: boolean;
  cashDrawerEnabled?: boolean;
  cashDrawerOpenOnCash?: boolean;
  accentColor?: string;
  paperColor?: string;
  panelColor?: string;
  inkColor?: string;
  themePreset?: string;
  shiftEmailEnabled?: boolean;
  shiftEmailHost?: string;
  shiftEmailPort?: number;
  shiftEmailSecure?: boolean;
  shiftEmailUser?: string;
  shiftEmailPassword?: string;
  shiftEmailFrom?: string;
  shiftEmailTo?: string;
  shiftEmailCc?: string;
  whatsappAddonEnabled?: boolean;
  setSettings: (settings: {
    taxEnabled?: boolean;
    taxRate: number;
    restaurantName?: string;
    restaurantAddress?: string;
    receiptAutoPrint?: boolean;
    receiptPaperWidth?: '58' | '80';
    receiptPrinterName?: string;
    kitchenPrinterName?: string;
    kitchenPaperWidth?: '58' | '80';
    receiptCutEnabled?: boolean;
    cashDrawerEnabled?: boolean;
    cashDrawerOpenOnCash?: boolean;
    accentColor?: string;
    paperColor?: string;
    panelColor?: string;
    inkColor?: string;
    themePreset?: string;
    shiftEmailEnabled?: boolean;
    shiftEmailHost?: string;
    shiftEmailPort?: number;
    shiftEmailSecure?: boolean;
    shiftEmailUser?: string;
    shiftEmailPassword?: string;
    shiftEmailFrom?: string;
    shiftEmailTo?: string;
    shiftEmailCc?: string;
    whatsappAddonEnabled?: boolean;
  }) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  taxEnabled: true,
  taxRate: 16.0,
  restaurantName: 'Mi negocio',
  restaurantAddress: '',
  receiptAutoPrint: false,
  receiptPaperWidth: '80',
  receiptPrinterName: '',
  kitchenPrinterName: '',
  kitchenPaperWidth: '80',
  receiptCutEnabled: true,
  cashDrawerEnabled: false,
  cashDrawerOpenOnCash: false,
  accentColor: '#FFD700',
  paperColor: '#0e0e0e',
  panelColor: '#1c1b1b',
  inkColor: '#e5e2e1',
  themePreset: 'obsidian',
  shiftEmailEnabled: false,
  shiftEmailHost: '',
  shiftEmailPort: 587,
  shiftEmailSecure: false,
  shiftEmailUser: '',
  shiftEmailPassword: '',
  shiftEmailFrom: '',
  shiftEmailTo: '',
  shiftEmailCc: '',
  whatsappAddonEnabled: false,
  setSettings: (settings) =>
    set((state) => ({
      ...state,
      ...settings,
      taxEnabled: settings.taxEnabled ?? state.taxEnabled,
    })),
}));
