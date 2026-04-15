import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class FindOrCreateCustomerDto {
  @ApiProperty({ example: '6641234567', description: 'Telefono del cliente' })
  @IsString()
  @MinLength(7)
  phone: string;

  @ApiProperty({ example: 'Juan Perez', required: false, description: 'Nombre opcional del cliente' })
  @IsOptional()
  @IsString()
  name?: string;
}

export class RedeemPointsDto {
  @ApiProperty({ example: 15, description: 'ID del cliente' })
  @IsInt()
  customerId: number;

  @ApiProperty({ example: 20, description: 'Puntos a canjear' })
  @IsInt()
  @Min(1)
  points: number;

  @ApiProperty({ example: 'Canje en caja', required: false, description: 'Descripcion opcional del canje' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class RedeemProductDto {
  @ApiProperty({ example: 15, description: 'ID del cliente' })
  @IsInt()
  customerId: number;

  @ApiProperty({ example: 3, description: 'ID del producto canjeable' })
  @IsInt()
  redeemableProductId: number;

  @ApiProperty({ example: 2, description: 'Cantidad a canjear', required: false, default: 1 })
  @IsInt()
  @IsOptional()
  @Min(1)
  quantity?: number;

  @ApiProperty({ example: 'Canje en caja principal', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
