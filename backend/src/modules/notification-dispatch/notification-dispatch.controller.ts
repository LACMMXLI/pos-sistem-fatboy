import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AddonSharedTokenGuard } from '../auth/guards/addon-shared-token.guard';
import { NotificationDispatchService } from './notification-dispatch.service';
import { CreateNotificationDispatchDto } from './dto/create-notification-dispatch.dto';
import { DispatchResultDto } from './dto/dispatch-result.dto';

@ApiTags('Notification Dispatch')
@Controller('notification-dispatch')
export class NotificationDispatchController {
  constructor(
    private readonly notificationDispatchService: NotificationDispatchService,
  ) {}

  @Post('manual')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERVISOR')
  @ApiOperation({ summary: 'Crear un dispatch manual para el addon de WhatsApp' })
  createManual(@Body() dto: CreateNotificationDispatchDto) {
    return this.notificationDispatchService.createManualDispatch(dto);
  }

  @Post('addon-test')
  @UseGuards(AddonSharedTokenGuard)
  @ApiOperation({
    summary:
      'Crear un dispatch de prueba usando el token compartido del addon para validar el flujo extremo a extremo',
  })
  createAddonTestDispatch(@Body() dto: CreateNotificationDispatchDto) {
    return this.notificationDispatchService.createManualDispatch(dto);
  }

  @Get('pending')
  @UseGuards(AddonSharedTokenGuard)
  @ApiOperation({ summary: 'Obtener dispatches pendientes para el addon' })
  findPending() {
    return this.notificationDispatchService.findPending();
  }

  @Get(':id')
  @UseGuards(AddonSharedTokenGuard)
  @ApiOperation({ summary: 'Obtener el detalle de un dispatch' })
  findOne(@Param('id') id: string) {
    return this.notificationDispatchService.findOne(id);
  }

  @Post(':id/ack')
  @UseGuards(AddonSharedTokenGuard)
  @ApiOperation({ summary: 'Confirmar recepcion del dispatch por el addon' })
  acknowledge(@Param('id') id: string) {
    return this.notificationDispatchService.acknowledge(id);
  }

  @Post(':id/result')
  @UseGuards(AddonSharedTokenGuard)
  @ApiOperation({ summary: 'Registrar el resultado del envio del addon' })
  registerResult(@Param('id') id: string, @Body() dto: DispatchResultDto) {
    return this.notificationDispatchService.registerResult(id, dto);
  }
}
