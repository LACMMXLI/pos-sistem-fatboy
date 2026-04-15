import { IsNumber, IsString, IsOptional, Min, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OpenCashShiftDto {
  @ApiProperty({ example: 50.00, description: 'Monto con el que se abre la caja' })
  @IsNumber()
  @Min(0)
  openingAmount: number;
}

export class CloseCashShiftDto {
  @ApiProperty({ example: 450.00, description: 'Monto real en efectivo en caja al momento del cierre' })
  @IsNumber()
  @Min(0)
  closingAmount: number;

  @ApiProperty({ example: 20.00, description: 'Monto real en dolares dentro de la caja al momento del cierre', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  closingUsdAmount?: number;

  @ApiProperty({ example: 200.00, description: 'Monto total reportado por la terminal de tarjeta', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  closingCardAmount?: number;
}

export enum MovementType {
  IN = 'IN',
  OUT = 'OUT'
}

export class CreateCashMovementDto {
  @ApiProperty({ example: 'IN', enum: MovementType, description: 'Tipo de movimiento (Entrada/Salida)' })
  @IsEnum(MovementType)
  movementType: MovementType;

  @ApiProperty({ example: 20.00, description: 'Monto del movimiento' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ example: 'Venta rápida o Pago a proveedor', description: 'Razón del movimiento' })
  @IsString()
  reason: string;
}

export class SendCashShiftEmailDto {
  @ApiProperty({ example: 'gerencia@negocio.com', required: false, description: 'Correo principal. Si se omite, usa la configuracion guardada.' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiProperty({ example: 'dueno@negocio.com,contador@negocio.com', required: false, description: 'Correos en copia separados por coma.' })
  @IsOptional()
  @IsString()
  cc?: string;
}

export class TestCashShiftEmailDto {
  @ApiProperty({ example: 'smtp.tudominio.com', required: false })
  @IsOptional()
  @IsString()
  shiftEmailHost?: string;

  @ApiProperty({ example: 587, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  shiftEmailPort?: number;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  shiftEmailSecure?: boolean;

  @ApiProperty({ example: 'usuario@dominio.com', required: false })
  @IsOptional()
  @IsString()
  shiftEmailUser?: string;

  @ApiProperty({ example: 'super-secret', required: false })
  @IsOptional()
  @IsString()
  shiftEmailPassword?: string;

  @ApiProperty({ example: 'cortes@negocio.com', required: false })
  @IsOptional()
  @IsString()
  shiftEmailFrom?: string;

  @ApiProperty({ example: 'gerencia@negocio.com', required: false })
  @IsOptional()
  @IsString()
  shiftEmailTo?: string;

  @ApiProperty({ example: 'dueno@negocio.com,contador@negocio.com', required: false })
  @IsOptional()
  @IsString()
  shiftEmailCc?: string;
}
