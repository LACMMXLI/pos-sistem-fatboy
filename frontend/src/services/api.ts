import axios from 'axios';
import {
  getApiBaseUrl,
  getDesktopInstalledPrinters,
  getDesktopPrintJobStatus,
  getDesktopSessionToken,
  clearDesktopSessionToken,
  setDesktopSessionToken,
  isDesktopRuntime,
  printDesktopDocument,
  printDesktopOrderReceipt,
  reprintDesktopDocument,
  testDesktopPrint,
} from '../lib/runtime';

export interface OrderSummary {
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  paidAmount: number;
  totalAmount: number;
  remainingAmount: number;
}

export interface AuthResponse {
  access_token: string;
  user: {
    id: number | string;
    name: string;
    email: string;
    role: string;
  };
}

export type KitchenStatus = 'PENDING' | 'PREPARING' | 'READY' | 'COMPLETED';
export type OrderStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CLOSED'
  | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID';
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';
export type OrderType = 'DINE_IN' | 'TAKE_AWAY' | 'DELIVERY';

export interface KitchenOrderResponse {
  id: number;
  orderId: number;
  status: KitchenStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  order: {
    id: number;
    orderNumber: string;
    createdAt: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    orderType: OrderType;
    customerName?: string | null;
    table?: {
      id: number;
      name: string;
    } | null;
    items: Array<{
      id: number;
      quantity: number;
      status?: KitchenStatus | string;
      notes?: string | null;
      redeemableProductId?: number | null;
      product?: {
        id: number;
        name: string;
      } | null;
      modifiers?: Array<{
        id?: number;
        name: string;
        price?: number | string;
      }>;
    }>;
  };
}

export interface ActiveShiftResponse {
  id: number;
  userId: number;
  openingAmount: string;
  closingAmount?: string | null;
  closingUsdAmount?: string | null;
  closingCardAmount?: string | null;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt?: string | null;
  user?: {
    name: string;
  };
  movements: Array<{
    id: number | string;
    sourceType?: 'PAYMENT' | 'MANUAL_MOVEMENT';
    movementType: 'IN' | 'OUT';
    amount: string | number;
    reason?: string | null;
    createdAt: string;
    paymentMethod?: string | null;
    paymentCurrency?: string | null;
    orderId?: number | null;
    orderNumber?: string | null;
    createdByName?: string | null;
  }>;
}

export interface ShiftSummaryResponse {
  shiftId: number;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt?: string | null;
  openingAmount: number;
  totalSalesCash: number;
  totalSalesCard: number;
  totalSalesRegistered: number;
  totalManualIn: number;
  totalManualOut: number;
  totalCashMxnIn: number;
  totalCashUsdIn: number;
  totalCashUsdInMxn: number;
  totalChangeGivenMxn: number;
  expectedBalance: number;
  expectedUsdBalance: number;
  expectedUsdBalanceMxn: number;
  expectedCardBalance: number;
  closingAmount?: number | null;
  closingUsdAmount?: number | null;
  closingCardAmount?: number | null;
  difference?: number | null;
  cashDifference?: number | null;
  usdDifference?: number | null;
  cardDifference?: number | null;
  usdRateForClose?: number;
  totalExpectedSystem: number;
  totalReported: number;
  totalDifference?: number | null;
  cancelledOrdersCount?: number;
  cancelledSalesExcluded?: number;
  redeemedOrdersCount?: number;
  redeemedItemsCount?: number;
  salesByCashier?: Array<{
    userId: number;
    cashierName: string;
    totalSalesCash: number;
    totalSalesCard: number;
    totalSales: number;
  }>;
  serviceTypeMetrics?: Array<{
    orderType: string;
    label: string;
    ordersCount: number;
    itemsSold: number;
    totalSales: number;
    averageTicket: number;
    topProducts: Array<{
      productId: number;
      productName: string;
      quantitySold: number;
      grossSales: number;
    }>;
  }>;
  topProducts?: Array<{
    productId: number;
    productName: string;
    quantitySold: number;
    grossSales: number;
    orderTypes: Array<{
      orderType: string;
      label: string;
      quantitySold: number;
      grossSales: number;
    }>;
  }>;
  timeline?: Array<{
    id: string;
    sourceType: 'PAYMENT' | 'MANUAL_MOVEMENT';
    movementType: 'IN' | 'OUT';
    amount: number;
    reason?: string | null;
    createdAt: string;
    paymentMethod?: string | null;
    paymentCurrency?: string | null;
    orderId?: number | null;
    orderNumber?: string | null;
    createdByName?: string | null;
  }>;
}

export interface CloseShiftResponse {
  shift: ActiveShiftResponse;
  report: ShiftSummaryResponse;
  email?: {
    attempted: boolean;
    sent: boolean;
    message: string;
    to?: string[];
    cc?: string[];
  };
}

export interface PayrollPreviewParams {
  periodStart: string;
  periodEnd: string;
}

export interface SettingsResponse {
  restaurantName?: string;
  restaurantAddress?: string;
  taxEnabled: boolean;
  taxRate: number;
  receiptAutoPrint?: boolean;
  receiptPaperWidth?: '58' | '80';
  receiptPrinterName?: string | null;
  kitchenPrinterName?: string | null;
  kitchenPaperWidth?: '58' | '80';
  receiptCutEnabled?: boolean;
  cashDrawerEnabled?: boolean;
  cashDrawerOpenOnCash?: boolean;
  accentColor?: string;
  paperColor?: string;
  panelColor?: string;
  inkColor?: string;
  themePreset?: string;
  shiftEmailEnabled?: boolean;
  shiftEmailHost?: string;
  shiftEmailPort?: number;
  shiftEmailSecure?: boolean;
  shiftEmailUser?: string;
  shiftEmailPassword?: string;
  shiftEmailFrom?: string;
  shiftEmailTo?: string;
  shiftEmailCc?: string;
  whatsappAddonEnabled?: boolean;
}

export interface PrintTemplateSectionResponse {
  key: string;
  enabled: boolean;
  visibleWhen?: string | null;
  order: number;
  alignment: 'left' | 'center' | 'right';
  fontSize: 'small' | 'normal' | 'large' | 'xlarge';
  bold: boolean;
  dividerBefore?: boolean;
  dividerAfter?: boolean;
  customLabel?: string | null;
  spacing?: number;
  maxWidth?: '58' | '80' | 'auto';
  format?: 'currency' | 'percentage' | 'text' | null;
  options?: Record<string, unknown>;
}

export interface PrintTemplateResponse {
  id: number;
  templateKey: string;
  name: string;
  documentType: string;
  paperWidth: '58' | '80';
  version: number;
  isActive: boolean;
  isDefault: boolean;
  sections: PrintTemplateSectionResponse[];
  printerRouting?: Record<string, unknown>;
  fixedTexts?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  warnings?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PrintJobResponse {
  id: string;
  documentType: string;
  entityType: string;
  entityId: string;
  status: 'pending' | 'processing' | 'printed' | 'failed' | 'cancelled';
  source: string;
  printerName?: string | null;
  paperWidth?: '58' | '80' | null;
  copies: number;
  attempts: number;
  maxAttempts: number;
  lastError?: string | null;
  renderedDocument?: {
    previewText?: string;
    lines?: Array<{ text: string }>;
  };
  createdAt: string;
  updatedAt: string;
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add the auth token
api.interceptors.request.use(async (config) => {
  let token = localStorage.getItem('token');
  
  if (isDesktopRuntime()) {
    const desktopToken = await getDesktopSessionToken();
    if (desktopToken) {
      token = desktopToken;
    }
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for session expiration
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      if (isDesktopRuntime()) {
        await setDesktopSessionToken(null);
      }
      localStorage.removeItem('token');
      localStorage.removeItem('fatboy-auth-storage'); // Clear zustand storage to prevent loop
      
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const login = async (credentials: any): Promise<AuthResponse> => {
  const { data } = await api.post<AuthResponse>('/auth/login', credentials);
  return data;
};

export const waiterPinLogin = async (pin: string): Promise<AuthResponse> => {
  const { data } = await api.post<AuthResponse>('/auth/waiter-pin-login', { pin });
  return data;
};

// POS Data
export const getCategories = async () => {
  const { data } = await api.get('/categories');
  return data;
};

export const createCategory = async (categoryData: any) => {
  const { data } = await api.post('/categories', categoryData);
  return data;
};

export const updateCategory = async (id: string | number, categoryData: any) => {
  const { data } = await api.patch(`/categories/${id}`, categoryData);
  return data;
};

export const deleteCategory = async (id: string | number) => {
  const { data } = await api.delete(`/categories/${id}`);
  return data;
};

export const getProducts = async (categoryId?: string) => {
  const params = categoryId ? { categoryId } : {};
  const { data } = await api.get('/products', { params });
  return data;
};

export const createProduct = async (productData: any) => {
  const { data } = await api.post('/products', productData);
  return data;
};

export const updateProduct = async (id: string | number, productData: any) => {
  const { data } = await api.patch(`/products/${id}`, productData);
  return data;
};

export const deleteProduct = async (id: string | number) => {
  const { data } = await api.delete(`/products/${id}`);
  return data;
};

export const getRedeemableProducts = async () => {
  const { data } = await api.get('/products/redeemable');
  return data;
};

export const createRedeemableProduct = async (payload: any) => {
  const { data } = await api.post('/products/redeemable', payload);
  return data;
};

export const updateRedeemableProduct = async (id: string | number, payload: any) => {
  const { data } = await api.patch(`/products/redeemable/${id}`, payload);
  return data;
};

export const deleteRedeemableProduct = async (id: string | number) => {
  const { data } = await api.delete(`/products/redeemable/${id}`);
  return data;
};

// Table Service Integration
export const getAreas = async () => {
  const { data } = await api.get('/areas');
  return data;
};

export const getTables = async (areaId?: string) => {
  const params = areaId ? { areaId } : {};
  const { data } = await api.get('/tables', { params });
  return data;
};

export const createTabletTable = async (tableData: {
  name: string;
  areaId: number;
  status?: string;
  isActive?: boolean;
}) => {
  const { data } = await api.post('/tables/tablet-temporary', tableData);
  return data;
};

export const getTableById = async (id: number | string) => {
  const { data } = await api.get(`/tables/${id}`);
  return data;
};

export const getWaiters = async () => {
  const { data } = await api.get('/users/waiters/list');
  return data;
};

// Orders
export const createOrder = async (orderData: any) => {
  const { data } = await api.post('/orders', orderData);
  return data;
};

export const getOrderById = async (id: number | string) => {
  const { data } = await api.get(`/orders/${id}`);
  return data;
};

export const getOrders = async (params?: { paymentStatus?: string }) => {
  const { data } = await api.get('/orders', { params });
  return data;
};

export const addItemsToOrder = async (
  id: number | string,
  payload: { items: any[]; manualSubmit?: boolean },
) => {
  const { data } = await api.patch(`/orders/${id}/items`, payload);
  return data;
};

export const submitOrder = async (id: number | string) => {
  const { data } = await api.post(`/orders/${id}/submit`);
  return data;
};

export const updateOrder = async (id: number | string, orderData: any) => {
  const { data } = await api.patch(`/orders/${id}`, orderData);
  return data;
};

export const updateOrderStatus = async (
  id: number | string,
  payload: { status: string; adminPassword?: string },
) => {
  const { data } = await api.patch(`/orders/${id}/status`, payload);
  return data;
};

export const printOrderAccount = async (id: number | string) => {
  const { data } = await api.post(`/orders/${id}/print`);
  return data;
};

export const updateTableStatus = async (id: number | string, status: string) => {
  const { data } = await api.patch(`/tables/${id}/status`, { status });
  return data;
};

export const getOpenOrders = async (orderType?: string) => {
  const params = orderType ? { orderType } : {};
  const { data } = await api.get('/orders/open', { params });
  return data;
};

export const createPayment = async (paymentData: any) => {
  const { data } = await api.post('/payments', paymentData);
  return data;
};

export const getPaymentsByOrder = async (orderId: number | string) => {
  const { data } = await api.get(`/payments/order/${orderId}`);
  return data;
};

export const getKitchenOrders = async (): Promise<KitchenOrderResponse[]> => {
  const { data } = await api.get('/kitchen/active');
  return data;
};

export const updateKitchenOrderStatus = async (
  id: number | string,
  status: KitchenStatus,
) => {
  const { data } = await api.patch(`/kitchen/${id}/status`, { status });
  return data;
};

export const updateKitchenItemStatus = async (
  itemId: number | string,
  status: string,
) => {
  const { data } = await api.patch(`/kitchen/item/${itemId}/status`, { status });
  return data;
};

// Shift
export const getActiveShift = async () => {
  const { data } = await api.get('/cash-shifts/current');
  return data;
};

export const getCurrentShiftSummary = async (): Promise<ShiftSummaryResponse> => {
  const { data } = await api.get('/cash-shifts/current/summary');
  return data;
};

export const getShiftAvailability = async (): Promise<{
  hasOpenShift: boolean;
  shift: { id: number; openedAt: string; user: { id: number; name: string } } | null;
}> => {
  const { data } = await api.get('/cash-shifts/availability');
  return data;
};

export const openShift = async (openingAmount: number) => {
  const { data } = await api.post('/cash-shifts/open', { openingAmount });
  return data;
};

export const closeShift = async (
  shiftId: number,
  closingData: any,
): Promise<CloseShiftResponse> => {
  const { data } = await api.patch(`/cash-shifts/${shiftId}/close`, closingData);
  return data;
};

export const getShiftSummary = async (shiftId: number) => {
  const { data } = await api.get(`/cash-shifts/${shiftId}/summary`);
  return data;
};

export const addCashMovement = async (shiftId: number, movementData: any) => {
  const { data } = await api.post(`/cash-shifts/${shiftId}/movements`, movementData);
  return data;
};

export const getShifts = async () => {
  const { data } = await api.get('/cash-shifts');
  return data;
};

export const resendShiftEmail = async (
  shiftId: number,
  payload?: {
    to?: string;
    cc?: string;
  },
) => {
  const { data } = await api.post(`/cash-shifts/${shiftId}/email`, payload ?? {});
  return data;
};

// Settings
export const getSystemSettings = async () => {
  const { data } = await api.get<SettingsResponse>('/settings');
  return data;
};

export const getSettings = getSystemSettings;

export const getAdminSettings = async () => {
  const { data } = await api.get<SettingsResponse>('/settings/admin');
  return data;
};

export const updateSystemSettings = async (settingsData: any) => {
  const { data } = await api.patch<SettingsResponse>('/settings', settingsData);
  return data;
};

export const updateSettings = updateSystemSettings;

export const testShiftEmailSettings = async (payload: {
  shiftEmailHost?: string;
  shiftEmailPort?: number;
  shiftEmailSecure?: boolean;
  shiftEmailUser?: string;
  shiftEmailPassword?: string;
  shiftEmailFrom?: string;
  shiftEmailTo?: string;
  shiftEmailCc?: string;
}) => {
  const { data } = await api.post('/cash-shifts/email/test', payload);
  return data;
};

export const clearBusinessData = async (password: string) => {
  const { data } = await api.post('/orders/maintenance/clear-all', { password });
  return data;
};

export const clearEmployeesData = async (password: string) => {
  const { data } = await api.post('/employees/maintenance/clear-all', { password });
  return data;
};

export const getInstalledPrinters = async (): Promise<string[]> => {
  if (isDesktopRuntime()) {
    const token = (await getDesktopSessionToken()) || undefined;
    const printers = await getDesktopInstalledPrinters(token);
    if (printers) {
      return printers;
    }
  }

  const { data } = await api.get<string[]>('/settings/printers');
  return data;
};

export const printOrderReceipt = async (
  orderId: number | string,
  payload?: {
    type?: 'CLIENT' | 'KITCHEN';
    printerName?: string;
    paperWidth?: '58' | '80';
    copies?: number;
    openDrawer?: boolean;
  },
) => {
  if (isDesktopRuntime()) {
    const token = await getDesktopSessionToken();

    if (!token) {
      throw new Error('No hay sesion activa para imprimir. Inicia sesion de nuevo.');
    }

    const data = await printDesktopOrderReceipt({
      token,
      orderId,
      ...payload,
    });

    if (data) {
      return data;
    }
  }

  const { data } = await api.post(`/printing/orders/${orderId}/receipt`, payload ?? {});
  return data;
};

export const getPrintTemplateTypes = async () => {
  const { data } = await api.get('/print-templates/types');
  return data;
};

export const getPrintTemplates = async (params?: {
  documentType?: string;
  paperWidth?: '58' | '80';
  activeOnly?: boolean;
}): Promise<PrintTemplateResponse[]> => {
  const { data } = await api.get('/print-templates', { params });
  return data;
};

export const getPrintTemplateById = async (id: number): Promise<PrintTemplateResponse> => {
  const { data } = await api.get(`/print-templates/${id}`);
  return data;
};

export const createPrintTemplate = async (payload: any): Promise<PrintTemplateResponse> => {
  const { data } = await api.post('/print-templates', payload);
  return data;
};

export const updatePrintTemplate = async (id: number, payload: any): Promise<PrintTemplateResponse> => {
  const { data } = await api.patch(`/print-templates/${id}`, payload);
  return data;
};

export const duplicatePrintTemplate = async (id: number): Promise<PrintTemplateResponse> => {
  const { data } = await api.post(`/print-templates/${id}/duplicate`);
  return data;
};

export const activatePrintTemplate = async (id: number): Promise<PrintTemplateResponse> => {
  const { data } = await api.post(`/print-templates/${id}/activate`);
  return data;
};

export const restoreDefaultPrintTemplate = async (payload: {
  documentType: string;
  paperWidth: '58' | '80';
}): Promise<PrintTemplateResponse> => {
  const { data } = await api.post('/print-templates/restore-default', payload);
  return data;
};

export const previewPrintTemplate = async (payload: {
  documentType: string;
  paperWidth: '58' | '80';
  templateId?: number;
  orderId?: number;
  shiftId?: number;
  cashMovementId?: number;
}) => {
  const { data } = await api.post('/print-templates/preview', payload);
  return data;
};

export const getPrintJobs = async (params?: {
  status?: string;
  documentType?: string;
}): Promise<PrintJobResponse[]> => {
  const { data } = await api.get('/print-jobs', { params });
  return data;
};

export const getPrintJobById = async (id: string): Promise<PrintJobResponse> => {
  const { data } = await api.get(`/print-jobs/${id}`);
  return data;
};

export const createPrintJob = async (payload: {
  documentType: string;
  entityType: 'ORDER' | 'CASH_SHIFT' | 'CASH_MOVEMENT';
  entityId: string;
  printerName?: string;
  paperWidth?: '58' | '80';
  copies?: number;
  source?: string;
}) => {
  if (isDesktopRuntime()) {
    const token = await getDesktopSessionToken();
    if (token) {
      const data = await printDesktopDocument({
        token,
        documentType: payload.documentType as any,
        entityType: payload.entityType,
        entityId: payload.entityId,
        printerName: payload.printerName,
        paperWidth: payload.paperWidth,
        copies: payload.copies,
        source: payload.source,
      });
      if (data) return data;
    }
  }

  const { data } = await api.post('/print-jobs', payload);
  return data;
};

export const reprintPrintJob = async (jobId: string) => {
  if (isDesktopRuntime()) {
    const token = await getDesktopSessionToken();
    if (token) {
      const data = await reprintDesktopDocument({ token, jobId });
      if (data) return data;
    }
  }

  const { data } = await api.post(`/print-jobs/${jobId}/reprint`);
  return data;
};

export const getPrintJobStatus = async (jobId: string) => {
  if (isDesktopRuntime()) {
    const token = await getDesktopSessionToken();
    if (token) {
      const data = await getDesktopPrintJobStatus({ token, jobId });
      if (data) return data;
    }
  }

  const { data } = await api.get(`/print-jobs/${jobId}/status`);
  return data;
};

export const testPrintDocument = async (payload: {
  documentType?: string;
  printerName?: string;
  paperWidth?: '58' | '80';
  message?: string;
}) => {
  if (isDesktopRuntime()) {
    const token = localStorage.getItem('token') || undefined;
    const data = await testDesktopPrint({
      token,
      documentType: payload.documentType as any,
      printerName: payload.printerName,
      paperWidth: payload.paperWidth,
      message: payload.message,
    });
    if (data) {
      return data;
    }
  }

  throw new Error('La prueba física de impresión solo está disponible en Electron.');
};

// Users
export const getUsers = async (role?: string) => {
  const params = role ? { role } : {};
  const { data } = await api.get('/users', { params });
  return data;
};

export const getRoles = async () => {
  const { data } = await api.get('/roles');
  return data;
};

export const createUser = async (userData: any) => {
  const { data } = await api.post('/users', userData);
  return data;
};

export const updateUser = async (id: string | number, userData: any) => {
  const { data } = await api.patch(`/users/${id}`, userData);
  return data;
};

export const deleteUser = async (id: string | number) => {
  const { data } = await api.delete(`/users/${id}`);
  return data;
};

// Employees
export const getEmployees = async () => {
  const { data } = await api.get('/employees');
  return data;
};

export const getEmployeesBasicList = async () => {
  const { data } = await api.get('/employees/basic-list');
  return data;
};

export const getEmployeeById = async (id: string | number) => {
  const { data } = await api.get(`/employees/${id}`);
  return data;
};

export const createEmployee = async (payload: any) => {
  const { data } = await api.post('/employees', payload);
  return data;
};

export const updateEmployee = async (id: string | number, payload: any) => {
  const { data } = await api.patch(`/employees/${id}`, payload);
  return data;
};

export const getEmployeeLedger = async (
  id: string | number,
  params?: { type?: string; startDate?: string; endDate?: string },
) => {
  const { data } = await api.get(`/employees/${id}/ledger`, { params });
  return data;
};

export const getEmployeeAttendance = async (
  id: string | number,
  params?: { startDate?: string; endDate?: string },
) => {
  const { data } = await api.get(`/employees/${id}/attendance`, { params });
  return data;
};

export const createEmployeeAttendance = async (id: string | number, payload: any) => {
  const { data } = await api.post(`/employees/${id}/attendance`, payload);
  return data;
};

export const generateEmployeeCode = () =>
  Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');

export const createEmployeeAdvance = async (id: string | number, payload: any) => {
  const { data } = await api.post(`/employees/${id}/ledger/advance`, payload);
  return data;
};

export const createEmployeeDebt = async (id: string | number, payload: any) => {
  const { data } = await api.post(`/employees/${id}/ledger/debt`, payload);
  return data;
};

export const createEmployeeConsumption = async (id: string | number, payload: any) => {
  const { data } = await api.post(`/employees/${id}/ledger/consumption`, payload);
  return data;
};

export const getEmployeePayrollPreview = async (
  id: string | number,
  params: PayrollPreviewParams,
) => {
  const { data } = await api.get(`/employees/${id}/payroll-preview`, { params });
  return data;
};

export const closeEmployeePayroll = async (id: string | number, payload: PayrollPreviewParams) => {
  const { data } = await api.post(`/employees/${id}/payrolls/close`, payload);
  return data;
};

export const getPayrolls = async (params?: {
  employeeId?: number | string;
  status?: string;
  startDate?: string;
  endDate?: string;
}) => {
  const { data } = await api.get('/payrolls', { params });
  return data;
};

export const getPayrollById = async (id: string | number) => {
  const { data } = await api.get(`/payrolls/${id}`);
  return data;
};

export const markPayrollPaid = async (id: string | number) => {
  const { data } = await api.patch(`/payrolls/${id}/mark-paid`);
  return data;
};

// Customers
export const getCustomers = async (searchTerm?: string) => {
  const params = searchTerm ? { search: searchTerm } : {};
  const { data } = await api.get('/customers', { params });
  return data;
};

export const getCustomersByPhone = async (phone?: string) => {
  const params = phone ? { phone } : {};
  const { data } = await api.get('/customers', { params });
  return data;
};

export const getCustomerAddresses = async (id: string | number) => {
  const { data } = await api.get(`/customers/${id}/addresses`);
  return data;
};

export const getCustomerById = async (id: string | number) => {
  const { data } = await api.get(`/customers/${id}`);
  return data;
};

export const getCustomerOrders = async (id: string | number) => {
  const { data } = await api.get(`/customers/${id}/orders`);
  return data;
};

export const createCustomer = async (customerData: any) => {
  const { data } = await api.post('/customers', customerData);
  return data;
};

export const findOrCreateCustomer = async (payload: { phone: string; name?: string }) => {
  const { data } = await api.post('/customers/find-or-create', payload);
  return data;
};

export const getCustomerPoints = async (id: string | number) => {
  const { data } = await api.get(`/customers/${id}/points`);
  return data;
};

export const createCustomerAddress = async (id: string | number, addressData: any) => {
  const { data } = await api.post(`/customers/${id}/addresses`, addressData);
  return data;
};

export const updateCustomer = async (id: string | number, customerData: any) => {
  const { data } = await api.patch(`/customers/${id}`, customerData);
  return data;
};

export const getCustomerLoyalty = async (id: string | number) => {
  const { data } = await api.get(`/customers/${id}/loyalty`);
  return data;
};

export const redeemLoyaltyProduct = async (payload: {
  customerId: number;
  redeemableProductId: number;
  quantity?: number;
  notes?: string;
}) => {
  const { data } = await api.post('/loyalty/redeem-product', payload);
  return data;
};

// Reports
export const getDailySummary = async (params: { date?: string; shiftId?: number }) => {
  const { data } = await api.get('/reports/summary', { params });
  return data;
};

export const getSalesHistory = async (params: { startDate?: string; endDate?: string; searchTerm?: string; shiftId?: number }) => {
  const { data } = await api.get('/reports/sales', { params });
  return data;
};

export default api;
