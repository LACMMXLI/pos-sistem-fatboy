import { Injectable, NotFoundException, InternalServerErrorException, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAreaDto, UpdateAreaDto } from './dto/area.dto';

@Injectable()
export class AreasService {
  private readonly logger = new Logger(AreasService.name);

  constructor(private prisma: PrismaService) { }

  async create(createAreaDto: CreateAreaDto) {
    try {
      return await this.prisma.area.create({
        data: createAreaDto,
      });
    } catch (error) {
      this.logger.error(`Error creating area: ${error.message}`, error.stack);
      if (error.code === 'P2002') {
        throw new ConflictException('Ya existe un área con ese nombre');
      }
      throw new InternalServerErrorException('Error interno al crear el área');
    }
  }

  async findAll() {
    return this.prisma.area.findMany({
      include: {
        _count: {
          select: { tables: true }
        }
      },
      orderBy: { name: 'asc' }
    });
  }

  async findOne(id: number) {
    const area = await this.prisma.area.findUnique({
      where: { id },
      include: {
        tables: {
          orderBy: { name: 'asc' }
        }
      }
    });

    if (!area) {
      throw new NotFoundException(`Área con ID ${id} no encontrada`);
    }

    return area;
  }

  async update(id: number, updateAreaDto: UpdateAreaDto) {
    try {
      return await this.prisma.area.update({
        where: { id },
        data: updateAreaDto,
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Área con ID ${id} no encontrada`);
      }
      this.logger.error(`Error updating area: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al actualizar el área');
    }
  }

  async remove(id: number) {
    try {
      // Logic for soft delete or check if it has active tables
      const area = await this.findOne(id);

      if (area.tables.length > 0) {
        // Option A: Just deactivate
        return await this.prisma.area.update({
          where: { id },
          data: { isActive: false }
        });
      }

      return await this.prisma.area.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error removing area: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al eliminar el área');
    }
  }
}
