import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EmployeeLedgerEntryType } from '../../../prisma/client';

export class CreateAttendanceDto {
  @ApiProperty({ example: '2026-03-31', description: 'Fecha laborada en formato YYYY-MM-DD' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  workDate: string;

  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  hoursWorked: number;

  @ApiProperty({ example: 100, required: false, default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  overtimeRate?: number;

  @ApiProperty({ example: 'Se quedó 2 horas extra por cierre', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AttendanceQueryDto {
  @ApiProperty({ example: '2026-03-01', required: false })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;

  @ApiProperty({ example: '2026-03-31', required: false })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string;
}

export class CreateEmployeeDto {
  @ApiProperty({ example: 'Juan Perez' })
  @IsString()
  @MinLength(3)
  fullName: string;

  @ApiProperty({
    example: '4821',
    required: false,
    description: 'Clave única de 4 dígitos para checador; si se omite, el sistema la genera.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/)
  employeeCode?: string;

  @ApiProperty({ example: 1200 })
  @IsNumber()
  @Min(0)
  weeklySalary: number;

  @ApiProperty({ example: true, required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ example: 'Turno matutino', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateEmployeeDto {
  @ApiProperty({ example: 'Juan Perez', required: false })
  @IsOptional()
  @IsString()
  @MinLength(3)
  fullName?: string;

  @ApiProperty({ example: '4821', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/)
  employeeCode?: string;

  @ApiProperty({ example: 1200, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weeklySalary?: number;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ example: 'Turno matutino', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateAdvanceDto {
  @ApiProperty({ example: 200 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ example: 'Adelanto del miercoles', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2026-03-25T18:00:00.000Z', required: false })
  @IsOptional()
  @IsDateString()
  entryDate?: string;
}

export class CreateDebtDto {
  @ApiProperty({ example: 80 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ example: 'Prestamo personal o ajuste interno' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: '2026-03-25T18:00:00.000Z', required: false })
  @IsOptional()
  @IsDateString()
  entryDate?: string;
}

export class ConsumptionProductLineDto {
  @ApiProperty({ example: 12, required: false, description: 'Opcional para cargos manuales' })
  @IsOptional()
  @IsInt()
  productId?: number;

  @ApiProperty({ example: 'Coca Cola 600ml' })
  @IsString()
  @IsNotEmpty()
  productName: string;

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 40 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  unitPrice: number;
}

export class CreateConsumptionDto {
  @ApiProperty({ example: 'Consumo de la semana', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2026-03-25T18:00:00.000Z', required: false })
  @IsOptional()
  @IsDateString()
  entryDate?: string;

  @ApiProperty({ type: [ConsumptionProductLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConsumptionProductLineDto)
  items: ConsumptionProductLineDto[];
}

export class PayrollPreviewQueryDto {
  @ApiProperty({ example: '2026-03-18', description: 'Fecha inicial en formato YYYY-MM-DD' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  periodStart: string;

  @ApiProperty({ example: '2026-03-25', description: 'Fecha final en formato YYYY-MM-DD' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  periodEnd: string;
}

export class ClosePayrollDto extends PayrollPreviewQueryDto {}

export class LedgerQueryDto {
  @ApiProperty({ enum: EmployeeLedgerEntryType, required: false })
  @IsOptional()
  @IsEnum(EmployeeLedgerEntryType)
  type?: EmployeeLedgerEntryType;

  @ApiProperty({ example: '2026-03-01', required: false })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;

  @ApiProperty({ example: '2026-03-31', required: false })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string;
}
