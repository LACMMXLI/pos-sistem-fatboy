import { IsString, IsNotEmpty, IsOptional, IsObject, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ExternalSource {
  WHATSAPP = 'WHATSAPP',
  UBER_EATS = 'UBER_EATS',
  RAPPI = 'RAPPI',
  WEB_ORDER = 'WEB_ORDER',
  OTHER = 'OTHER'
}

export class CreateExternalOrderDto {
  @ApiProperty({ example: 'WHATSAPP', enum: ExternalSource, description: 'Fuente del pedido' })
  @IsEnum(ExternalSource)
  @IsNotEmpty()
  externalSource: ExternalSource;

  @ApiProperty({ example: 'wa_12345', description: 'ID original de la fuente externa', required: false })
  @IsString()
  @IsOptional()
  externalOrderId?: string;

  @ApiProperty({ example: 'María López', description: 'Nombre del cliente en la fuente externa', required: false })
  @IsString()
  @IsOptional()
  customerName?: string;

  @ApiProperty({ example: { items: [], total: 50.0 }, description: 'Payload original del pedido' })
  @IsObject()
  @IsNotEmpty()
  payload: any;
}

export class UpdateExternalOrderStatusDto {
  @ApiProperty({ example: 'ACCEPTED', description: 'Nuevo estado del pedido externo' })
  @IsString()
  @IsNotEmpty()
  status: string;
}
