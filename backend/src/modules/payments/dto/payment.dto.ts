import { IsInt, IsNumber, IsString, IsEnum, Min, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  TRANSFER = 'TRANSFER',
  OTHER = 'OTHER'
}

export class CreatePaymentDto {
  @ApiProperty({ example: 1, description: 'ID del pedido al que corresponde este pago' })
  @IsInt()
  orderId: number;

  @ApiProperty({ example: 'CASH', enum: PaymentMethod, description: 'Método de pago utilizado' })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiProperty({ example: 25.00, description: 'Monto total a pagar (monto de la orden)' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ example: 30.00, description: 'Monto recibido del cliente' })
  @IsNumber()
  @Min(0)
  receivedAmount: number;

  @ApiProperty({
    example: 'MXN',
    required: false,
    description: 'Moneda con la que entrega el cliente. MXN por defecto, USD cuando paga en dolares.',
  })
  @IsOptional()
  @IsString()
  paymentCurrency?: string;

  @ApiProperty({
    example: 20.15,
    required: false,
    description: 'Tipo de cambio usado cuando el cliente paga en USD y el sistema debe dar cambio en MXN.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  exchangeRate?: number;

  @ApiProperty({ example: 5.00, description: 'Monto de cambio entregado', required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  changeAmount?: number;
}
