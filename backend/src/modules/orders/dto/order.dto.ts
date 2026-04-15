import { IsString, IsArray, IsEnum, IsOptional, ValidateNested, IsNotEmpty, IsNumber, Min, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CreateOrderItemDto } from './order-item.dto';
import { PaymentMethod } from '../../payments/dto/payment.dto';

export enum OrderStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  READY = 'READY',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID'
}

export enum OrderType {
  DINE_IN = 'DINE_IN',
  TAKE_AWAY = 'TAKE_AWAY',
  DELIVERY = 'DELIVERY'
}

export class ImmediatePaymentDto {
  @ApiProperty({ example: 'CASH', enum: PaymentMethod, description: 'Método de pago utilizado' })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiProperty({ example: 25.00, description: 'Monto a cobrar en la operación' })
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
    description: 'Moneda recibida del cliente. Usa USD cuando se cobra en dolares.',
  })
  @IsOptional()
  @IsString()
  paymentCurrency?: string;

  @ApiProperty({
    example: 20.15,
    required: false,
    description: 'Tipo de cambio usado cuando el cliente paga en dolares y el cambio se entrega en MXN.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  exchangeRate?: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 15, description: 'ID del cliente registrado', required: false })
  @IsOptional()
  @IsNumber()
  customerId?: number;

  @ApiProperty({ example: 4, description: 'ID del domicilio del cliente', required: false })
  @IsOptional()
  @IsNumber()
  customerAddressId?: number;

  @ApiProperty({ example: 'Juan Pérez', description: 'Nombre del cliente', required: false })
  @IsString()
  @IsOptional()
  customerName?: string;

  @ApiProperty({ example: '6641234567', description: 'Teléfono del cliente', required: false })
  @IsString()
  @IsOptional()
  customerPhone?: string;

  @ApiProperty({
    example: {
      street: 'Av. Siempre Viva',
      exteriorNumber: '742',
      neighborhood: 'Centro',
      city: 'Tijuana',
      state: 'BC',
      references: 'Casa color azul',
    },
    description: 'Domicilio manual para pedidos a domicilio',
    required: false,
  })
  @IsOptional()
  deliveryAddress?: Record<string, any>;

  @ApiProperty({ example: 'DINE_IN', enum: OrderType, description: 'Tipo de pedido' })
  @IsEnum(OrderType)
  orderType: OrderType;

  @ApiProperty({ example: 1, description: 'ID del mesero asignado', required: false })
  @IsOptional()
  waiterId?: number;

  @ApiProperty({ example: 5, description: 'ID de la mesa asignada', required: false })
  @IsOptional()
  tableId?: number;
  
  @ApiProperty({ example: 10, description: 'ID del turno de caja al que pertenece la orden', required: false })
  @IsOptional()
  @IsNumber()
  shiftId?: number;

  @ApiProperty({ type: [CreateOrderItemDto], description: 'Lista de productos del pedido' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @ApiProperty({
    example: false,
    required: false,
    description: 'Si es true, los productos se guardan en borrador y no se envían automáticamente a cocina',
  })
  @IsOptional()
  @IsBoolean()
  manualSubmit?: boolean;

  @ApiProperty({
    type: ImmediatePaymentDto,
    required: false,
    description: 'Pago inmediato requerido para servicio rápido',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ImmediatePaymentDto)
  payment?: ImmediatePaymentDto;
}

export class AddItemsDto {
  @ApiProperty({ type: [CreateOrderItemDto], description: 'Lista de productos a añadir al pedido' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  @IsNotEmpty()
  items: CreateOrderItemDto[];

  @ApiProperty({
    example: false,
    required: false,
    description: 'Si es true, los productos se agregan como borrador y no se envían automáticamente a cocina',
  })
  @IsOptional()
  @IsBoolean()
  manualSubmit?: boolean;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ example: 'PREPARING', enum: OrderStatus, description: 'Nuevo estado del pedido' })
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @ApiProperty({
    example: 'admin123',
    required: false,
    description: 'Contraseña de un usuario administrador requerida para cancelar una orden',
  })
  @IsOptional()
  @IsString()
  adminPassword?: string;
}
