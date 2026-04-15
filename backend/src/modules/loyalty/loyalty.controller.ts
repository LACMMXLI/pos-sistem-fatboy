import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FindOrCreateCustomerDto, RedeemPointsDto, RedeemProductDto } from './dto/loyalty.dto';
import { LoyaltyService } from './loyalty.service';

@ApiTags('Loyalty')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Post('customers/find-or-create')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO', 'MESERO')
  @ApiOperation({ summary: 'Buscar o crear cliente para fidelizacion por telefono' })
  @ApiBody({ type: FindOrCreateCustomerDto })
  @ApiResponse({ status: 201, description: 'Cliente resuelto correctamente.' })
  findOrCreateCustomer(@Body() dto: FindOrCreateCustomerDto) {
    return this.loyaltyService.findOrCreateCustomer(dto.phone, dto.name);
  }

  @Get('customers/phone/:phone')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO', 'MESERO')
  @ApiOperation({ summary: 'Obtener cliente por telefono para fidelizacion' })
  findCustomerByPhone(@Param('phone') phone: string) {
    return this.loyaltyService.getCustomerByPhone(phone);
  }

  @Get('customers/:id/points')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO', 'MESERO')
  @ApiOperation({ summary: 'Consultar saldo de puntos del cliente' })
  getCustomerPoints(@Param('id', ParseIntPipe) id: number) {
    return this.loyaltyService.getCustomerPoints(id);
  }

  @Post('loyalty/redeem')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO')
  @ApiOperation({ summary: 'Canjear puntos del cliente' })
  @ApiBody({ type: RedeemPointsDto })
  redeemPoints(@Body() dto: RedeemPointsDto) {
    return this.loyaltyService.redeemPoints(dto.customerId, dto.points, dto.description);
  }

  @Post('loyalty/redeem-product')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO', 'MESERO')
  @ApiOperation({ summary: 'Canjear producto usando puntos del cliente' })
  @ApiBody({ type: RedeemProductDto })
  redeemProduct(@Body() dto: RedeemProductDto, @Req() req: any) {
    return this.loyaltyService.redeemProduct(dto, req.user);
  }
}
