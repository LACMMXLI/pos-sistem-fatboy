import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PayrollsService } from './payrolls.service';
import { PayrollListQueryDto } from './dto/payroll.dto';

@ApiTags('Payrolls')
@ApiBearerAuth('access-token')
@Controller('payrolls')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PayrollsController {
  constructor(private readonly payrollsService: PayrollsService) {}

  @Get()
  @Roles('ADMIN', 'SUPERVISOR')
  @ApiOperation({ summary: 'Listar historial de nóminas' })
  @ApiResponse({ status: 200, description: 'Lista de nóminas obtenida.' })
  findAll(@Query() query: PayrollListQueryDto) {
    return this.payrollsService.findAll(query);
  }

  @Get(':id')
  @Roles('ADMIN', 'SUPERVISOR')
  @ApiOperation({ summary: 'Obtener detalle de una nómina' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.payrollsService.findOne(id);
  }

  @Patch(':id/mark-paid')
  @Roles('ADMIN', 'SUPERVISOR')
  @ApiOperation({ summary: 'Marcar nómina como pagada' })
  markPaid(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.payrollsService.markPaid(id, req.user.id);
  }
}
