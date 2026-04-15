import { IsString, IsBoolean, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAreaDto {
  @ApiProperty({ example: 'Terraza', description: 'Nombre del área o salón' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: true, description: 'Estado de activación', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateAreaDto {
  @ApiProperty({ example: 'Terraza Principal', description: 'Nombre del área o salón', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: true, description: 'Estado de activación', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
