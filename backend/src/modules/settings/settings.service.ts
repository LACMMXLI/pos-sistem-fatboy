import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolvePowerShellExecutable } from '../../utils/powershell';

const execFileAsync = promisify(execFile);

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  private mapSettings(settings: any, options?: { includeSecrets?: boolean }) {
    const includeSecrets = options?.includeSecrets ?? false;

    return {
      restaurantName: settings.restaurantName,
      restaurantAddress: settings.restaurantAddress,
      taxEnabled: settings.taxEnabled,
      taxRate: Number(settings.taxRate),
      receiptAutoPrint: settings.receiptAutoPrint,
      receiptPaperWidth: settings.receiptPaperWidth,
      receiptPrinterName: settings.receiptPrinterName,
      kitchenPrinterName: settings.kitchenPrinterName,
      kitchenPaperWidth: settings.kitchenPaperWidth,
      receiptCutEnabled: settings.receiptCutEnabled,
      cashDrawerEnabled: settings.cashDrawerEnabled,
      cashDrawerOpenOnCash: settings.cashDrawerOpenOnCash,
      accentColor: settings.accentColor,
      paperColor: settings.paperColor,
      panelColor: settings.panelColor,
      inkColor: settings.inkColor,
      shiftEmailEnabled: settings.shiftEmailEnabled,
      shiftEmailHost: settings.shiftEmailHost,
      shiftEmailPort: Number(settings.shiftEmailPort ?? 587),
      shiftEmailSecure: settings.shiftEmailSecure,
      shiftEmailUser: settings.shiftEmailUser,
      shiftEmailPassword: includeSecrets ? settings.shiftEmailPassword : undefined,
      shiftEmailFrom: settings.shiftEmailFrom,
      shiftEmailTo: settings.shiftEmailTo,
      shiftEmailCc: settings.shiftEmailCc,
      whatsappAddonEnabled: settings.whatsappAddonEnabled,
    };
  }

  private async getOrCreateSettingsRecord() {
    let settings = await this.prisma.systemConfig.findUnique({
      where: { id: 1 },
    });

    if (!settings) {
      settings = await this.prisma.systemConfig.create({
        data: {
          id: 1,
          taxEnabled: true,
          taxRate: 16.0,
        },
      });
    }

    return settings as any;
  }

  async getSettings() {
    const normalizedSettings = await this.getOrCreateSettingsRecord();

    return this.mapSettings(normalizedSettings, { includeSecrets: false });
  }

  async getAdminSettings() {
    const normalizedSettings = await this.getOrCreateSettingsRecord();

    return this.mapSettings(normalizedSettings, { includeSecrets: true });
  }

  async getInstalledPrinters() {
    if (process.platform !== 'win32') {
      return [];
    }

    const { stdout } = await execFileAsync(
      resolvePowerShellExecutable(),
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        "Get-Printer | Select-Object -ExpandProperty Name | ConvertTo-Json -Compress",
      ],
      { windowsHide: true },
    );

    const parsed = JSON.parse(stdout || '[]');
    const names = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];

    return names
      .map((name) => String(name).trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'es-MX'));
  }

  async updateSettings(data: { 
    restaurantName?: string;
    restaurantAddress?: string;
    taxEnabled?: boolean; 
    taxRate?: number;
    receiptAutoPrint?: boolean;
    receiptPaperWidth?: '58' | '80';
    receiptPrinterName?: string | null;
    kitchenPrinterName?: string | null;
    kitchenPaperWidth?: '58' | '80';
    receiptCutEnabled?: boolean;
    cashDrawerEnabled?: boolean;
    cashDrawerOpenOnCash?: boolean;
    accentColor?: string;
    paperColor?: string;
    panelColor?: string;
    inkColor?: string;
    shiftEmailEnabled?: boolean;
    shiftEmailHost?: string | null;
    shiftEmailPort?: number;
    shiftEmailSecure?: boolean;
    shiftEmailUser?: string | null;
    shiftEmailPassword?: string | null;
    shiftEmailFrom?: string | null;
    shiftEmailTo?: string | null;
    shiftEmailCc?: string | null;
    whatsappAddonEnabled?: boolean;
  }) {
    const normalizedData = { ...data };

    if (Object.prototype.hasOwnProperty.call(normalizedData, 'shiftEmailPassword')) {
      const normalizedPassword =
        typeof normalizedData.shiftEmailPassword === 'string'
          ? normalizedData.shiftEmailPassword.trim()
          : normalizedData.shiftEmailPassword;

      if (normalizedPassword) {
        normalizedData.shiftEmailPassword = normalizedPassword;
      } else {
        delete normalizedData.shiftEmailPassword;
      }
    }

    const settings = await this.prisma.systemConfig.upsert({
      where: { id: 1 },
      update: normalizedData,
      create: {
        id: 1,
        ...normalizedData,
        taxEnabled: normalizedData.taxEnabled ?? true,
        taxRate: normalizedData.taxRate ?? 16.0,
      },
    });

    const normalizedSettings = settings as any;

    return this.mapSettings(normalizedSettings, { includeSecrets: true });
  }
}
