import { Injectable, ConflictException, NotFoundException, InternalServerErrorException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });
  }

  async findByTabletPin(tabletPin: string) {
    // Note: We can no longer query by tabletPin directly because it's hashed.
    // However, we handle this in AuthService by fetching active waiters.
    return this.prisma.user.findFirst({
      where: { tabletPin },
      include: { role: true },
    });
  }

  async incrementLoginAttempts(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const attempts = user.loginAttempts + 1;
    let lockoutUntil: Date | null = null;

    if (attempts >= 5) {
      // Lock for 15 minutes after 5 attempts
      lockoutUntil = new Date(Date.now() + 15 * 60 * 1000);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        loginAttempts: attempts,
        lockoutUntil,
      },
    });
  }

  async resetLoginAttempts(userId: number) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        loginAttempts: 0,
        lockoutUntil: null,
      },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!user) throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    // Omit password from result
    const { password, ...result } = user;
    return result;
  }

  async findOneWithPassword(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!user) throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    return user;
  }

  async validateActiveAdminPassword(password: string) {
    const admins = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: {
          name: 'ADMIN',
        },
      },
      include: { role: true },
    });

    for (const admin of admins) {
      const isPasswordValid = await bcrypt.compare(password, admin.password);
      if (isPasswordValid) {
        return admin;
      }
    }

    return null;
  }

  async create(data: CreateUserDto) {
    try {
      const existingUser = await this.findByEmail(data.email);
      if (existingUser) throw new ConflictException('El correo ya está registrado');

      // Verify role exists
      const role = await this.prisma.role.findUnique({
        where: { id: data.roleId },
      });
      if (!role) {
        throw new BadRequestException(`El rol con ID ${data.roleId} no existe`);
      }

      const tabletPin = this.resolveTabletPinForCreate(role.name, data.tabletPin);

      const hashedPassword = await bcrypt.hash(data.password, 10);
      const hashedPin = tabletPin ? await bcrypt.hash(tabletPin, 10) : null;
      
      const user = await this.prisma.user.create({
        data: {
          name: data.name,
          email: data.email,
          password: hashedPassword,
          roleId: data.roleId,
          tabletPin: hashedPin,
          isActive: true,
        },
        include: { role: true },
      });

      // Remove password from response
      const { password, ...result } = user;
      return result;

    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }
      
      this.logger.error(`Error creating user: ${error.message}`, error.stack);
      
      if (error.code === 'P2002') {
        throw new ConflictException('Ya existe un usuario con este correo');
      }
      if (error.code === 'P2003') {
        throw new BadRequestException('El rol proporcionado no es válido');
      }
      
      throw new InternalServerErrorException('Error interno al crear el usuario');
    }
  }

  async findAll(role?: string, options?: { includeTabletPin?: boolean }) {
    return this.prisma.user.findMany({
      where: role
        ? {
            role: {
              name: role,
            },
          }
        : undefined,
      select: {
        id: true,
        name: true,
        email: true,
        tabletPin: options?.includeTabletPin ?? false,
        isActive: true,
        createdAt: true,
        role: true,
      }
    });
  }

  async update(id: number, data: UpdateUserDto) {
    try {
      // 1. Ensure user exists
      await this.findOne(id);

      // 2. If email is being changed, ensure it's not taken by another user
      if (data.email) {
        const existingUser = await this.prisma.user.findUnique({
          where: { email: data.email },
        });
        if (existingUser && existingUser.id !== id) {
          throw new ConflictException('El correo ya está en uso por otro usuario');
        }
      }

      // 3. If roleId is provided, verify it exists
      if (data.roleId) {
        const role = await this.prisma.role.findUnique({
          where: { id: data.roleId },
        });
        if (!role) {
          throw new BadRequestException(`El rol con ID ${data.roleId} no existe`);
        }
      }

      const currentUser = await this.prisma.user.findUnique({
        where: { id },
        include: { role: true },
      });
      if (!currentUser) {
        throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
      }

      const nextRole =
        data.roleId && data.roleId !== currentUser.roleId
          ? await this.prisma.role.findUnique({ where: { id: data.roleId } })
          : currentUser.role;

      if (!nextRole) {
        throw new BadRequestException(`El rol con ID ${data.roleId} no existe`);
      }

      const nextTabletPin = this.resolveTabletPinForUpdate(
        currentUser.role.name,
        currentUser.tabletPin,
        nextRole.name,
        data.tabletPin,
      );

      const hashedPin = (typeof data.tabletPin === 'string') 
        ? await bcrypt.hash(nextTabletPin as string, 10) 
        : nextTabletPin;

      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: {
          ...data,
          tabletPin: hashedPin,
        },
        include: { role: true },
      });

      const { password, ...result } = updatedUser;
      return result;

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error updating user: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error interno al actualizar el usuario');
    }
  }

  async remove(id: number) {
    try {
      await this.findOne(id);
      
      // Note: You might want to check for relations (e.g., existing orders) before deleting
      // For now, we proceed with deletion.
      await this.prisma.user.delete({ where: { id } });
      
      return { message: `Usuario con ID ${id} eliminado exitosamente.` };

    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error deleting user: ${error.message}`, error.stack);
      // Prisma's P2003 code indicates a foreign key constraint would be violated
      if (error.code === 'P2003') {
        throw new ConflictException('No se puede eliminar el usuario. Tiene registros asociados (pedidos, turnos, etc.).');
      }
      throw new InternalServerErrorException('Error interno al eliminar el usuario');
    }
  }

  private resolveTabletPinForCreate(roleName: string, tabletPin?: string) {
    if (roleName !== 'MESERO') {
      return null;
    }

    if (!tabletPin) {
      throw new BadRequestException('Los usuarios MESERO requieren un PIN operativo de 4 dígitos');
    }

    return tabletPin;
  }

  private resolveTabletPinForUpdate(
    currentRoleName: string,
    currentTabletPin: string | null,
    nextRoleName: string,
    nextTabletPin?: string,
  ) {
    if (nextRoleName !== 'MESERO') {
      return null;
    }

    if (typeof nextTabletPin === 'string') {
      return nextTabletPin;
    }

    if (currentRoleName === 'MESERO' && currentTabletPin) {
      return currentTabletPin;
    }

    throw new BadRequestException('Los usuarios MESERO requieren un PIN operativo de 4 dígitos');
  }
}
