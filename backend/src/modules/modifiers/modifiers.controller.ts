import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ModifiersService } from './modifiers.service';
import { CreateModifierDto, UpdateModifierDto } from './dto/modifier.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';

@ApiTags('Product Modifiers')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('modifiers')
export class ModifiersController {
  constructor(private readonly modifiersService: ModifiersService) {}

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Crear un nuevo modificador (Solo ADMIN)' })
  @ApiBody({ type: CreateModifierDto })
  @ApiResponse({ status: 201, description: 'Modificador creado exitosamente.' })
  create(@Body() createModifierDto: CreateModifierDto) {
    return this.modifiersService.create(createModifierDto);
  }

  @Get('product/:productId')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO')
  @ApiOperation({ summary: 'Obtener modificadores por ID de producto' })
  @ApiResponse({ status: 200, description: 'Lista de modificadores obtenida.' })
  findByProduct(@Param('productId', ParseIntPipe) productId: number) {
    return this.modifiersService.findByProduct(productId);
  }

  @Get(':id')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO')
  @ApiOperation({ summary: 'Obtener un modificador por ID' })
  @ApiResponse({ status: 200, description: 'Modificador encontrado.' })
  @ApiResponse({ status: 404, description: 'Modificador no encontrado.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.modifiersService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Actualizar un modificador (Solo ADMIN)' })
  @ApiBody({ type: UpdateModifierDto })
  @ApiResponse({ status: 200, description: 'Modificador actualizado exitosamente.' })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateModifierDto: UpdateModifierDto) {
    return this.modifiersService.update(id, updateModifierDto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Eliminar un modificador (Solo ADMIN)' })
  @ApiResponse({ status: 200, description: 'Modificador eliminado exitosamente.' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.modifiersService.remove(id);
  }
}
