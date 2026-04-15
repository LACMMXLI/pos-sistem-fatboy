import { Injectable, NotFoundException, InternalServerErrorException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateProductDto,
  CreateRedeemableProductDto,
  UpdateProductDto,
  UpdateRedeemableProductDto,
} from './dto/product.dto';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(private prisma: PrismaService) {}

  async create(createProductDto: CreateProductDto) {
    try {
      // Verify category exists
      const category = await this.prisma.category.findUnique({
        where: { id: createProductDto.categoryId },
      });

      if (!category) {
        throw new BadRequestException(`La categoría con ID ${createProductDto.categoryId} no existe`);
      }

      return await this.prisma.product.create({
        data: {
          name: createProductDto.name,
          description: createProductDto.description,
          price: createProductDto.price,
          categoryId: createProductDto.categoryId,
          imageUrl: createProductDto.imageUrl,
          icon: createProductDto.icon,
          isAvailable: createProductDto.isAvailable ?? true,
        },
        include: {
          category: true,
        },
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      
      this.logger.error(`Error creating product: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al crear el producto');
    }
  }

  async findAll() {
    return this.prisma.product.findMany({
      include: {
        category: true,
        modifiers: true,
        redeemableProduct: true,
      },
    });
  }

  async findByCategory(categoryId: number) {
    return this.prisma.product.findMany({
      where: { categoryId },
      include: {
        category: true,
        modifiers: true,
        redeemableProduct: true,
      },
    });
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        modifiers: true,
        redeemableProduct: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }

    return product;
  }

  async update(id: number, updateProductDto: UpdateProductDto) {
    try {
      // Check if exists
      await this.findOne(id);

      // If categoryId is provided, verify it exists
      if (updateProductDto.categoryId) {
        const category = await this.prisma.category.findUnique({
          where: { id: updateProductDto.categoryId },
        });
        if (!category) {
          throw new BadRequestException(`La categoría con ID ${updateProductDto.categoryId} no existe`);
        }
      }

      return await this.prisma.product.update({
        where: { id },
        data: updateProductDto,
        include: {
          category: true,
          redeemableProduct: true,
        },
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error updating product: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al actualizar el producto');
    }
  }

  async remove(id: number) {
    try {
      await this.findOne(id);
      
      // Note: Ideally check for order history before deleting, but keeping it simple for now as per base schema
      return await this.prisma.product.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error deleting product: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al eliminar el producto');
    }
  }

  async findAllRedeemable() {
    return this.prisma.redeemableProduct.findMany({
      include: {
        product: {
          include: {
            category: true,
          },
        },
      },
      orderBy: [{ isActive: 'desc' }, { pointsCost: 'asc' }, { id: 'asc' }],
    });
  }

  private async validateRedeemableTarget(productId: number, currentRedeemableId?: number) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        redeemableProduct: true,
      },
    });

    if (!product) {
      throw new BadRequestException(`El producto con ID ${productId} no existe`);
    }

    if (product.redeemableProduct && product.redeemableProduct.id !== currentRedeemableId) {
      throw new BadRequestException('Este producto ya está configurado como canjeable');
    }

    return product;
  }

  async createRedeemable(createRedeemableProductDto: CreateRedeemableProductDto) {
    try {
      await this.validateRedeemableTarget(createRedeemableProductDto.productId);

      return await this.prisma.redeemableProduct.create({
        data: {
          productId: createRedeemableProductDto.productId,
          pointsCost: createRedeemableProductDto.pointsCost,
          isActive: createRedeemableProductDto.isActive ?? true,
        },
        include: {
          product: {
            include: {
              category: true,
            },
          },
        },
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Error creating redeemable product: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al crear el producto canjeable');
    }
  }

  async updateRedeemable(id: number, updateRedeemableProductDto: UpdateRedeemableProductDto) {
    try {
      const existing = await this.prisma.redeemableProduct.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new NotFoundException(`Producto canjeable con ID ${id} no encontrado`);
      }

      if (updateRedeemableProductDto.productId) {
        await this.validateRedeemableTarget(updateRedeemableProductDto.productId, id);
      }

      return await this.prisma.redeemableProduct.update({
        where: { id },
        data: updateRedeemableProductDto,
        include: {
          product: {
            include: {
              category: true,
            },
          },
        },
      });
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Error updating redeemable product: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al actualizar el producto canjeable');
    }
  }

  async removeRedeemable(id: number) {
    try {
      const existing = await this.prisma.redeemableProduct.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new NotFoundException(`Producto canjeable con ID ${id} no encontrado`);
      }

      return await this.prisma.redeemableProduct.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Error deleting redeemable product: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al eliminar el producto canjeable');
    }
  }
}
