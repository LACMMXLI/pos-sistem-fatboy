import { Controller, Get, Body, Patch, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { KitchenService } from './kitchen.service';
import { UpdateKitchenOrderStatusDto } from './dto/kitchen-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';

@ApiTags('Kitchen (KDS)')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('kitchen')
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService) {}

  @Get('active')
  @Roles('ADMIN', 'COCINA', 'SUPERVISOR')
  @ApiOperation({ summary: 'Obtener comandas activas en cocina' })
  @ApiResponse({ status: 200, description: 'Lista de comandas activa obtenida.' })
  findActive() {
    return this.kitchenService.findAllPending();
  }

  @Get(':id')
  @Roles('ADMIN', 'COCINA', 'SUPERVISOR')
  @ApiOperation({ summary: 'Obtener detalle de una comanda de cocina' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.kitchenService.findOne(id);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'COCINA')
  @ApiOperation({ summary: 'Actualizar estado de preparación de una comanda' })
  @ApiBody({ type: UpdateKitchenOrderStatusDto })
  @ApiResponse({ status: 200, description: 'Estado de cocina actualizado.' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateKitchenOrderStatusDto
  ) {
    return this.kitchenService.updateStatus(id, updateDto);
  }

  @Patch('item/:itemId/status')
  @Roles('ADMIN', 'COCINA')
  @ApiOperation({ summary: 'Actualizar estado de un ítem de la comanda' })
  @ApiBody({ type: UpdateKitchenOrderStatusDto })
  @ApiResponse({ status: 200, description: 'Estado del ítem actualizado.' })
  updateItemStatus(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() updateDto: UpdateKitchenOrderStatusDto
  ) {
    return this.kitchenService.updateItemStatus(itemId, updateDto);
  }
}
