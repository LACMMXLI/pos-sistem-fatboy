import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CashShiftsModule } from '../cash-shifts/cash-shifts.module';
import { OrdersModule } from '../orders/orders.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { SettingsModule } from '../settings/settings.module';
import { PrintJobsController } from './print-jobs.controller';
import { PrintTemplatesController } from './print-templates.controller';
import { PrintDataService } from './print-data.service';
import { PrintJobsService } from './print-jobs.service';
import { PrintRenderService } from './print-render.service';
import { PrintTemplatesService } from './print-templates.service';
import { PrintingController } from './printing.controller';
import { PrintingService } from './printing.service';

@Module({
  imports: [PrismaModule, OrdersModule, SettingsModule, RealtimeModule, CashShiftsModule],
  controllers: [PrintingController, PrintTemplatesController, PrintJobsController],
  providers: [
    PrintingService,
    PrintTemplatesService,
    PrintDataService,
    PrintRenderService,
    PrintJobsService,
  ],
  exports: [PrintingService, PrintJobsService, PrintTemplatesService, PrintRenderService],
})
export class PrintingModule {}
