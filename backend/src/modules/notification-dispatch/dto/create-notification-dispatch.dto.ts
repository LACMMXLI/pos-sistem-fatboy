import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class DispatchRecipientDto {
  @ApiProperty({ example: 'Gerencia' })
  @IsString()
  name: string;

  @ApiProperty({ example: '526641234567' })
  @IsString()
  phone: string;
}

export class CreateNotificationDispatchDto {
  @ApiProperty({ example: 'MANUAL_MESSAGE' })
  @IsString()
  type: string;

  @ApiProperty({ example: 'Mensaje de prueba' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'Este es un mensaje manual enviado al addon de WhatsApp.' })
  @IsOptional()
  @IsString()
  messageText?: string;

  @ApiPropertyOptional({ type: [DispatchRecipientDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DispatchRecipientDto)
  recipients?: DispatchRecipientDto[];

  @ApiPropertyOptional({ example: 'normal' })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({ example: 52 })
  @IsOptional()
  @IsInt()
  entityId?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  requiresAttachment?: boolean;
}
