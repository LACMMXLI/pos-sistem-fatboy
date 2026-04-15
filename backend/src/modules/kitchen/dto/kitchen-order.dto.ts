import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum KitchenStatus {
  PENDING = 'PENDING',
  PREPARING = 'PREPARING',
  READY = 'READY',
  COMPLETED = 'COMPLETED'
}

export class UpdateKitchenOrderStatusDto {
  @ApiProperty({ example: 'PREPARING', enum: KitchenStatus, description: 'Nuevo estado de la comanda en cocina' })
  @IsEnum(KitchenStatus)
  status: KitchenStatus;
}
