import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrderItemDto {
  @ApiProperty({ example: 1, description: 'ID del producto' })
  @IsInt()
  productId: number;

  @ApiProperty({ example: 2, description: 'Cantidad' })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 'Sin cebolla, bien cocido', description: 'Notas especiales para el ítem', required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({
    example: [1, 3],
    description: 'IDs de modificadores seleccionados para el producto',
    required: false,
    type: [Number],
  })
  @IsArray()
  @IsOptional()
  selectedModifierIds?: number[];

  @ApiProperty({
    example: 3,
    description: 'ID del producto canjeable cuando este renglón se cobra con puntos',
    required: false,
  })
  @IsInt()
  @IsOptional()
  redeemableProductId?: number;
}
