import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrderStatus, OrderType } from './dto/order.dto';

describe('OrdersService', () => {
  const createRealtimeGatewayMock = () => ({
    emitOrderCreated: jest.fn(),
    emitOrderUpdated: jest.fn(),
    emitTableUpdated: jest.fn(),
    emitPrintJob: jest.fn(),
    server: { emit: jest.fn() },
  });

  const createUsersServiceMock = () => ({
    findOneWithPassword: jest.fn(),
    validateActiveAdminPassword: jest.fn(),
  });

  const createLoyaltyServiceMock = () => ({
    addPoints: jest.fn().mockResolvedValue(undefined),
  });

  const createPrismaMock = () => ({
    systemConfig: {
      findUnique: jest.fn().mockResolvedValue({ id: 1, taxEnabled: true, taxRate: 16 }),
    },
    cashShift: {
      findFirst: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    order: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    orderItem: {
      aggregate: jest.fn(),
      updateMany: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(async (callback: any) =>
      callback({
        order: { update: jest.fn(), create: jest.fn() },
        orderItem: { aggregate: jest.fn(), updateMany: jest.fn() },
        kitchenOrder: { update: jest.fn(), create: jest.fn() },
        table: { update: jest.fn() },
        payment: { create: jest.fn() },
        cashMovement: { create: jest.fn() },
      }),
    ),
  });

  it('blocks creating an order when the cashier has no open shift', async () => {
    const prisma = createPrismaMock();
    prisma.cashShift.findFirst.mockResolvedValue(null);

    const service = new OrdersService(
      prisma as any,
      createRealtimeGatewayMock() as any,
      createUsersServiceMock() as any,
    );

    await expect(
      service.create(
        {
          orderType: OrderType.DINE_IN,
          tableId: 1,
          items: [{ productId: 1, quantity: 1 }],
        } as any,
        { id: 10, role: 'CAJERO' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks creating an order from tablet when there is no open cash shift in the system', async () => {
    const prisma = createPrismaMock();
    prisma.cashShift.findFirst.mockResolvedValue(null);

    const service = new OrdersService(
      prisma as any,
      createRealtimeGatewayMock() as any,
      createUsersServiceMock() as any,
    );

    await expect(
      service.create(
        {
          orderType: OrderType.DINE_IN,
          tableId: 1,
          waiterId: 8,
          manualSubmit: true,
          items: [],
        } as any,
        { id: 8, role: 'MESERO' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires waiter and table for dine in orders', async () => {
    const prisma = createPrismaMock();
    prisma.cashShift.findFirst.mockResolvedValue({ id: 1, status: 'OPEN' });

    const service = new OrdersService(
      prisma as any,
      createRealtimeGatewayMock() as any,
      createUsersServiceMock() as any,
    );

    await expect(
      service.create(
        {
          orderType: OrderType.DINE_IN,
          tableId: 1,
          items: [{ productId: 1, quantity: 1 }],
        } as any,
        { id: 10, role: 'CAJERO' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks waiter assignment for take away orders', async () => {
    const prisma = createPrismaMock();
    prisma.cashShift.findFirst.mockResolvedValue({ id: 1, status: 'OPEN' });

    const service = new OrdersService(
      prisma as any,
      createRealtimeGatewayMock() as any,
      createUsersServiceMock() as any,
    );

    await expect(
      service.create(
        {
          orderType: OrderType.TAKE_AWAY,
          waiterId: 5,
          items: [{ productId: 1, quantity: 1 }],
          payment: { paymentMethod: 'CASH', amount: 10, receivedAmount: 10 },
        } as any,
        { id: 10, role: 'CAJERO' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks a waiter from creating quick-service orders', async () => {
    const prisma = createPrismaMock();
    prisma.cashShift.findFirst.mockResolvedValue({ id: 1, status: 'OPEN' });

    const service = new OrdersService(
      prisma as any,
      createRealtimeGatewayMock() as any,
      createUsersServiceMock() as any,
    );

    await expect(
      service.create(
        {
          orderType: OrderType.TAKE_AWAY,
          items: [{ productId: 1, quantity: 1 }],
          payment: { paymentMethod: 'CASH', amount: 10, receivedAmount: 10 },
        } as any,
        { id: 8, role: 'MESERO' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates delivery orders without immediate payment and dispatches them to kitchen', async () => {
    const prisma = createPrismaMock();
    prisma.cashShift.findFirst.mockResolvedValue({ id: 1, status: 'OPEN' });
    prisma.product.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Pizza',
        isAvailable: true,
        price: 100,
        modifiers: [],
      },
    ]);

    const txOrderCreate = jest.fn().mockResolvedValue({
      id: 30,
      orderNumber: 'ORD-20260401-0001',
      orderType: OrderType.DELIVERY,
      tableId: null,
      status: OrderStatus.OPEN,
      paymentStatus: 'PENDING',
      items: [{ quantity: 1, price: 100, modifiers: [], product: { id: 1, name: 'Pizza' } }],
      discounts: [],
      payments: [],
      user: { id: 3, name: 'Caja' },
      customer: null,
      customerAddress: null,
      table: null,
      waiter: null,
      kitchenOrder: { id: 501, status: 'PENDING' },
    });
    const txKitchenCreate = jest.fn();

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        order: { create: txOrderCreate },
        payment: { create: jest.fn() },
        cashMovement: { create: jest.fn() },
        kitchenOrder: { create: txKitchenCreate },
        table: { update: jest.fn() },
      }),
    );

    const service = new OrdersService(
      prisma as any,
      createRealtimeGatewayMock() as any,
      createUsersServiceMock() as any,
    );

    const result = await service.create(
      {
        orderType: OrderType.DELIVERY,
        customerName: 'Juan',
        customerPhone: '6641234567',
        deliveryAddress: {
          street: 'Calle 1',
          neighborhood: 'Centro',
          city: 'Tijuana',
        },
        items: [{ productId: 1, quantity: 1 }],
      } as any,
      { id: 10, role: 'CAJERO' },
    );

    expect(result.orderType).toBe(OrderType.DELIVERY);
    expect(result.paymentStatus).toBe('PENDING');
    expect(txKitchenCreate).toHaveBeenCalledWith({
      data: {
        orderId: 30,
        status: 'PENDING',
      },
    });
  });

  it('blocks closing an order with pending balance', async () => {
    const prisma = createPrismaMock();
    prisma.order.findUnique.mockResolvedValue({
      id: 12,
      orderNumber: 'ORD-20260331-0012',
      orderType: OrderType.DINE_IN,
      tableId: 7,
      status: OrderStatus.OPEN,
      paymentStatus: 'PARTIAL',
      items: [{ quantity: 1, price: 100, modifiers: [] }],
      discounts: [],
      payments: [{ amount: 50 }],
      user: { id: 3, name: 'Caja' },
      customer: null,
      customerAddress: null,
      table: { id: 7, name: 'Mesa 7' },
      waiter: null,
      kitchenOrder: null,
    });

    const service = new OrdersService(
      prisma as any,
      createRealtimeGatewayMock() as any,
      createUsersServiceMock() as any,
    );

    await expect(
      service.updateStatus(12, { status: OrderStatus.CLOSED }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks closing a delivery order before it is marked as delivered', async () => {
    const prisma = createPrismaMock();
    prisma.order.findUnique.mockResolvedValue({
      id: 44,
      orderNumber: 'ORD-20260401-0044',
      orderType: OrderType.DELIVERY,
      tableId: null,
      status: OrderStatus.READY,
      paymentStatus: 'PAID',
      items: [{ quantity: 1, price: 100, modifiers: [] }],
      discounts: [],
      payments: [{ amount: 116 }],
      user: { id: 3, name: 'Caja' },
      customer: null,
      customerAddress: null,
      table: null,
      waiter: null,
      kitchenOrder: { id: 88, status: 'READY' },
    });

    const service = new OrdersService(
      prisma as any,
      createRealtimeGatewayMock() as any,
      createUsersServiceMock() as any,
    );

    await expect(
      service.updateStatus(44, { status: OrderStatus.CLOSED }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows cancelling a closed take away order with admin authorization when it has no payments', async () => {
    const prisma = createPrismaMock();
    const usersService = createUsersServiceMock();
    const txOrderUpdate = jest.fn().mockResolvedValue({
      id: 55,
      orderNumber: 'ORD-20260403-0055',
      orderType: OrderType.TAKE_AWAY,
      tableId: null,
      status: OrderStatus.CANCELLED,
      paymentStatus: 'PENDING',
      paidAmount: 0,
      remainingAmount: 0,
      items: [{ quantity: 1, price: 100, modifiers: [], product: { id: 1, name: 'Pizza' } }],
      discounts: [],
      payments: [],
      user: { id: 3, name: 'Caja' },
      customer: null,
      customerAddress: null,
      table: null,
      waiter: null,
      kitchenOrder: null,
    });

    prisma.order.findUnique.mockResolvedValue({
      id: 55,
      orderNumber: 'ORD-20260403-0055',
      orderType: OrderType.TAKE_AWAY,
      tableId: null,
      status: OrderStatus.CLOSED,
      paymentStatus: 'PENDING',
      paidAmount: 0,
      remainingAmount: 0,
      items: [{ quantity: 1, price: 100, modifiers: [], product: { id: 1, name: 'Pizza' } }],
      discounts: [],
      payments: [],
      user: { id: 3, name: 'Caja' },
      customer: null,
      customerAddress: null,
      table: null,
      waiter: null,
      kitchenOrder: null,
    });

    usersService.validateActiveAdminPassword.mockResolvedValue({
      id: 1,
      role: { name: 'ADMIN' },
    });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        order: { update: txOrderUpdate },
        table: { update: jest.fn() },
      }),
    );

    const service = new OrdersService(
      prisma as any,
      createRealtimeGatewayMock() as any,
      usersService as any,
    );

    const result = await service.updateStatus(55, {
      status: OrderStatus.CANCELLED,
      adminPassword: '1234',
    });

    expect(usersService.validateActiveAdminPassword).toHaveBeenCalledWith('1234');
    expect(txOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 55 },
        data: { status: OrderStatus.CANCELLED },
      }),
    );
    expect(result.status).toBe(OrderStatus.CANCELLED);
  });

  it('allows cancelling a paid closed take away order with admin authorization', async () => {
    const prisma = createPrismaMock();
    const usersService = createUsersServiceMock();
    const txOrderUpdate = jest.fn().mockResolvedValue({
      id: 56,
      orderNumber: 'ORD-20260403-0056',
      orderType: OrderType.TAKE_AWAY,
      tableId: null,
      status: OrderStatus.CANCELLED,
      paymentStatus: 'PAID',
      paidAmount: 116,
      remainingAmount: 0,
      items: [{ quantity: 1, price: 100, modifiers: [], product: { id: 1, name: 'Pizza' } }],
      discounts: [],
      payments: [{ amount: 116, paymentMethod: 'CASH' }],
      user: { id: 3, name: 'Caja' },
      customer: null,
      customerAddress: null,
      table: null,
      waiter: null,
      kitchenOrder: null,
    });

    prisma.order.findUnique.mockResolvedValue({
      id: 56,
      orderNumber: 'ORD-20260403-0056',
      orderType: OrderType.TAKE_AWAY,
      tableId: null,
      status: OrderStatus.CLOSED,
      paymentStatus: 'PAID',
      paidAmount: 116,
      remainingAmount: 0,
      items: [{ quantity: 1, price: 100, modifiers: [], product: { id: 1, name: 'Pizza' } }],
      discounts: [],
      payments: [{ amount: 116, paymentMethod: 'CASH' }],
      user: { id: 3, name: 'Caja' },
      customer: null,
      customerAddress: null,
      table: null,
      waiter: null,
      kitchenOrder: null,
    });

    usersService.validateActiveAdminPassword.mockResolvedValue({
      id: 1,
      role: { name: 'ADMIN' },
    });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        order: { update: txOrderUpdate },
        table: { update: jest.fn() },
      }),
    );

    const service = new OrdersService(
      prisma as any,
      createRealtimeGatewayMock() as any,
      usersService as any,
    );

    const result = await service.updateStatus(56, {
      status: OrderStatus.CANCELLED,
      adminPassword: '1234',
    });

    expect(usersService.validateActiveAdminPassword).toHaveBeenCalledWith('1234');
    expect(txOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 56 },
        data: { status: OrderStatus.CANCELLED },
      }),
    );
    expect(result.status).toBe(OrderStatus.CANCELLED);
    expect(result.paymentStatus).toBe('PAID');
  });

  it('returns the table to occupied when adding items after printing the account', async () => {
    const prisma = createPrismaMock();
    prisma.order.findUnique.mockResolvedValue({
      id: 20,
      tableId: 4,
      waiterId: 3,
      status: OrderStatus.READY,
      kitchenOrder: { id: 99 },
    });
    prisma.product.findMany.mockResolvedValue([
      {
        id: 5,
        name: 'Hamburguesa',
        isAvailable: true,
        price: 100,
        modifiers: [],
      },
    ]);

    const txOrderUpdate = jest.fn().mockResolvedValue({
      id: 20,
      orderNumber: 'ORD-20260331-0020',
      orderType: OrderType.DINE_IN,
      tableId: 4,
      status: OrderStatus.IN_PROGRESS,
      paymentStatus: 'PENDING',
      items: [{ quantity: 2, price: 100, modifiers: [], product: { id: 5, name: 'Hamburguesa' } }],
      discounts: [],
      payments: [],
      user: { id: 3, name: 'Caja' },
      customer: null,
      customerAddress: null,
      table: { id: 4, name: 'Mesa 4' },
      waiter: null,
      kitchenOrder: { id: 99, status: 'PENDING' },
    });
    const txKitchenUpdate = jest.fn();
    const txTableUpdate = jest.fn();
    const txOrderItemAggregate = jest.fn().mockResolvedValue({
      _max: { submissionBatch: 1 },
    });
    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        order: { update: txOrderUpdate },
        orderItem: { aggregate: txOrderItemAggregate },
        kitchenOrder: { update: txKitchenUpdate },
        table: { update: txTableUpdate },
      }),
    );

    const service = new OrdersService(
      prisma as any,
      createRealtimeGatewayMock() as any,
      createUsersServiceMock() as any,
    );

    await service.addItems(20, {
      items: [{ productId: 5, quantity: 2 }],
    } as any);

    expect(txTableUpdate).toHaveBeenCalledWith({
      where: { id: 4 },
      data: { status: 'OCCUPIED' },
    });
  });

  it('blocks adding items from tablet when there is no open cash shift in the system', async () => {
    const prisma = createPrismaMock();
    prisma.cashShift.findFirst.mockResolvedValue(null);

    const service = new OrdersService(
      prisma as any,
      createRealtimeGatewayMock() as any,
      createUsersServiceMock() as any,
    );

    await expect(
      service.addItems(
        20,
        {
          items: [{ productId: 5, quantity: 1 }],
          manualSubmit: true,
        } as any,
        { id: 8, role: 'MESERO' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks submitting a tablet order when there is no open cash shift in the system', async () => {
    const prisma = createPrismaMock();
    prisma.cashShift.findFirst.mockResolvedValue(null);

    const service = new OrdersService(
      prisma as any,
      createRealtimeGatewayMock() as any,
      createUsersServiceMock() as any,
    );

    await expect(
      service.submit(20, { id: 8, role: 'MESERO' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates dine in draft orders without dispatching to kitchen when manual submit is enabled', async () => {
    const prisma = createPrismaMock();
    prisma.cashShift.findFirst.mockResolvedValue({ id: 1, status: 'OPEN' });
    prisma.product.findMany.mockResolvedValue([]);
    prisma.user.findUnique.mockResolvedValue({
      id: 15,
      isActive: true,
      role: { name: 'MESERO' },
    });

    const txTableFindUnique = jest.fn().mockResolvedValue({
      id: 8,
      isActive: true,
      status: 'AVAILABLE',
    });
    const txTableUpdate = jest.fn();
    const txOrderCreate = jest.fn().mockResolvedValue({
      id: 77,
      orderNumber: 'ORD-20260403-0001',
      orderType: OrderType.DINE_IN,
      tableId: 8,
      waiterId: 15,
      status: OrderStatus.OPEN,
      paymentStatus: 'PENDING',
      items: [],
      discounts: [],
      payments: [],
      user: { id: 15, name: 'Mesero 1' },
      customer: null,
      customerAddress: null,
      table: { id: 8, name: 'Mesa 8' },
      waiter: { id: 15, name: 'Mesero 1', role: { name: 'MESERO' } },
      kitchenOrder: null,
    });
    const txKitchenCreate = jest.fn();

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        order: { create: txOrderCreate, findFirst: jest.fn().mockResolvedValue(null) },
        payment: { create: jest.fn() },
        cashMovement: { create: jest.fn() },
        kitchenOrder: { create: txKitchenCreate },
        table: { findUnique: txTableFindUnique, update: txTableUpdate },
      }),
    );

    const service = new OrdersService(
      prisma as any,
      createRealtimeGatewayMock() as any,
      createUsersServiceMock() as any,
    );

    const result = await service.create(
      {
        orderType: OrderType.DINE_IN,
        tableId: 8,
        manualSubmit: true,
        items: [],
      } as any,
      { id: 15, role: 'MESERO' },
    );

    expect(result.orderType).toBe(OrderType.DINE_IN);
    expect(txKitchenCreate).not.toHaveBeenCalled();
  });

  it('submits only draft items to kitchen', async () => {
    const prisma = createPrismaMock();
    prisma.cashShift.findFirst.mockResolvedValue({ id: 1, status: 'OPEN' });
    const txOrderItemUpdateMany = jest.fn();
    const txOrderUpdate = jest.fn();
    const txKitchenUpdate = jest.fn();
    const txTableUpdate = jest.fn();

    prisma.order.findUnique
      .mockResolvedValueOnce({
        id: 33,
        tableId: 9,
        waiterId: 4,
        status: OrderStatus.OPEN,
        kitchenOrder: { id: 700 },
        items: [
          { id: 1, submittedAt: new Date('2026-04-03T19:00:00Z'), submissionBatch: 1, status: 'READY' },
          { id: 2, submittedAt: null, submissionBatch: null, status: 'DRAFT' },
        ],
      })
      .mockResolvedValueOnce({
        id: 33,
        orderNumber: 'ORD-20260403-0033',
        orderType: OrderType.DINE_IN,
        tableId: 9,
        waiterId: 4,
        status: OrderStatus.IN_PROGRESS,
        paymentStatus: 'PENDING',
        items: [
          { id: 1, quantity: 1, price: 100, submittedAt: new Date('2026-04-03T19:00:00Z'), submissionBatch: 1, status: 'READY', modifiers: [], product: { id: 1, name: 'Pizza' } },
          { id: 2, quantity: 1, price: 50, submittedAt: new Date('2026-04-03T19:10:00Z'), submissionBatch: 2, status: 'PENDING', modifiers: [], product: { id: 2, name: 'Soda' } },
        ],
        discounts: [],
        payments: [],
        user: { id: 4, name: 'Mesero 1' },
        customer: null,
        customerAddress: null,
        table: { id: 9, name: 'Mesa 9' },
        waiter: { id: 4, name: 'Mesero 1', role: { name: 'MESERO' } },
        kitchenOrder: { id: 700, status: 'PENDING' },
      });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        orderItem: { updateMany: txOrderItemUpdateMany },
        order: { update: txOrderUpdate },
        kitchenOrder: { update: txKitchenUpdate, create: jest.fn() },
        table: { update: txTableUpdate },
      }),
    );

    const service = new OrdersService(
      prisma as any,
      createRealtimeGatewayMock() as any,
      createUsersServiceMock() as any,
    );

    const result = await service.submit(33, { id: 4, role: 'MESERO' });

    expect(result.status).toBe(OrderStatus.IN_PROGRESS);
    expect(txOrderItemUpdateMany).toHaveBeenCalled();
    expect(txKitchenUpdate).toHaveBeenCalled();
  });

  it('adds loyalty points for take away orders created with immediate payment', async () => {
    const prisma = createPrismaMock();
    const loyaltyService = createLoyaltyServiceMock();
    prisma.cashShift.findFirst.mockResolvedValue({ id: 1, status: 'OPEN' });
    prisma.product.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Pizza',
        isAvailable: true,
        price: 100,
        modifiers: [],
      },
    ]);
    prisma.customer = {
      findUnique: jest.fn().mockResolvedValue({
        id: 44,
        name: 'Alonso',
        phone: '6641234567',
        addresses: [],
      }),
    } as any;

    const txOrderCreate = jest.fn().mockResolvedValue({
      id: 90,
      orderNumber: 'ORD-20260405-0090',
      orderType: OrderType.TAKE_AWAY,
      customerId: 44,
      customerName: 'Alonso',
      tableId: null,
      status: OrderStatus.OPEN,
      paymentStatus: 'PAID',
      items: [{ quantity: 1, price: 100, modifiers: [], product: { id: 1, name: 'Pizza' } }],
      discounts: [],
      payments: [{ amount: 116, paymentMethod: 'CASH' }],
      user: { id: 10, name: 'Caja' },
      customer: { id: 44, name: 'Alonso', phone: '6641234567' },
      customerAddress: null,
      table: null,
      waiter: null,
      kitchenOrder: null,
    });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        order: { create: txOrderCreate },
        payment: { create: jest.fn() },
        cashMovement: { create: jest.fn() },
        kitchenOrder: { create: jest.fn() },
        table: { update: jest.fn() },
      }),
    );

    const service = new OrdersService(
      prisma as any,
      createRealtimeGatewayMock() as any,
      createUsersServiceMock() as any,
      loyaltyService as any,
    );

    const result = await service.create(
      {
        orderType: OrderType.TAKE_AWAY,
        customerId: 44,
        items: [{ productId: 1, quantity: 1 }],
        payment: { paymentMethod: 'CASH', amount: 116, receivedAmount: 116 },
      } as any,
      { id: 10, role: 'CAJERO' },
    );

    expect(result.customerId).toBe(44);
    expect(loyaltyService.addPoints).toHaveBeenCalledWith(44, 90, 116);
  });
});
