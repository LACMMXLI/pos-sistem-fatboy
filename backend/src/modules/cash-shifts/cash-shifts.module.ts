import { Module } from '@nestjs/common';
import { CashShiftsService } from './cash-shifts.service';
import { CashShiftsController } from './cash-shifts.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { CashShiftEmailService } from './cash-shift-email.service';
import { CashShiftReportPdfService } from './cash-shift-report-pdf.service';
import { NotificationDispatchModule } from '../notification-dispatch/notification-dispatch.module';

@Module({
  imports: [PrismaModule, SettingsModule, NotificationDispatchModule],
  controllers: [CashShiftsController],
  providers: [CashShiftsService, CashShiftEmailService, CashShiftReportPdfService],
  exports: [CashShiftsService],
})
export class CashShiftsModule {}
