import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PRINT_BLOCK_KEYS,
  PRINT_DOCUMENT_TYPES,
  PRINT_PAPER_WIDTHS,
} from '../print-documents';

export class PrintTemplateSectionDto {
  @ApiProperty({ enum: PRINT_BLOCK_KEYS })
  @IsString()
  @IsIn(PRINT_BLOCK_KEYS)
  key: string;

  @ApiProperty()
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  visibleWhen?: string | null;

  @ApiProperty()
  @IsInt()
  @Min(0)
  order: number;

  @ApiProperty({ enum: ['left', 'center', 'right'] })
  @IsIn(['left', 'center', 'right'])
  alignment: 'left' | 'center' | 'right';

  @ApiProperty({ enum: ['small', 'normal', 'large', 'xlarge'] })
  @IsIn(['small', 'normal', 'large', 'xlarge'])
  fontSize: 'small' | 'normal' | 'large' | 'xlarge';

  @ApiProperty()
  @IsBoolean()
  bold: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  dividerBefore?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  dividerAfter?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customLabel?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  spacing?: number;

  @ApiPropertyOptional({ enum: ['58', '80', 'auto'] })
  @IsOptional()
  @IsIn(['58', '80', 'auto'])
  maxWidth?: '58' | '80' | 'auto';

  @ApiPropertyOptional({ enum: ['currency', 'percentage', 'text', null] })
  @IsOptional()
  @IsIn(['currency', 'percentage', 'text'])
  format?: 'currency' | 'percentage' | 'text' | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  options?: Record<string, unknown>;
}

export class CreatePrintTemplateDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: PRINT_DOCUMENT_TYPES })
  @IsString()
  @IsIn(PRINT_DOCUMENT_TYPES)
  documentType: string;

  @ApiProperty({ enum: PRINT_PAPER_WIDTHS })
  @IsString()
  @IsIn(PRINT_PAPER_WIDTHS)
  paperWidth: '58' | '80';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  templateKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiProperty({ type: [PrintTemplateSectionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PrintTemplateSectionDto)
  sections: PrintTemplateSectionDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  printerRouting?: Record<string, unknown> | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  fixedTexts?: Record<string, unknown> | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}

export class UpdatePrintTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ type: [PrintTemplateSectionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PrintTemplateSectionDto)
  sections?: PrintTemplateSectionDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  printerRouting?: Record<string, unknown> | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  fixedTexts?: Record<string, unknown> | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}

export class PrintTemplatePreviewDto {
  @ApiProperty({ enum: PRINT_DOCUMENT_TYPES })
  @IsString()
  @IsIn(PRINT_DOCUMENT_TYPES)
  documentType: string;

  @ApiProperty({ enum: PRINT_PAPER_WIDTHS })
  @IsString()
  @IsIn(PRINT_PAPER_WIDTHS)
  paperWidth: '58' | '80';

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  templateId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  orderId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  shiftId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  cashMovementId?: number;

  @ApiPropertyOptional({ type: [PrintTemplateSectionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrintTemplateSectionDto)
  sections?: PrintTemplateSectionDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  fixedTexts?: Record<string, unknown> | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
