import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class DispatchResultDto {
  @ApiProperty({ example: 'sent' })
  @IsString()
  status: string;

  @ApiPropertyOptional({ example: 'wamid.xxxx' })
  @IsOptional()
  @IsString()
  providerMessageId?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  attempts?: number;

  @ApiPropertyOptional({ example: null })
  @IsOptional()
  @IsString()
  error?: string;
}
