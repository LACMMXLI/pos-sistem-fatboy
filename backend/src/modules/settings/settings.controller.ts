import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getSettings() {
    return this.settingsService.getSettings();
  }

  @Get('admin')
  @Roles('ADMIN')
  getAdminSettings() {
    return this.settingsService.getAdminSettings();
  }

  @Get('printers')
  @Roles('ADMIN')
  getInstalledPrinters() {
    return this.settingsService.getInstalledPrinters();
  }

  @Patch()
  @Roles('ADMIN')
  updateSettings(
    @Body() data: { 
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
    }
  ) {
    return this.settingsService.updateSettings(data);
  }
}
