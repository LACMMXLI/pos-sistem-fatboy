import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe, Query } from '@nestjs/common';
import { CustomersService } from './customers.service';
import {
  CreateCustomerAddressDto,
  CreateCustomerDto,
  UpdateCustomerAddressDto,
  UpdateCustomerDto,
} from './dto/customer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiBody } from '@nestjs/swagger';
import { LoyaltyService } from '../loyalty/loyalty.service';

@ApiTags('Customers')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly loyaltyService: LoyaltyService,
  ) {}

  @Post()
  @Roles('ADMIN', 'CAJERO', 'MESERO')
  @ApiOperation({ summary: 'Registrar un nuevo cliente' })
  @ApiBody({ type: CreateCustomerDto })
  @ApiResponse({ status: 201, description: 'Cliente registrado exitosamente.' })
  create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customersService.create(createCustomerDto);
  }

  @Get()
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO', 'MESERO')
  @ApiOperation({ summary: 'Obtener lista de clientes' })
  @ApiQuery({ name: 'phone', required: false, type: String, description: 'Buscar por teléfono' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Buscar por nombre o teléfono' })
  findAll(@Query('phone') phone?: string, @Query('search') search?: string) {
    if (phone) {
      return this.customersService.findByPhone(phone);
    }
    return this.customersService.findAll(search);
  }

  @Get(':id')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO', 'MESERO')
  @ApiOperation({ summary: 'Obtener un cliente por ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.customersService.findOne(id);
  }

  @Get(':id/loyalty')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO', 'MESERO')
  @ApiOperation({ summary: 'Obtener resumen de fidelizacion del cliente' })
  getLoyalty(@Param('id', ParseIntPipe) id: number) {
    return this.loyaltyService.getCustomerLoyaltySummary(id);
  }

  @Get(':id/orders')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO', 'MESERO')
  @ApiOperation({ summary: 'Obtener historial de pedidos de un cliente' })
  findOrders(@Param('id', ParseIntPipe) id: number) {
    return this.customersService.findOrders(id);
  }

  @Get(':id/addresses')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO', 'MESERO')
  @ApiOperation({ summary: 'Listar domicilios del cliente' })
  findAddresses(@Param('id', ParseIntPipe) id: number) {
    return this.customersService.findAddresses(id);
  }

  @Post(':id/addresses')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO', 'MESERO')
  @ApiOperation({ summary: 'Registrar un domicilio para el cliente' })
  @ApiBody({ type: CreateCustomerAddressDto })
  createAddress(
    @Param('id', ParseIntPipe) id: number,
    @Body() createCustomerAddressDto: CreateCustomerAddressDto,
  ) {
    return this.customersService.createAddress(id, createCustomerAddressDto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO')
  @ApiOperation({ summary: 'Actualizar datos de un cliente' })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateCustomerDto: UpdateCustomerDto) {
    return this.customersService.update(id, updateCustomerDto);
  }

  @Patch(':id/addresses/:addressId')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO')
  @ApiOperation({ summary: 'Actualizar un domicilio del cliente' })
  updateAddress(
    @Param('id', ParseIntPipe) id: number,
    @Param('addressId', ParseIntPipe) addressId: number,
    @Body() updateCustomerAddressDto: UpdateCustomerAddressDto,
  ) {
    return this.customersService.updateAddress(id, addressId, updateCustomerAddressDto);
  }

  @Delete(':id/addresses/:addressId')
  @Roles('ADMIN', 'SUPERVISOR')
  @ApiOperation({ summary: 'Eliminar un domicilio del cliente' })
  removeAddress(
    @Param('id', ParseIntPipe) id: number,
    @Param('addressId', ParseIntPipe) addressId: number,
  ) {
    return this.customersService.removeAddress(id, addressId);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Eliminar un cliente' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.customersService.remove(id);
  }
}
