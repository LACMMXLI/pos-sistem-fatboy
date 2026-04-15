import { IsString, IsNumber, IsBoolean, IsOptional, MinLength, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ example: 'Hamburguesa Doble', description: 'Nombre del producto' })
  @IsString()
  @MinLength(3)
  name: string;

  @ApiProperty({ example: 'Deliciosa hamburguesa con doble carne y queso', description: 'Descripción del producto', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 12.50, description: 'Precio del producto' })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ example: 1, description: 'ID de la categoría' })
  @IsInt()
  categoryId: number;

  @ApiProperty({ example: 'https://example.com/hamburguesa.jpg', description: 'URL de la imagen del producto', required: false })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({ example: 'burger', description: 'Icono de respaldo para mostrar si el producto no tiene imagen', required: false })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiProperty({ example: true, description: 'Disponibilidad del producto', required: false, default: true })
  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;
}

export class UpdateProductDto {
  @ApiProperty({ example: 'Hamburguesa Triple', description: 'Nombre del producto', required: false })
  @IsString()
  @IsOptional()
  @MinLength(3)
  name?: string;

  @ApiProperty({ example: 'Ahora con más queso', description: 'Descripción del producto', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 15.00, description: 'Precio del producto', required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  price?: number;

  @ApiProperty({ example: 1, description: 'ID de la categoría', required: false })
  @IsInt()
  @IsOptional()
  categoryId?: number;

  @ApiProperty({ example: 'https://example.com/hamburguesa.jpg', description: 'URL de la imagen del producto', required: false })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({ example: 'burger', description: 'Icono de respaldo para mostrar si el producto no tiene imagen', required: false })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiProperty({ example: false, description: 'Disponibilidad del producto', required: false })
  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;
}

export class CreateRedeemableProductDto {
  @ApiProperty({ example: 1, description: 'ID del producto base que se podrá canjear' })
  @IsInt()
  productId: number;

  @ApiProperty({ example: 120, description: 'Puntos necesarios para canjear el producto' })
  @IsInt()
  @Min(1)
  pointsCost: number;

  @ApiProperty({ example: true, description: 'Disponibilidad del canje', required: false, default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateRedeemableProductDto {
  @ApiProperty({ example: 1, description: 'ID del producto base', required: false })
  @IsInt()
  @IsOptional()
  productId?: number;

  @ApiProperty({ example: 200, description: 'Nuevo costo en puntos', required: false })
  @IsInt()
  @IsOptional()
  @Min(1)
  pointsCost?: number;

  @ApiProperty({ example: false, description: 'Si el canje está activo', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
