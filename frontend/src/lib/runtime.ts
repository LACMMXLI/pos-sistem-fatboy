type DesktopRuntimeConfig = {
  apiBaseUrl?: string;
  socketUrl?: string;
  serverConfig?: DesktopServerConnectionConfig;
  hasSavedServerConfig?: boolean;
};

export type DesktopServerConnectionConfig = {
  protocol: 'http' | 'https';
  host: string;
  port: number;
  origin?: string;
  apiBaseUrl?: string;
};

export type DesktopServerConnectionState = {
  hasSavedConfig: boolean;
  config: DesktopServerConnectionConfig;
  defaults: DesktopServerConnectionConfig;
};

export type DesktopServerConnectionTestResult = {
  ok: boolean;
  code: string;
  message: string;
  status?: number;
  details?: string;
  config?: DesktopServerConnectionConfig;
};

type DesktopPrintPayload = {
  token: string;
  orderId: number | string;
  type?: 'CLIENT' | 'KITCHEN';
  printerName?: string;
  paperWidth?: '58' | '80';
  copies?: number;
  openDrawer?: boolean;
  jobId?: string;
  source?: string;
};

type DesktopDocumentPrintPayload = {
  token: string;
  documentType:
    | 'KITCHEN_TICKET'
    | 'FAST_FOOD_RECEIPT'
    | 'DINE_IN_PRECHECK'
    | 'DINE_IN_FINAL_RECEIPT'
    | 'DELIVERY_RECEIPT'
    | 'CASH_CLOSING'
    | 'CASH_MOVEMENT'
    | 'REPRINT_COPY'
    | 'CANCEL_OR_VOID_RECEIPT';
  entityType: 'ORDER' | 'CASH_SHIFT' | 'CASH_MOVEMENT';
  entityId: string;
  printerName?: string;
  paperWidth?: '58' | '80';
  copies?: number;
  source?: string;
};

type DesktopShiftPrintPayload = {
  shift: any;
  report: any;
  restaurantName?: string;
  restaurantAddress?: string;
  printerName?: string;
  paperWidth?: '58' | '80';
  copies?: number;
  cutPaper?: boolean;
};

type DesktopCashDrawerPayload = {
  token: string;
  printerName?: string;
};

export type DesktopPrintQueueEntry = {
  id: string;
  jobId?: string | null;
  printJobId?: string | null;
  orderId: number;
  type: 'CLIENT' | 'KITCHEN';
  documentType?:
    | 'KITCHEN_TICKET'
    | 'FAST_FOOD_RECEIPT'
    | 'DINE_IN_PRECHECK'
    | 'DINE_IN_FINAL_RECEIPT'
    | 'DELIVERY_RECEIPT'
    | 'CASH_CLOSING'
    | 'CASH_MOVEMENT'
    | 'REPRINT_COPY'
    | 'CANCEL_OR_VOID_RECEIPT'
    | null;
  entityType?: 'ORDER' | 'CASH_SHIFT' | 'CASH_MOVEMENT' | null;
  entityId?: string | null;
  source?: string | null;
  printerName?: string | null;
  paperWidth?: '58' | '80' | null;
  copies: number;
  status: 'queued' | 'pending' | 'printing' | 'processing' | 'printed' | 'failed' | 'cancelled';
  error?: string | null;
  attempts?: number;
  maxAttempts?: number;
  createdAt: string;
  updatedAt: string;
};

declare global {
  interface Window {
    fatboyDesktop?: {
      getRuntimeConfig?: () => DesktopRuntimeConfig;
      getServerConfig?: () => Promise<DesktopServerConnectionState>;
      testServerConfig?: (
        payload: DesktopServerConnectionConfig,
      ) => Promise<DesktopServerConnectionTestResult>;
      saveServerConfig?: (
        payload: DesktopServerConnectionConfig,
      ) => Promise<{
        ok: boolean;
        message: string;
        config: DesktopServerConnectionConfig;
      }>;
      isDesktop?: () => boolean;
      getZoomFactor?: () => number;
      setZoomFactor?: (factor: number) => void;
      setSessionToken?: (token?: string | null) => Promise<{ ok: boolean }>;
      getSessionToken?: () => Promise<string | null>;
      clearSessionToken?: () => Promise<{ ok: boolean }>;
      getInstalledPrinters?: (token?: string) => Promise<string[]>;
      printOrderReceipt?: (payload: DesktopPrintPayload) => Promise<{
        success: boolean;
        printerName: string;
        type: 'CLIENT' | 'KITCHEN';
        copies: number;
        paperWidth: '58' | '80';
        jobId?: string;
      }>;
      printDocument?: (payload: DesktopDocumentPrintPayload) => Promise<any>;
      testPrint?: (payload: {
        token?: string;
        documentType?: DesktopDocumentPrintPayload['documentType'];
        printerName?: string;
        paperWidth?: '58' | '80';
        message?: string;
      }) => Promise<any>;
      reprintDocument?: (payload: { token: string; jobId: string }) => Promise<any>;
      getPrintJobStatus?: (payload: { token: string; jobId: string }) => Promise<any>;
      printShiftReport?: (payload: DesktopShiftPrintPayload) => Promise<{
        success: boolean;
        printerName: string;
        copies: number;
        paperWidth: '58' | '80';
      }>;
      openCashDrawer?: (payload: DesktopCashDrawerPayload) => Promise<{
        success: boolean;
        printerName: string;
      }>;
      getPrintQueue?: () => Promise<DesktopPrintQueueEntry[]>;
      onPrintQueueChanged?: (
        callback: (queue: DesktopPrintQueueEntry[]) => void,
      ) => (() => void) | undefined;
    };
  }
}

function getDesktopConfig(): DesktopRuntimeConfig {
  try {
    return window.fatboyDesktop?.getRuntimeConfig?.() ?? {};
  } catch {
    return {};
  }
}

export function getApiBaseUrl() {
  const desktopConfig = getDesktopConfig();
  return desktopConfig.apiBaseUrl || import.meta.env.VITE_API_BASE_URL || '/api';
}

export function getSocketUrl() {
  const desktopConfig = getDesktopConfig();
  return desktopConfig.socketUrl || import.meta.env.VITE_SOCKET_URL || '/';
}

export async function getDesktopServerConfig() {
  try {
    return await window.fatboyDesktop?.getServerConfig?.();
  } catch {
    return undefined;
  }
}

export async function testDesktopServerConfig(payload: DesktopServerConnectionConfig) {
  try {
    return await window.fatboyDesktop?.testServerConfig?.(payload);
  } catch (error: any) {
    return {
      ok: false,
      code: 'IPC_ERROR',
      message: error?.message || 'No se pudo probar la conexión con el backend.',
    } satisfies DesktopServerConnectionTestResult;
  }
}

export async function saveDesktopServerConfig(payload: DesktopServerConnectionConfig) {
  return window.fatboyDesktop?.saveServerConfig?.(payload);
}

export function isDesktopRuntime() {
  try {
    return window.fatboyDesktop?.isDesktop?.() ?? false;
  } catch {
    return false;
  }
}

export function getDesktopZoomFactor() {
  try {
    return window.fatboyDesktop?.getZoomFactor?.() ?? 1;
  } catch {
    return 1;
  }
}

export function setDesktopZoomFactor(factor: number) {
  try {
    window.fatboyDesktop?.setZoomFactor?.(factor);
  } catch {
    // noop
  }
}

export async function getDesktopInstalledPrinters(token?: string) {
  try {
    return await window.fatboyDesktop?.getInstalledPrinters?.(token);
  } catch {
    return undefined;
  }
}

export async function setDesktopSessionToken(token?: string | null) {
  try {
    return await window.fatboyDesktop?.setSessionToken?.(token);
  } catch {
    return undefined;
  }
}

export async function getDesktopSessionToken() {
  try {
    return await window.fatboyDesktop?.getSessionToken?.();
  } catch {
    return null;
  }
}

export async function clearDesktopSessionToken() {
  try {
    return await window.fatboyDesktop?.clearSessionToken?.();
  } catch {
    return undefined;
  }
}

export async function printDesktopOrderReceipt(payload: DesktopPrintPayload) {
  return window.fatboyDesktop?.printOrderReceipt?.(payload);
}

export async function printDesktopDocument(payload: DesktopDocumentPrintPayload) {
  return window.fatboyDesktop?.printDocument?.(payload);
}

export async function testDesktopPrint(payload: {
  token?: string;
  documentType?: DesktopDocumentPrintPayload['documentType'];
  printerName?: string;
  paperWidth?: '58' | '80';
  message?: string;
}) {
  return window.fatboyDesktop?.testPrint?.(payload);
}

export async function reprintDesktopDocument(payload: { token: string; jobId: string }) {
  return window.fatboyDesktop?.reprintDocument?.(payload);
}

export async function getDesktopPrintJobStatus(payload: { token: string; jobId: string }) {
  return window.fatboyDesktop?.getPrintJobStatus?.(payload);
}

export async function printDesktopShiftReport(payload: DesktopShiftPrintPayload) {
  return window.fatboyDesktop?.printShiftReport?.(payload);
}

export async function openDesktopCashDrawer(payload: DesktopCashDrawerPayload) {
  return window.fatboyDesktop?.openCashDrawer?.(payload);
}

export async function getDesktopPrintQueue() {
  try {
    return (await window.fatboyDesktop?.getPrintQueue?.()) ?? [];
  } catch {
    return [];
  }
}

export function subscribeDesktopPrintQueue(
  callback: (queue: DesktopPrintQueueEntry[]) => void,
) {
  try {
    return window.fatboyDesktop?.onPrintQueueChanged?.(callback) ?? (() => undefined);
  } catch {
    return () => undefined;
  }
}
