import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import {
  CreateProductDto,
  CreateRedeemableProductDto,
  UpdateProductDto,
  UpdateRedeemableProductDto,
} from './dto/product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiBody } from '@nestjs/swagger';

@ApiTags('Products')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles('ADMIN', 'CAJERO')
  @ApiOperation({ summary: 'Crear un nuevo producto (Solo ADMIN)' })
  @ApiBody({ type: CreateProductDto })
  @ApiResponse({ status: 201, description: 'Producto creado exitosamente.' })
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO', 'MESERO')
  @ApiOperation({ summary: 'Obtener todos los productos' })
  @ApiQuery({ name: 'categoryId', required: false, type: Number, description: 'Filtrar por ID de categoría' })
  @ApiResponse({ status: 200, description: 'Lista de productos obtenida.' })
  findAll(@Query('categoryId') categoryId?: string) {
    if (categoryId) {
      return this.productsService.findByCategory(+categoryId);
    }
    return this.productsService.findAll();
  }

  @Get('redeemable')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO', 'MESERO')
  @ApiOperation({ summary: 'Obtener todos los productos canjeables' })
  findRedeemable() {
    return this.productsService.findAllRedeemable();
  }

  @Post('redeemable')
  @Roles('ADMIN', 'CAJERO')
  @ApiOperation({ summary: 'Crear un producto canjeable' })
  createRedeemable(@Body() createRedeemableProductDto: CreateRedeemableProductDto) {
    return this.productsService.createRedeemable(createRedeemableProductDto);
  }

  @Patch('redeemable/:id')
  @Roles('ADMIN', 'CAJERO')
  @ApiOperation({ summary: 'Actualizar un producto canjeable' })
  updateRedeemable(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRedeemableProductDto: UpdateRedeemableProductDto,
  ) {
    return this.productsService.updateRedeemable(id, updateRedeemableProductDto);
  }

  @Delete('redeemable/:id')
  @Roles('ADMIN', 'CAJERO')
  @ApiOperation({ summary: 'Eliminar un producto canjeable' })
  removeRedeemable(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.removeRedeemable(id);
  }

  @Get(':id')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO', 'MESERO')
  @ApiOperation({ summary: 'Obtener un producto por ID' })
  @ApiResponse({ status: 200, description: 'Producto encontrado.' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'CAJERO')
  @ApiOperation({ summary: 'Actualizar un producto (Solo ADMIN)' })
  @ApiBody({ type: UpdateProductDto })
  @ApiResponse({ status: 200, description: 'Producto actualizado exitosamente.' })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'CAJERO')
  @ApiOperation({ summary: 'Eliminar un producto (Solo ADMIN)' })
  @ApiResponse({ status: 200, description: 'Producto eliminado exitosamente.' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.remove(id);
  }
}
