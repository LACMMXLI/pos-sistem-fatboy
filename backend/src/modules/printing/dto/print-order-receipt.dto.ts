import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PrintOrderReceiptDto {
  @ApiPropertyOptional({ enum: ['CLIENT', 'KITCHEN'], default: 'CLIENT' })
  @IsOptional()
  @IsIn(['CLIENT', 'KITCHEN'])
  type?: 'CLIENT' | 'KITCHEN';

  @ApiPropertyOptional({ description: 'Nombre de impresora instalado en Windows' })
  @IsOptional()
  @IsString()
  printerName?: string;

  @ApiPropertyOptional({ enum: ['58', '80'], default: '80' })
  @IsOptional()
  @IsIn(['58', '80'])
  paperWidth?: '58' | '80';

  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  copies?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  openDrawer?: boolean;
}
