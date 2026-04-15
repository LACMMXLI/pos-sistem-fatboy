import { Injectable, NotFoundException, InternalServerErrorException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateModifierDto, UpdateModifierDto } from './dto/modifier.dto';

@Injectable()
export class ModifiersService {
  private readonly logger = new Logger(ModifiersService.name);

  constructor(private prisma: PrismaService) {}

  async create(createModifierDto: CreateModifierDto) {
    try {
      // Verify product exists
      const product = await this.prisma.product.findUnique({
        where: { id: createModifierDto.productId },
      });

      if (!product) {
        throw new BadRequestException(`El producto con ID ${createModifierDto.productId} no existe`);
      }

      return await this.prisma.productModifier.create({
        data: {
          name: createModifierDto.name,
          price: createModifierDto.price,
          productId: createModifierDto.productId,
        },
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      
      this.logger.error(`Error creating modifier: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al crear el modificador');
    }
  }

  async findByProduct(productId: number) {
    return this.prisma.productModifier.findMany({
      where: { productId },
    });
  }

  async findOne(id: number) {
    const modifier = await this.prisma.productModifier.findUnique({
      where: { id },
    });

    if (!modifier) {
      throw new NotFoundException(`Modificador con ID ${id} no encontrado`);
    }

    return modifier;
  }

  async update(id: number, updateModifierDto: UpdateModifierDto) {
    try {
      await this.findOne(id);

      return await this.prisma.productModifier.update({
        where: { id },
        data: updateModifierDto,
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error updating modifier: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al actualizar el modificador');
    }
  }

  async remove(id: number) {
    try {
      await this.findOne(id);
      return await this.prisma.productModifier.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error deleting modifier: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al eliminar el modificador');
    }
  }
}
