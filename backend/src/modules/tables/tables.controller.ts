import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TablesService } from './tables.service';
import { CreateTableDto, UpdateTableDto, UpdateTableStatusDto } from './dto/table.dto';

@ApiTags('Tables')
@Controller('tables')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Crear una nueva mesa' })
  create(@Body() createTableDto: CreateTableDto) {
    return this.tablesService.create(createTableDto);
  }

  @Post('tablet-temporary')
  @Roles('ADMIN', 'SUPERVISOR', 'MESERO')
  @ApiOperation({ summary: 'Crear una mesa personalizada desde tablet' })
  createTabletTemporary(@Body() createTableDto: CreateTableDto) {
    return this.tablesService.createTabletTemporary(createTableDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las mesas, opcionalmente filtradas por área' })
  @ApiQuery({ name: 'areaId', required: false, type: Number })
  findAll(@Query('areaId') areaId?: string) {
    if (areaId) {
      return this.tablesService.findByArea(+areaId);
    }
    return this.tablesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalles de una mesa (incluye pedidos activos)' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.tablesService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Actualizar mesa (nombre, área, estado)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateTableDto: UpdateTableDto) {
    return this.tablesService.update(id, updateTableDto);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'SUPERVISOR')
  @ApiOperation({ summary: 'Actualizar solo el estado de la mesa (disponible, ocupada, reservada)' })
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body() updateStatusDto: UpdateTableStatusDto) {
    return this.tablesService.updateStatus(id, updateStatusDto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Eliminar una mesa' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tablesService.remove(id);
  }
}
