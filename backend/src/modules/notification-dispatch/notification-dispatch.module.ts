import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationDispatchController } from './notification-dispatch.controller';
import { NotificationDispatchService } from './notification-dispatch.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { AddonSharedTokenGuard } from '../auth/guards/addon-shared-token.guard';

@Module({
  imports: [ConfigModule, RealtimeModule],
  controllers: [NotificationDispatchController],
  providers: [NotificationDispatchService, AddonSharedTokenGuard],
  exports: [NotificationDispatchService],
})
export class NotificationDispatchModule {}
