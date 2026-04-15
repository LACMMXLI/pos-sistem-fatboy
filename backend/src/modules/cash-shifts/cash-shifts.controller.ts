import { Controller, Get, Post, Body, Patch, Param, UseGuards, ParseIntPipe, Req, NotFoundException } from '@nestjs/common';
import { CashShiftsService } from './cash-shifts.service';
import { OpenCashShiftDto, CloseCashShiftDto, CreateCashMovementDto, SendCashShiftEmailDto, TestCashShiftEmailDto } from './dto/cash-shift.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';

@ApiTags('Cash Shifts')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cash-shifts')
export class CashShiftsController {
  constructor(private readonly cashShiftsService: CashShiftsService) {}

  @Post('open')
  @Roles('ADMIN', 'CAJERO')
  @ApiOperation({ summary: 'Abrir un nuevo turno de caja' })
  @ApiBody({ type: OpenCashShiftDto })
  @ApiResponse({ status: 201, description: 'Turno abierto exitosamente.' })
  open(@Body() openCashShiftDto: OpenCashShiftDto, @Req() req: any) {
    return this.cashShiftsService.open(req.user.id, openCashShiftDto);
  }

  @Patch(':id/close')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO')
  @ApiOperation({ summary: 'Cerrar un turno de caja' })
  @ApiBody({ type: CloseCashShiftDto })
  @ApiResponse({ status: 200, description: 'Turno cerrado exitosamente.' })
  close(@Param('id', ParseIntPipe) id: number, @Body() closeCashShiftDto: CloseCashShiftDto, @Req() req: any) {
    return this.cashShiftsService.close(id, closeCashShiftDto, req.user);
  }

  @Post('email/test')
  @Roles('ADMIN', 'SUPERVISOR')
  @ApiOperation({ summary: 'Validar y enviar un correo de prueba con la configuracion SMTP' })
  @ApiBody({ type: TestCashShiftEmailDto })
  testEmail(@Body() testCashShiftEmailDto: TestCashShiftEmailDto) {
    return this.cashShiftsService.testShiftEmailConfiguration(testCashShiftEmailDto);
  }

  @Post(':id/email')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO')
  @ApiOperation({ summary: 'Reenviar por correo el reporte PDF de un turno cerrado' })
  @ApiBody({ type: SendCashShiftEmailDto })
  resendEmail(
    @Param('id', ParseIntPipe) id: number,
    @Body() sendCashShiftEmailDto: SendCashShiftEmailDto,
    @Req() req: any,
  ) {
    return this.cashShiftsService.resendShiftEmail(id, req.user, sendCashShiftEmailDto);
  }

  @Post(':id/movements')
  @Roles('ADMIN', 'CAJERO')
  @ApiOperation({ summary: 'Registrar un movimiento manual (Entrada/Salida)' })
  @ApiBody({ type: CreateCashMovementDto })
  @ApiResponse({ status: 201, description: 'Movimiento registrado exitosamente.' })
  addMovement(
    @Param('id', ParseIntPipe) id: number,
    @Body() createCashMovementDto: CreateCashMovementDto,
    @Req() req: any
  ) {
    return this.cashShiftsService.addMovement(id, req.user, createCashMovementDto);
  }

  @Get('current')
  @Roles('ADMIN', 'CAJERO', 'SUPERVISOR')
  @ApiOperation({ summary: 'Obtener el turno de caja abierto del usuario actual' })
  findCurrent(@Req() req: any) {
    return this.cashShiftsService.findCurrentByUser(req.user.id);
  }

  @Get('availability')
  @Roles('ADMIN', 'CAJERO', 'SUPERVISOR', 'MESERO')
  @ApiOperation({ summary: 'Consultar si existe algun turno de caja operativo abierto' })
  async getAvailability() {
    const shift = await this.cashShiftsService.findAnyOpenShift();
    return {
      hasOpenShift: !!shift,
      shift: shift
        ? {
            id: shift.id,
            openedAt: shift.openedAt,
            user: shift.user,
          }
        : null,
    };
  }

  @Get()
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO')
  @ApiOperation({ summary: 'Listar todos los turnos (Historial)' })
  findAll(@Req() req: any) {
    return this.cashShiftsService.findAll(req.user);
  }

  @Get(':id/movements')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO')
  @ApiOperation({ summary: 'Obtener movimientos de un turno específico' })
  getMovements(@Param('id', ParseIntPipe) id: number) {
    return this.cashShiftsService.getMovements(id);
  }

  @Get('current/summary')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO')
  @ApiOperation({ summary: 'Obtener resumen financiero del turno abierto actual' })
  async getCurrentSummary(@Req() req: any) {
    const shift = await this.cashShiftsService.findCurrentByUser(req.user.id);
    if (!shift) throw new NotFoundException('No tienes un turno abierto actualmente');
    return this.cashShiftsService.getShiftSummary(shift.id);
  }

  @Get(':id/summary')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO')
  @ApiOperation({ summary: 'Obtener resumen financiero de un turno específico' })
  getSummary(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.cashShiftsService.getShiftSummary(id, req.user);
  }
}
