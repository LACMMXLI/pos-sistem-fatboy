import { Injectable, NotFoundException, InternalServerErrorException, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private prisma: PrismaService) {}

  async create(createCategoryDto: CreateCategoryDto) {
    try {
      return await this.prisma.category.create({
        data: {
          name: createCategoryDto.name,
          displayOrder: createCategoryDto.displayOrder ?? 0,
          isActive: createCategoryDto.isActive ?? true,
        },
      });
    } catch (error) {
      this.logger.error(`Error creating category: ${error.message}`, error.stack);
      
      if (error.code === 'P2002') {
        throw new ConflictException('Ya existe una categoría con este nombre');
      }
      
      throw new InternalServerErrorException('Error interno al crear la categoría');
    }
  }

  async findAll() {
    return this.prisma.category.findMany({
      orderBy: {
        displayOrder: 'asc',
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
  }

  async findOne(id: number) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        products: true,
      },
    });

    if (!category) {
      throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
    }

    return category;
  }

  async update(id: number, updateCategoryDto: UpdateCategoryDto) {
    try {
      // Check if exists
      await this.findOne(id);

      return await this.prisma.category.update({
        where: { id },
        data: updateCategoryDto,
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      
      this.logger.error(`Error updating category: ${error.message}`, error.stack);
      
      if (error.code === 'P2002') {
        throw new ConflictException('Ya existe una categoría con este nombre');
      }
      
      throw new InternalServerErrorException('Error interno al actualizar la categoría');
    }
  }

  async remove(id: number) {
    try {
      // Check if exists and has no products
      const category = await this.prisma.category.findUnique({
        where: { id },
        include: { _count: { select: { products: true } } },
      });

      if (!category) {
        throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
      }

      if (category._count.products > 0) {
        throw new ConflictException('No se puede eliminar una categoría que contiene productos');
      }

      return await this.prisma.category.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      this.logger.error(`Error deleting category: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al eliminar la categoría');
    }
  }
}
