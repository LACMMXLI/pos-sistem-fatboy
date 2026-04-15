import { IsEmail, IsOptional, IsString, IsInt, IsBoolean, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Juan Pérez García' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'juan.perez@fatboy.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 4, description: 'ID del Rol (1: ADMIN, 2: CAJERO, 3: COCINA, 4: SUPERVISOR)' })
  @IsInt()
  @IsOptional()
  roleId?: number;

  @ApiPropertyOptional({ example: false, description: 'Desactivar o activar el usuario' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: '1024',
    description: 'PIN operativo de 4 dígitos para usuarios con rol MESERO',
  })
  @IsString()
  @IsOptional()
  @Matches(/^\d{4}$/, { message: 'El PIN operativo debe contener exactamente 4 dígitos' })
  tabletPin?: string;
}
