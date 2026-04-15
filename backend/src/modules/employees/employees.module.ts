import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { PayrollsModule } from '../payrolls/payrolls.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [PrismaModule, PayrollsModule, UsersModule],
  controllers: [EmployeesController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
