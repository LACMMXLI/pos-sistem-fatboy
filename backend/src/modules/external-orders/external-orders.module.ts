import { Module } from '@nestjs/common';
import { ExternalOrdersService } from './external-orders.service';
import { ExternalOrdersController } from './external-orders.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ExternalOrdersController],
  providers: [ExternalOrdersService],
  exports: [ExternalOrdersService],
})
export class ExternalOrdersModule {}
