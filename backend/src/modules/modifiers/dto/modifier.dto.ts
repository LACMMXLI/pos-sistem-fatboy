import { IsString, IsNumber, IsInt, MinLength, Min, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateModifierDto {
  @ApiProperty({ example: 'Extra Queso', description: 'Nombre del modificador' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 1.50, description: 'Precio adicional del modificador' })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ example: 1, description: 'ID del producto al que pertenece' })
  @IsInt()
  productId: number;
}

export class UpdateModifierDto {
  @ApiProperty({ example: 'Sin Cebolla', description: 'Nombre del modificador', required: false })
  @IsString()
  @IsOptional()
  @MinLength(2)
  name?: string;

  @ApiProperty({ example: 0.00, description: 'Precio adicional del modificador', required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  price?: number;
}
