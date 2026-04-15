import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCustomerAddressDto {
  @ApiProperty({ example: 'Casa', required: false })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({ example: 'Carlos Gaviria', required: false })
  @IsOptional()
  @IsString()
  recipientName?: string;

  @ApiProperty({ example: '+573001234567', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'Av. Principal 123' })
  @IsString()
  @MinLength(3)
  street: string;

  @ApiProperty({ example: '12A', required: false })
  @IsOptional()
  @IsString()
  exteriorNumber?: string;

  @ApiProperty({ example: '3', required: false })
  @IsOptional()
  @IsString()
  interiorNumber?: string;

  @ApiProperty({ example: 'Centro', required: false })
  @IsOptional()
  @IsString()
  neighborhood?: string;

  @ApiProperty({ example: 'Tijuana', required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ example: 'Baja California', required: false })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ example: '22000', required: false })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiProperty({ example: 'Casa azul con portón negro', required: false })
  @IsOptional()
  @IsString()
  references?: string;

  @ApiProperty({ example: false, required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateCustomerAddressDto {
  @ApiProperty({ example: 'Trabajo', required: false })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({ example: 'Carlos Gaviria', required: false })
  @IsOptional()
  @IsString()
  recipientName?: string;

  @ApiProperty({ example: '+573001234567', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'Av. Principal 123', required: false })
  @IsOptional()
  @IsString()
  @MinLength(3)
  street?: string;

  @ApiProperty({ example: '12A', required: false })
  @IsOptional()
  @IsString()
  exteriorNumber?: string;

  @ApiProperty({ example: '3', required: false })
  @IsOptional()
  @IsString()
  interiorNumber?: string;

  @ApiProperty({ example: 'Centro', required: false })
  @IsOptional()
  @IsString()
  neighborhood?: string;

  @ApiProperty({ example: 'Tijuana', required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ example: 'Baja California', required: false })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ example: '22000', required: false })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiProperty({ example: 'Casa azul con portón negro', required: false })
  @IsOptional()
  @IsString()
  references?: string;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class CreateCustomerDto {
  @ApiProperty({ example: 'Carlos Gaviria', description: 'Nombre del cliente' })
  @IsString()
  @MinLength(3)
  name: string;

  @ApiProperty({ example: '+573001234567', description: 'Teléfono de contacto', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'Cliente frecuente, prefiere pagar con tarjeta', required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ type: [CreateCustomerAddressDto], required: false })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateCustomerAddressDto)
  addresses?: CreateCustomerAddressDto[];
}

export class UpdateCustomerDto {
  @ApiProperty({ example: 'Carlos Alberto Gaviria', description: 'Nombre del cliente', required: false })
  @IsString()
  @IsOptional()
  @MinLength(3)
  name?: string;

  @ApiProperty({ example: '+573111234567', description: 'Teléfono de contacto', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'Prefiere llamada al llegar', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
