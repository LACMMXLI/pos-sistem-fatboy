import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, Matches } from 'class-validator';
import { PayrollStatus } from '../../../prisma/client';

export class PayrollListQueryDto {
  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  employeeId?: string;

  @ApiProperty({ enum: PayrollStatus, required: false })
  @IsOptional()
  @IsEnum(PayrollStatus)
  status?: PayrollStatus;

  @ApiProperty({ example: '2026-03-01', required: false })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;

  @ApiProperty({ example: '2026-03-31', required: false })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string;
}
