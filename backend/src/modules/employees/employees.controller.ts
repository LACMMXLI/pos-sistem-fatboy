import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { EmployeesService } from './employees.service';
import {
  AttendanceQueryDto,
  ClosePayrollDto,
  CreateAttendanceDto,
  CreateAdvanceDto,
  CreateConsumptionDto,
  CreateDebtDto,
  CreateEmployeeDto,
  LedgerQueryDto,
  UpdateEmployeeDto,
} from './dto/employee.dto';
import { PayrollsService } from '../payrolls/payrolls.service';

@ApiTags('Employees')
@ApiBearerAuth('access-token')
@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeesController {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly payrollsService: PayrollsService,
  ) {}

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Crear un empleado operativo' })
  @ApiBody({ type: CreateEmployeeDto })
  @ApiResponse({ status: 201, description: 'Empleado creado exitosamente.' })
  create(@Body() createEmployeeDto: CreateEmployeeDto) {
    return this.employeesService.create(createEmployeeDto);
  }

  @Post('maintenance/clear-all')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'BORRADO TOTAL DE DATOS DE EMPLEADOS Y NOMINA' })
  @ApiResponse({ status: 200, description: 'Datos de empleados eliminados exitosamente.' })
  clearAll(@Body('password') password: string, @Req() req: any) {
    return this.employeesService.clearEmployeesData(req.user.id, password);
  }

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Listar empleados operativos' })
  findAll() {
    return this.employeesService.findAll();
  }

  @Get('basic-list')
  @Roles('ADMIN', 'CAJERO')
  @ApiOperation({ summary: 'Listar empleados operativos con datos basicos para caja y checador' })
  findBasicList() {
    return this.employeesService.findBasicList();
  }

  @Get(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Obtener detalle de un empleado operativo' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Actualizar un empleado operativo' })
  @ApiBody({ type: UpdateEmployeeDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(id, updateEmployeeDto);
  }

  @Get(':id/ledger')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Obtener historial de movimientos descontables del empleado' })
  findLedger(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: LedgerQueryDto,
  ) {
    return this.employeesService.findLedger(id, query);
  }

  @Get(':id/attendance')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Obtener historial de asistencia y horas extra del empleado' })
  findAttendance(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: AttendanceQueryDto,
  ) {
    return this.employeesService.findAttendance(id, query);
  }

  @Post(':id/attendance')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Registrar horas trabajadas y tiempo extra del empleado' })
  @ApiBody({ type: CreateAttendanceDto })
  createAttendance(
    @Param('id', ParseIntPipe) id: number,
    @Body() createAttendanceDto: CreateAttendanceDto,
    @Req() req: any,
  ) {
    return this.employeesService.createAttendance(id, createAttendanceDto, req.user.id);
  }

  @Post(':id/ledger/advance')
  @Roles('ADMIN', 'CAJERO')
  @ApiOperation({ summary: 'Registrar adelanto de sueldo' })
  @ApiBody({ type: CreateAdvanceDto })
  createAdvance(
    @Param('id', ParseIntPipe) id: number,
    @Body() createAdvanceDto: CreateAdvanceDto,
    @Req() req: any,
  ) {
    return this.employeesService.createAdvance(id, createAdvanceDto, req.user.id);
  }

  @Post(':id/ledger/debt')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Registrar deuda manual' })
  @ApiBody({ type: CreateDebtDto })
  createDebt(
    @Param('id', ParseIntPipe) id: number,
    @Body() createDebtDto: CreateDebtDto,
    @Req() req: any,
  ) {
    return this.employeesService.createDebt(id, createDebtDto, req.user.id);
  }

  @Post(':id/ledger/consumption')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Registrar consumo interno del empleado' })
  @ApiBody({ type: CreateConsumptionDto })
  createConsumption(
    @Param('id', ParseIntPipe) id: number,
    @Body() createConsumptionDto: CreateConsumptionDto,
    @Req() req: any,
  ) {
    return this.employeesService.createConsumption(id, createConsumptionDto, req.user.id);
  }

  @Get(':id/payroll-preview')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Previsualizar nómina manual de un empleado' })
  previewPayroll(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: ClosePayrollDto,
  ) {
    return this.payrollsService.preview(id, query);
  }

  @Post(':id/payrolls/close')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Cerrar nómina manual de un empleado' })
  @ApiBody({ type: ClosePayrollDto })
  closePayroll(
    @Param('id', ParseIntPipe) id: number,
    @Body() closePayrollDto: ClosePayrollDto,
    @Req() req: any,
  ) {
    return this.payrollsService.closePayroll(id, closePayrollDto, req.user.id);
  }
}
