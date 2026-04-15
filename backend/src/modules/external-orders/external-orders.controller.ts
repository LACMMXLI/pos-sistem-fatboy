import { Controller, Get, Post, Body, Patch, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ExternalOrdersService } from './external-orders.service';
import { CreateExternalOrderDto, UpdateExternalOrderStatusDto } from './dto/external-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';

@ApiTags('External Orders (Integrations)')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('external-orders')
export class ExternalOrdersController {
  constructor(private readonly externalOrdersService: ExternalOrdersService) {}

  @Post()
  @Roles('ADMIN', 'SUPERVISOR')
  @ApiOperation({ summary: 'Registrar un nuevo pedido de fuente externa' })
  @ApiBody({ type: CreateExternalOrderDto })
  create(@Body() createDto: CreateExternalOrderDto) {
    return this.externalOrdersService.create(createDto);
  }

  @Get()
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO')
  @ApiOperation({ summary: 'Listar pedidos externos' })
  findAll() {
    return this.externalOrdersService.findAll();
  }

  @Get(':id')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO')
  @ApiOperation({ summary: 'Obtener detalle de un pedido externo' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.externalOrdersService.findOne(id);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO')
  @ApiOperation({ summary: 'Actualizar estado de un pedido externo' })
  @ApiBody({ type: UpdateExternalOrderStatusDto })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateExternalOrderStatusDto
  ) {
    return this.externalOrdersService.updateStatus(id, updateDto);
  }
}
