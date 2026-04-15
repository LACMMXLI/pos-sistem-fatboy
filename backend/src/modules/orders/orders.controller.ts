import { Controller, Get, Post, Body, Patch, Param, UseGuards, ParseIntPipe, Req, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderStatusDto, AddItemsDto } from './dto/order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiQuery } from '@nestjs/swagger';

@ApiTags('Orders')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) { }

  @Post()
  @Roles('ADMIN', 'CAJERO', 'MESERO')
  @ApiOperation({ summary: 'Crear un nuevo pedido' })
  @ApiBody({ type: CreateOrderDto })
  @ApiResponse({ status: 201, description: 'Pedido creado exitosamente.' })
  create(@Body() createOrderDto: CreateOrderDto, @Req() req: any) {
    return this.ordersService.create(createOrderDto, req.user);
  }

  @Get()
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO')
  @ApiOperation({ summary: 'Listar todos los pedidos' })
  @ApiQuery({ name: 'paymentStatus', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Lista de pedidos obtenida.' })
  findAll(@Req() req: any, @Query('paymentStatus') paymentStatus?: string) {
    return this.ordersService.findAll({ paymentStatus }, req.user);
  }

  @Get('open')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO', 'MESERO')
  @ApiOperation({ summary: 'Obtener cuentas abiertas (pendientes/parciales)' })
  @ApiQuery({ name: 'orderType', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Cuentas abiertas obtenidas.' })
  findOpen(@Req() req: any, @Query('orderType') orderType?: string) {
    return this.ordersService.getOpenOrders({ orderType }, req.user);
  }

  @Get('active')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO', 'COCINA', 'MESERO')
  @ApiOperation({ summary: 'Obtener pedidos activos (Abiertos, En Proceso)' })
  @ApiResponse({ status: 200, description: 'Lista de pedidos activos obtenida.' })
  findActive(@Req() req: any) {
    return this.ordersService.getActiveOrders(req.user);
  }

  @Get('shift/:id')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO')
  @ApiOperation({ summary: 'Obtener pedidos asociados a un turno' })
  @ApiResponse({ status: 200, description: 'Lista de pedidos del turno obtenida.' })
  findByShift(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.ordersService.findByShift(id, req.user);
  }

  @Get(':id')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO', 'COCINA', 'MESERO')
  @ApiOperation({ summary: 'Obtener detalle de un pedido por ID' })
  @ApiResponse({ status: 200, description: 'Pedido encontrado.' })
  @ApiResponse({ status: 404, description: 'Pedido no encontrado.' })
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.ordersService.findOne(id, req.user);
  }

  @Patch(':id/items')
  @Roles('ADMIN', 'CAJERO', 'MESERO')
  @ApiOperation({ summary: 'Añadir productos a un pedido existente' })
  @ApiBody({ type: AddItemsDto })
  @ApiResponse({ status: 200, description: 'Productos añadidos exitosamente.' })
  addItems(@Param('id', ParseIntPipe) id: number, @Body() addItemsDto: AddItemsDto, @Req() req: any) {
    return this.ordersService.addItems(id, addItemsDto, req.user);
  }

  @Post(':id/submit')
  @Roles('ADMIN', 'CAJERO', 'MESERO')
  @ApiOperation({ summary: 'Enviar a producción los ítems pendientes de una orden' })
  @ApiResponse({ status: 200, description: 'Comanda enviada exitosamente.' })
  submit(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.ordersService.submit(id, req.user);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'SUPERVISOR', 'COCINA', 'CAJERO', 'MESERO')
  @ApiOperation({ summary: 'Actualizar el estado de un pedido' })
  @ApiBody({ type: UpdateOrderStatusDto })
  @ApiResponse({ status: 200, description: 'Estado actualizado exitosamente.' })
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body() updateStatusDto: UpdateOrderStatusDto, @Req() req: any) {
    return this.ordersService.updateStatus(id, updateStatusDto, req.user);
  }

  @Post(':id/print')
  @Roles('ADMIN', 'CAJERO', 'MESERO')
  @ApiOperation({ summary: 'Marcar cuenta como impresa y mesa en espera de pago' })
  @ApiResponse({ status: 200, description: 'Cuenta marcada exitosamente.' })
  printAccount(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.ordersService.printAccount(id, req.user);
  }

  @Post('maintenance/clear-all')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'BORRADO TOTAL DE DATOS DE NEGOCIO (PROVISIONAL)' })
  @ApiResponse({ status: 200, description: 'Datos eliminados exitosamente.' })
  clearAll(@Body('password') password: string, @Req() req: any) {
    const userId = req.user.id;
    return this.ordersService.clearBusinessData(userId, password);
  }
}
