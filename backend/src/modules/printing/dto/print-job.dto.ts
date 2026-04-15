import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PRINT_DOCUMENT_TYPES, PRINT_PAPER_WIDTHS } from '../print-documents';

export class CreatePrintJobDto {
  @ApiProperty({ enum: PRINT_DOCUMENT_TYPES })
  @IsString()
  @IsIn(PRINT_DOCUMENT_TYPES)
  documentType: string;

  @ApiProperty()
  @IsString()
  entityType: string;

  @ApiProperty()
  @IsString()
  entityId: string;

  @ApiPropertyOptional({ enum: PRINT_PAPER_WIDTHS })
  @IsOptional()
  @IsString()
  @IsIn(PRINT_PAPER_WIDTHS)
  paperWidth?: '58' | '80';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  printerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  copies?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  reprint?: boolean;
}

export class UpdatePrintJobStatusDto {
  @ApiProperty({ enum: ['processing', 'printed', 'failed', 'cancelled'] })
  @IsString()
  @IsIn(['processing', 'printed', 'failed', 'cancelled'])
  status: 'processing' | 'printed' | 'failed' | 'cancelled';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  printerName?: string;
}
