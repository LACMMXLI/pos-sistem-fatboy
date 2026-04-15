import { Controller, Get, Post, Body, Param, UseGuards, ParseIntPipe, Req } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';

@ApiTags('Payments')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @Roles('ADMIN', 'CAJERO')
  @ApiOperation({ summary: 'Registrar el pago de una orden' })
  @ApiBody({ type: CreatePaymentDto })
  @ApiResponse({ status: 201, description: 'Pago registrado exitosamente.' })
  create(@Body() createPaymentDto: CreatePaymentDto, @Req() req: any) {
    return this.paymentsService.create(createPaymentDto, req.user);
  }

  @Get()
  @Roles('ADMIN', 'SUPERVISOR')
  @ApiOperation({ summary: 'Listar todos los pagos (Historial)' })
  @ApiResponse({ status: 200, description: 'Lista de pagos obtenida.' })
  findAll() {
    return this.paymentsService.findAll();
  }

  @Get('order/:orderId')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO')
  @ApiOperation({ summary: 'Obtener pagos por ID de orden' })
  @ApiResponse({ status: 200, description: 'Pagos encontrados.' })
  findByOrder(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.paymentsService.findByOrder(orderId);
  }
}
