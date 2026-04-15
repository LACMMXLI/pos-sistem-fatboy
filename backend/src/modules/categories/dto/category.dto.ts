import { IsString, IsInt, IsBoolean, IsOptional, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Bebidas', description: 'Nombre de la categoría' })
  @IsString()
  @MinLength(3)
  name: string;

  @ApiProperty({ example: 1, description: 'Orden de visualización en el frontend', required: false, default: 0 })
  @IsInt()
  @IsOptional()
  displayOrder?: number;

  @ApiProperty({ example: true, description: 'Estado de la categoría', required: false, default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateCategoryDto {
  @ApiProperty({ example: 'Bebidas Frías', description: 'Nombre de la categoría', required: false })
  @IsString()
  @IsOptional()
  @MinLength(3)
  name?: string;

  @ApiProperty({ example: 2, description: 'Orden de visualización en el frontend', required: false })
  @IsInt()
  @IsOptional()
  displayOrder?: number;

  @ApiProperty({ example: false, description: 'Estado de la categoría', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
