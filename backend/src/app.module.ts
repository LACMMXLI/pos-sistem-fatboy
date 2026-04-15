import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RolesModule } from './modules/roles/roles.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ProductsModule } from './modules/products/products.module';
import { ModifiersModule } from './modules/modifiers/modifiers.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { CashShiftsModule } from './modules/cash-shifts/cash-shifts.module';
import { KitchenModule } from './modules/kitchen/kitchen.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ExternalOrdersModule } from './modules/external-orders/external-orders.module';
import { AreasModule } from './modules/areas/areas.module';
import { TablesModule } from './modules/tables/tables.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ReportsModule } from './modules/reports/reports.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { PayrollsModule } from './modules/payrolls/payrolls.module';
import { PrintingModule } from './modules/printing/printing.module';
import { LoyaltyModule } from './modules/loyalty/loyalty.module';
import { NotificationDispatchModule } from './modules/notification-dispatch/notification-dispatch.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    RolesModule,
    UsersModule,
    AuthModule,
    PrismaModule,
    CategoriesModule,
    ProductsModule,
    ModifiersModule,
    OrdersModule,
    PaymentsModule,
    CashShiftsModule,
    KitchenModule,
    CustomersModule,
    ExternalOrdersModule,
    AreasModule,
    TablesModule,
    SettingsModule,
    ReportsModule,
    RealtimeModule,
    EmployeesModule,
    PayrollsModule,
    PrintingModule,
    LoyaltyModule,
    NotificationDispatchModule,
  ],





  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
