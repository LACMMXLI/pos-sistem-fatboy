import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AreasService } from './areas.service';
import { CreateAreaDto, UpdateAreaDto } from './dto/area.dto';

@ApiTags('Areas')
@Controller('areas')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Crear un nuevo área o salón' })
  @ApiResponse({ status: 201, description: 'Área creada exitosamente' })
  create(@Body() createAreaDto: CreateAreaDto) {
    return this.areasService.create(createAreaDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las áreas' })
  findAll() {
    return this.areasService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un área específica por ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.areasService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Actualizar un área' })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateAreaDto: UpdateAreaDto) {
    return this.areasService.update(id, updateAreaDto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Eliminar o desactivar un área' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.areasService.remove(id);
  }
}

// Simple decorator for controller name if it was a mistake on my thought, 
// wait NestJS boilerplate uses @Controller('areas').
import { Controller as ApiController } from '@nestjs/common';
