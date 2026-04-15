import { Controller, Get, UseGuards } from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

@ApiTags('Roles')
@ApiBearerAuth('access-token')
@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) { }

  @Get()
  @Roles('ADMIN', 'SUPERVISOR')
  @ApiOperation({ summary: 'Listar todos los roles disponibles (ADMIN y SUPERVISOR)' })
  @ApiResponse({ status: 200, description: 'Lista de roles obtenida.' })
  @ApiResponse({ status: 403, description: 'Prohibido. Se requieren permisos de ADMIN.' })
  findAll() {
    return this.rolesService.findAll();
  }
}
