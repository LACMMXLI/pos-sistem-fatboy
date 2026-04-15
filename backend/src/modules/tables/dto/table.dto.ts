import { IsString, IsBoolean, IsOptional, IsNotEmpty, IsNumber, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum TableStatus {
  AVAILABLE = 'AVAILABLE',
  OCCUPIED = 'OCCUPIED',
  ACCOUNT_PRINTED = 'ACCOUNT_PRINTED',
  RESERVED = 'RESERVED'
}

export class CreateTableDto {
  @ApiProperty({ example: 'Mesa 1', description: 'Nombre o número de la mesa' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 1, description: 'ID del área a la que pertenece' })
  @IsNumber()
  @IsNotEmpty()
  areaId: number;

  @ApiProperty({ example: 'AVAILABLE', enum: TableStatus, description: 'Estado inicial', required: false })
  @IsEnum(TableStatus)
  @IsOptional()
  status?: TableStatus;

  @ApiProperty({ example: true, description: 'Si está activa para operaciones', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateTableDto {
  @ApiProperty({ example: 'Mesa 1 VIP', description: 'Nombre o número de la mesa', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 1, description: 'ID del área a la que pertenece', required: false })
  @IsNumber()
  @IsOptional()
  areaId?: number;

  @ApiProperty({ example: 'AVAILABLE', enum: TableStatus, description: 'Estado', required: false })
  @IsEnum(TableStatus)
  @IsOptional()
  status?: TableStatus;

  @ApiProperty({ example: true, description: 'Si está activa para operaciones', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateTableStatusDto {
  @ApiProperty({ example: 'OCCUPIED', enum: TableStatus, description: 'Nuevo estado de la mesa' })
  @IsEnum(TableStatus)
  @IsNotEmpty()
  status: TableStatus;
}
