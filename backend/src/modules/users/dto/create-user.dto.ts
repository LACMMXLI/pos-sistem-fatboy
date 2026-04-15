import { IsEmail, IsNotEmpty, MinLength, IsString, IsInt, IsOptional, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'juan@fatboy.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'cajero123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 2, description: 'ID del Rol (1: ADMIN, 2: CAJERO, 3: COCINA, 4: SUPERVISOR)' })
  @IsInt()
  @IsNotEmpty()
  roleId: number;

  @ApiProperty({
    example: '1024',
    required: false,
    description: 'PIN operativo de 4 dígitos para usuarios con rol MESERO',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/, { message: 'El PIN operativo debe contener exactamente 4 dígitos' })
  tabletPin?: string;
}
