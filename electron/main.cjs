const { app, BrowserWindow, dialog, ipcMain, safeStorage } = require('electron');
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { promisify } = require('node:util');
const {
  buildEscPosDrawerPulse,
  buildEscPosReceipt,
  buildEscPosRenderedDocument,
  buildEscPosShiftReport,
} = require('./escpos.cjs');

const execFileAsync = promisify(execFile);

const DESKTOP_BACKEND_PORT = Number(process.env.FATBOY_BACKEND_PORT || 3000);
const DESKTOP_BACKEND_HOST = process.env.FATBOY_BACKEND_HOST || '127.0.0.1';
const DESKTOP_BACKEND_ORIGIN = `http://${DESKTOP_BACKEND_HOST}:${DESKTOP_BACKEND_PORT}`;
const DESKTOP_API_BASE = `${DESKTOP_BACKEND_ORIGIN}/api`;
const isDev = !app.isPackaged;
const MAX_PRINT_QUEUE_ITEMS = 60;

let mainWindow = null;
let desktopPrintSequence = 0;
let isProcessingPrintQueue = false;
let desktopSessionToken = null;
let printPollingTimer = null;
const desktopPrintQueue = [];
const pendingPrintJobs = [];

app.setName('Fatboy POS');

function getFrontendEntry() {
  if (isDev) {
    return 'http://127.0.0.1:5173';
  }

  return `file://${path.join(__dirname, '..', 'frontend', 'dist', 'index.html')}`;
}

function getWindowIcon() {
  if (isDev) {
    return path.join(__dirname, '..', 'frontend', 'public', 'favicon.svg');
  }

  return path.join(__dirname, '..', 'frontend', 'dist', 'favicon.svg');
}

function resolvePowerShellExecutable() {
  const systemRoot = process.env.SystemRoot || process.env.WINDIR || 'C:\\Windows';
  const candidates = [
    path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    path.join(systemRoot, 'Sysnative', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    'powershell.exe',
    'pwsh.exe',
  ];

  return candidates[0];
}

function getRawEscPosScriptPath() {
  const scriptPath = path.join(app.getPath('userData'), 'Send-RawEscPos.ps1');

  if (!fs.existsSync(scriptPath)) {
    fs.writeFileSync(
      scriptPath,
      `param(
  [Parameter(Mandatory = $true)]
  [string]$PrinterName,

  [Parameter(Mandatory = $true)]
  [string]$Base64
)

$code = @"
using System;
using System.Runtime.InteropServices;

public static class RawPrinterHelper {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFO {
    [MarshalAs(UnmanagedType.LPWStr)]
    public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)]
    public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)]
    public string pDataType;
  }

  [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In] DOCINFO di);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);
}
"@

Add-Type -TypeDefinition $code | Out-Null

$bytes = [Convert]::FromBase64String($Base64)
$handle = [IntPtr]::Zero
$docInfo = New-Object RawPrinterHelper+DOCINFO
$docInfo.pDocName = "Fatboy ESC/POS Ticket"
$docInfo.pDataType = "RAW"

if (-not [RawPrinterHelper]::OpenPrinter($PrinterName, [ref]$handle, [IntPtr]::Zero)) {
  throw "No se pudo abrir la impresora '$PrinterName'. Verifica que exista en Windows."
}

$buffer = [System.Runtime.InteropServices.Marshal]::AllocCoTaskMem($bytes.Length)

try {
  [System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $buffer, $bytes.Length)

  if (-not [RawPrinterHelper]::StartDocPrinter($handle, 1, $docInfo)) {
    throw "No se pudo iniciar el documento RAW en la impresora '$PrinterName'."
  }

  try {
    if (-not [RawPrinterHelper]::StartPagePrinter($handle)) {
      throw "No se pudo iniciar la pagina RAW en la impresora '$PrinterName'."
    }

    try {
      $written = 0
      if (-not [RawPrinterHelper]::WritePrinter($handle, $buffer, $bytes.Length, [ref]$written)) {
        throw "No se pudieron enviar bytes RAW a la impresora '$PrinterName'."
      }

      if ($written -ne $bytes.Length) {
        throw "La impresora '$PrinterName' recibio $written de $($bytes.Length) bytes."
      }
    }
    finally {
      [RawPrinterHelper]::EndPagePrinter($handle) | Out-Null
    }
  }
  finally {
    [RawPrinterHelper]::EndDocPrinter($handle) | Out-Null
  }
}
finally {
  if ($buffer -ne [IntPtr]::Zero) {
    [System.Runtime.InteropServices.Marshal]::FreeCoTaskMem($buffer)
  }
  if ($handle -ne [IntPtr]::Zero) {
    [RawPrinterHelper]::ClosePrinter($handle) | Out-Null
  }
}
`,
      'utf8',
    );
  }

  return scriptPath;
}

function getAuthHeaders(token) {
  if (!token) {
    throw new Error('No hay sesion activa para imprimir. Inicia sesion de nuevo.');
  }

  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
}

async function fetchBackendJson(url, token, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...getAuthHeaders(token),
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    let message = `Error ${response.status} al consultar el backend`;

    try {
      const payload = await response.json();
      if (payload?.message) {
        message = Array.isArray(payload.message) ? payload.message.join(', ') : String(payload.message);
      }
    } catch {
      // noop
    }

    throw new Error(message);
  }

  return response.json();
}

async function sendBackendJson(url, token, method = 'POST', body = {}) {
  return fetchBackendJson(url, token, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function getInstalledPrinters() {
  const command = 'Get-Printer | Select-Object -ExpandProperty Name | ConvertTo-Json -Compress';
  const { stdout } = await execFileAsync(
    resolvePowerShellExecutable(),
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
    { windowsHide: true, maxBuffer: 1024 * 1024 * 4, timeout: 15000 },
  );

  const parsed = JSON.parse(stdout || '[]');
  const names = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];

  return names
    .map((name) => String(name).trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'es-MX'));
}

async function sendRawEscPosToPrinter(printerName, base64) {
  const scriptPath = getRawEscPosScriptPath();
  await execFileAsync(
    resolvePowerShellExecutable(),
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath,
      '-PrinterName',
      printerName,
      '-Base64',
      base64,
    ],
    { windowsHide: true, maxBuffer: 1024 * 1024 * 4, timeout: 20000 },
  );
}

function resolvePrintRouting(settings = {}, payload = {}) {
  const type = payload.type || 'CLIENT';
  const printerName =
    payload.printerName ||
    (type === 'KITCHEN'
      ? settings.kitchenPrinterName || settings.receiptPrinterName || null
      : settings.receiptPrinterName || settings.kitchenPrinterName || null);
  const paperWidth =
    payload.paperWidth ||
    (type === 'KITCHEN'
      ? settings.kitchenPaperWidth || settings.receiptPaperWidth || '80'
      : settings.receiptPaperWidth || settings.kitchenPaperWidth || '80');

  return { type, printerName, paperWidth };
}

async function printOrderReceiptFromDesktop({
  token,
  orderId,
  type = 'CLIENT',
  printerName,
  paperWidth,
  copies = 1,
  openDrawer = false,
}) {
  const settings = await fetchBackendJson(`${DESKTOP_API_BASE}/settings`, token);
  const order = await fetchBackendJson(`${DESKTOP_API_BASE}/orders/${orderId}`, token);
  const routing = resolvePrintRouting(settings, {
    type,
    printerName,
    paperWidth,
  });
  const resolvedPrinterName = routing.printerName;
  const resolvedPaperWidth = routing.paperWidth;

  if (!resolvedPrinterName) {
    throw new Error(
      type === 'KITCHEN'
        ? 'No hay impresora configurada para produccion. Configura la impresora HM/produccion en Ajustes.'
        : 'No hay impresora configurada. Configura la impresora de tickets en Ajustes.',
    );
  }

  const payload = buildEscPosReceipt({
    order,
    type,
    paperWidth: resolvedPaperWidth,
    restaurantName: settings.restaurantName,
    restaurantAddress: settings.restaurantAddress,
    openDrawer,
    cutPaper: settings.receiptCutEnabled ?? true,
  });

  for (let copy = 0; copy < copies; copy += 1) {
    await sendRawEscPosToPrinter(resolvedPrinterName, payload.toString('base64'));
  }

  return {
    success: true,
    printerName: resolvedPrinterName,
    type: routing.type,
    copies,
    paperWidth: resolvedPaperWidth,
  };
}

async function printShiftReportFromDesktop({
  shift,
  report,
  restaurantName,
  restaurantAddress,
  printerName,
  paperWidth,
  copies = 1,
  cutPaper = true,
}) {
  const resolvedPrinterName = printerName;
  const resolvedPaperWidth = paperWidth || '80';

  if (!resolvedPrinterName) {
    throw new Error('No hay impresora configurada. Configura la impresora de tickets en Ajustes.');
  }

  const payload = buildEscPosShiftReport({
    shift,
    report,
    paperWidth: resolvedPaperWidth,
    restaurantName,
    restaurantAddress,
    cutPaper,
  });

  for (let copy = 0; copy < copies; copy += 1) {
    await sendRawEscPosToPrinter(resolvedPrinterName, payload.toString('base64'));
  }

  return {
    success: true,
    printerName: resolvedPrinterName,
    copies,
    paperWidth: resolvedPaperWidth,
  };
}

async function openCashDrawerFromDesktop({
  token,
  printerName,
}) {
  const settings = await fetchBackendJson(`${DESKTOP_API_BASE}/settings`, token);
  const resolvedPrinterName = printerName || settings.receiptPrinterName;

  if (!resolvedPrinterName) {
    throw new Error('No hay impresora configurada. Configura la impresora de tickets en Ajustes.');
  }

  if (!settings.cashDrawerEnabled) {
    throw new Error('La apertura de cajón está deshabilitada en Ajustes.');
  }

  const payload = buildEscPosDrawerPulse();
  await sendRawEscPosToPrinter(resolvedPrinterName, payload.toString('base64'));

  return {
    success: true,
    printerName: resolvedPrinterName,
  };
}

function serializePrintQueueEntry(entry) {
  return {
    id: entry.id,
    jobId: entry.jobId,
    printJobId: entry.printJobId || null,
    orderId: entry.orderId,
    type: entry.type,
    documentType: entry.documentType || null,
    entityType: entry.entityType || null,
    entityId: entry.entityId || null,
    source: entry.source,
    printerName: entry.printerName,
    paperWidth: entry.paperWidth,
    copies: entry.copies,
    status: entry.status,
    error: entry.error,
    attempts: entry.attempts || 0,
    maxAttempts: entry.maxAttempts || 0,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

function getPrintQueueSnapshot() {
  return desktopPrintQueue.map(serializePrintQueueEntry);
}

function emitPrintQueueChanged() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send('fatboy:print-queue-changed', getPrintQueueSnapshot());
}

function updatePrintQueueEntry(entry, patch) {
  Object.assign(entry, patch, { updatedAt: new Date().toISOString() });
  emitPrintQueueChanged();
}

function pushPrintQueueEntry(entry) {
  desktopPrintQueue.unshift(entry);
  if (desktopPrintQueue.length > MAX_PRINT_QUEUE_ITEMS) {
    desktopPrintQueue.length = MAX_PRINT_QUEUE_ITEMS;
  }
  emitPrintQueueChanged();
}

async function processPrintQueue() {
  if (isProcessingPrintQueue) {
    return;
  }

  isProcessingPrintQueue = true;

  while (pendingPrintJobs.length > 0) {
    const job = pendingPrintJobs.shift();
    if (!job) {
      continue;
    }

    updatePrintQueueEntry(job.entry, { status: 'printing', error: null });

    try {
      const result =
        job.kind === 'remote'
          ? await processRemotePrintJob(job)
          : await printOrderReceiptFromDesktop(job.payload);
      updatePrintQueueEntry(job.entry, {
        status: 'printed',
        printerName: result.printerName || job.entry.printerName,
        paperWidth: result.paperWidth || job.entry.paperWidth,
      });
      job.resolve(result);
    } catch (error) {
      updatePrintQueueEntry(job.entry, {
        status: 'failed',
        error: error?.message || 'No se pudo imprimir el ticket',
      });
      job.reject(error);
    }
  }

  isProcessingPrintQueue = false;
}

function enqueuePrintJob(payload = {}) {
  const timestamp = new Date().toISOString();
  const entry = {
    id: `desktop-print-${Date.now()}-${desktopPrintSequence += 1}`,
    jobId: payload.jobId || null,
    printJobId: null,
    orderId: Number(payload.orderId) || 0,
    type: payload.type || 'CLIENT',
    documentType: null,
    entityType: null,
    entityId: null,
    source: payload.source || 'desktop',
    printerName: payload.printerName || null,
    paperWidth: payload.paperWidth || null,
    copies: Number(payload.copies || 1),
    status: 'queued',
    error: null,
    attempts: 0,
    maxAttempts: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  pushPrintQueueEntry(entry);

  return new Promise((resolve, reject) => {
    pendingPrintJobs.push({ kind: 'legacy', entry, payload, resolve, reject });
    void processPrintQueue();
  });
}

function findQueueEntryByPrintJobId(printJobId) {
  return desktopPrintQueue.find((entry) => entry.printJobId === printJobId) || null;
}

function enqueueRemotePrintJob(jobSummary) {
  const existing = findQueueEntryByPrintJobId(jobSummary.id);
  if (existing) {
    return Promise.resolve(existing);
  }

  const timestamp = new Date().toISOString();
  const entry = {
    id: `desktop-job-${Date.now()}-${desktopPrintSequence += 1}`,
    jobId: jobSummary.id,
    printJobId: jobSummary.id,
    orderId: Number(jobSummary.entityType === 'ORDER' ? jobSummary.entityId : 0) || 0,
    type: jobSummary.documentType === 'KITCHEN_TICKET' ? 'KITCHEN' : 'CLIENT',
    documentType: jobSummary.documentType,
    entityType: jobSummary.entityType,
    entityId: jobSummary.entityId,
    source: jobSummary.source || 'backend',
    printerName: jobSummary.printerName || null,
    paperWidth: jobSummary.paperWidth || null,
    copies: Number(jobSummary.copies || 1),
    status: jobSummary.status || 'pending',
    error: jobSummary.lastError || null,
    attempts: Number(jobSummary.attempts || 0),
    maxAttempts: Number(jobSummary.maxAttempts || 0),
    createdAt: jobSummary.createdAt || timestamp,
    updatedAt: jobSummary.updatedAt || timestamp,
  };

  pushPrintQueueEntry(entry);

  return new Promise((resolve, reject) => {
    pendingPrintJobs.push({ kind: 'remote', entry, printJobId: jobSummary.id, resolve, reject });
    void processPrintQueue();
  });
}

function resolveDocumentRouting(settings = {}, printJob = {}) {
  const documentType = String(printJob.documentType || '');
  const isKitchen =
    documentType === 'KITCHEN_TICKET' ||
    String(printJob.type || '').toUpperCase() === 'KITCHEN';

  return {
    printerName:
      printJob.printerName ||
      (isKitchen
        ? settings.kitchenPrinterName || settings.receiptPrinterName || null
        : settings.receiptPrinterName || settings.kitchenPrinterName || null),
    paperWidth:
      printJob.paperWidth ||
      (isKitchen
        ? settings.kitchenPaperWidth || settings.receiptPaperWidth || '80'
        : settings.receiptPaperWidth || settings.kitchenPaperWidth || '80'),
  };
}

async function printBackendJob(jobDetail, settings) {
  const routing = resolveDocumentRouting(settings, jobDetail);

  if (!routing.printerName) {
    throw new Error('No hay impresora configurada para el documento solicitado.');
  }

  const payload = buildEscPosRenderedDocument({
    renderedDocument: jobDetail.renderedDocument,
    paperWidth: routing.paperWidth,
    cutPaper: settings.receiptCutEnabled ?? true,
    openDrawer: false,
  });

  const copies = Number(jobDetail.copies || 1);
  for (let copy = 0; copy < copies; copy += 1) {
    await sendRawEscPosToPrinter(routing.printerName, payload.toString('base64'));
  }

  return {
    success: true,
    printerName: routing.printerName,
    paperWidth: routing.paperWidth,
    copies,
  };
}

async function processRemotePrintJob(job) {
  if (!desktopSessionToken) {
    throw new Error('No hay sesión activa en Electron para procesar la cola.');
  }

  const claimed = await sendBackendJson(
    `${DESKTOP_API_BASE}/print-jobs/${job.printJobId}/claim`,
    desktopSessionToken,
    'POST',
    {},
  );

  updatePrintQueueEntry(job.entry, {
    status: claimed.status || 'processing',
    attempts: Number(claimed.attempts || 0),
    maxAttempts: Number(claimed.maxAttempts || 0),
  });

  if (claimed.status !== 'processing') {
    return claimed;
  }

  const [jobDetail, settings] = await Promise.all([
    fetchBackendJson(`${DESKTOP_API_BASE}/print-jobs/${job.printJobId}`, desktopSessionToken),
    fetchBackendJson(`${DESKTOP_API_BASE}/settings`, desktopSessionToken),
  ]);

  try {
    const result = await printBackendJob(jobDetail, settings);
    await sendBackendJson(
      `${DESKTOP_API_BASE}/print-jobs/${job.printJobId}/status`,
      desktopSessionToken,
      'PATCH',
      {
        status: 'printed',
        printerName: result.printerName,
        metadata: {
          processedBy: 'electron-main',
        },
      },
    );

    return result;
  } catch (error) {
    await sendBackendJson(
      `${DESKTOP_API_BASE}/print-jobs/${job.printJobId}/status`,
      desktopSessionToken,
      'PATCH',
      {
        status: 'failed',
        message: error?.message || 'No se pudo imprimir el documento',
        metadata: {
          processedBy: 'electron-main',
        },
      },
    ).catch(() => undefined);
    throw error;
  }
}

async function syncPendingPrintJobs() {
  if (!desktopSessionToken) {
    return;
  }

  const jobs = await fetchBackendJson(
    `${DESKTOP_API_BASE}/print-jobs?status=pending`,
    desktopSessionToken,
  );

  for (const job of jobs) {
    if (!findQueueEntryByPrintJobId(job.id)) {
      void enqueueRemotePrintJob(job);
    }
  }
}

function restartPrintPolling() {
  if (printPollingTimer) {
    clearInterval(printPollingTimer);
    printPollingTimer = null;
  }

  if (!desktopSessionToken) {
    return;
  }

  void syncPendingPrintJobs().catch(() => undefined);
  printPollingTimer = setInterval(() => {
    void syncPendingPrintJobs().catch(() => undefined);
  }, 3000);
}

function getSessionPath() {
  return path.join(app.getPath('userData'), 'session.dat');
}

function saveTokenToDisk(token) {
  try {
    const sessionPath = getSessionPath();
    if (!token) {
      if (fs.existsSync(sessionPath)) fs.unlinkSync(sessionPath);
      return;
    }

    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(token);
      fs.writeFileSync(sessionPath, encrypted);
    } else {
      // Fallback for systems without encryption if needed, but safeStorage is usually fine
      fs.writeFileSync(sessionPath, Buffer.from(token, 'utf8'));
    }
  } catch (error) {
    console.error('Error saving session token:', error);
  }
}

function loadTokenFromDisk() {
  try {
    const sessionPath = getSessionPath();
    if (!fs.existsSync(sessionPath)) return null;

    const data = fs.readFileSync(sessionPath);
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(data);
    }
    return data.toString('utf8');
  } catch (error) {
    console.error('Error loading session token:', error);
    return null;
  }
}

function setDesktopSessionToken(token) {
  desktopSessionToken = token || null;
  saveTokenToDisk(desktopSessionToken);
  restartPrintPolling();
}

async function requestLegacyOrderPrint(payload = {}) {
  const { token, orderId, ...body } = payload;

  if (!token) {
    throw new Error('No hay sesión activa para solicitar impresión.');
  }

  const response = await sendBackendJson(
    `${DESKTOP_API_BASE}/printing/orders/${orderId}/receipt`,
    token,
    'POST',
    body,
  );

  setDesktopSessionToken(token);
  await syncPendingPrintJobs().catch(() => undefined);
  return response;
}

async function requestDocumentPrint(payload = {}) {
  const { token, ...body } = payload;

  if (!token) {
    throw new Error('No hay sesión activa para solicitar impresión.');
  }

  const response = await sendBackendJson(
    `${DESKTOP_API_BASE}/print-jobs`,
    token,
    'POST',
    body,
  );

  setDesktopSessionToken(token);
  await syncPendingPrintJobs().catch(() => undefined);
  return response;
}

async function reprintDocumentFromDesktop(payload = {}) {
  const { token, jobId } = payload;

  if (!token || !jobId) {
    throw new Error('Faltan datos para reimprimir el documento.');
  }

  const response = await sendBackendJson(
    `${DESKTOP_API_BASE}/print-jobs/${jobId}/reprint`,
    token,
    'POST',
    {},
  );

  setDesktopSessionToken(token);
  await syncPendingPrintJobs().catch(() => undefined);
  return response;
}

async function getPrintJobStatusFromDesktop(payload = {}) {
  const { token, jobId } = payload;

  if (!token || !jobId) {
    throw new Error('Faltan datos para consultar el estado del trabajo.');
  }

  return fetchBackendJson(`${DESKTOP_API_BASE}/print-jobs/${jobId}/status`, token);
}

async function testPrintFromDesktop(payload = {}) {
  const settings = payload.token
    ? await fetchBackendJson(`${DESKTOP_API_BASE}/settings`, payload.token)
    : {};
  const routing = resolveDocumentRouting(settings, {
    documentType: payload.documentType || 'FAST_FOOD_RECEIPT',
    printerName: payload.printerName,
    paperWidth: payload.paperWidth,
  });

  if (!routing.printerName) {
    throw new Error('No hay impresora configurada para la prueba.');
  }

  const renderedDocument = {
    lines: [
      { text: 'PRUEBA DE IMPRESION', alignment: 'center', bold: true, fontSize: 'large' },
      { text: new Date().toLocaleString('es-MX', { hour12: false }), alignment: 'center' },
      { text: payload.message || 'Fatboy POS - cola de impresion operativa', alignment: 'left' },
    ],
  };

  const buffer = buildEscPosRenderedDocument({
    renderedDocument,
    paperWidth: routing.paperWidth,
    cutPaper: true,
  });

  await sendRawEscPosToPrinter(routing.printerName, buffer.toString('base64'));

  return {
    success: true,
    printerName: routing.printerName,
    paperWidth: routing.paperWidth,
  };
}

function waitForPort(port, host = '127.0.0.1', timeoutMs = 30000) {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = new net.Socket();

      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });

      socket.once('error', () => {
        socket.destroy();

        if (Date.now() - start >= timeoutMs) {
          reject(new Error(`Timeout esperando backend en ${host}:${port}`));
          return;
        }

        setTimeout(attempt, 350);
      });

      socket.connect(port, host);
    };

    attempt();
  });
}

async function startBackendForDesktop() {
  if (isDev) {
    return;
  }

  await waitForPort(DESKTOP_BACKEND_PORT, DESKTOP_BACKEND_HOST, 6000).catch(() => {
    throw new Error(
      `No se encontro el servicio local del backend en ${DESKTOP_BACKEND_HOST}:${DESKTOP_BACKEND_PORT}. ` +
      'Inicia o verifica el servicio de Windows "FatboyPOSBackend" antes de abrir la aplicacion.',
    );
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'Fatboy POS',
    width: 1440,
    height: 920,
    minWidth: 1200,
    minHeight: 760,
    show: false,
    icon: getWindowIcon(),
    backgroundColor: '#0f0f10',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      additionalArguments: [
        `--fatboy-api-base-url=${DESKTOP_BACKEND_ORIGIN}/api`,
        `--fatboy-socket-url=${DESKTOP_BACKEND_ORIGIN}`,
      ],
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadURL(getFrontendEntry());
}

function registerDesktopIpc() {
  ipcMain.handle('fatboy:set-session-token', async (_event, payload = {}) => {
    setDesktopSessionToken(payload.token);
    return { ok: true };
  });

  ipcMain.handle('fatboy:get-session-token', async () => {
    if (!desktopSessionToken) {
      desktopSessionToken = loadTokenFromDisk();
      if (desktopSessionToken) {
        restartPrintPolling();
      }
    }
    return desktopSessionToken;
  });

  ipcMain.handle('fatboy:clear-session-token', async () => {
    setDesktopSessionToken(null);
    return { ok: true };
  });

  ipcMain.handle('fatboy:get-installed-printers', async (_event, { token } = {}) => {
    await startBackendForDesktop();
    if (token) {
      setDesktopSessionToken(token);
    }
    return getInstalledPrinters();
  });

  ipcMain.handle('fatboy:print-order-receipt', async (_event, payload = {}) => {
    await startBackendForDesktop();
    return requestLegacyOrderPrint(payload);
  });

  ipcMain.handle('fatboy:print-document', async (_event, payload = {}) => {
    await startBackendForDesktop();
    return requestDocumentPrint(payload);
  });

  ipcMain.handle('fatboy:test-print', async (_event, payload = {}) => {
    await startBackendForDesktop();
    return testPrintFromDesktop(payload);
  });

  ipcMain.handle('fatboy:reprint-document', async (_event, payload = {}) => {
    await startBackendForDesktop();
    return reprintDocumentFromDesktop(payload);
  });

  ipcMain.handle('fatboy:get-print-job-status', async (_event, payload = {}) => {
    await startBackendForDesktop();
    return getPrintJobStatusFromDesktop(payload);
  });

  ipcMain.handle('fatboy:print-shift-report', async (_event, payload = {}) => {
    await startBackendForDesktop();
    return printShiftReportFromDesktop(payload);
  });

  ipcMain.handle('fatboy:open-cash-drawer', async (_event, payload = {}) => {
    await startBackendForDesktop();
    return openCashDrawerFromDesktop(payload);
  });

  ipcMain.handle('fatboy:get-print-queue', async () => getPrintQueueSnapshot());
}

app.on('before-quit', () => {
  app.isQuitting = true;
  if (printPollingTimer) {
    clearInterval(printPollingTimer);
    printPollingTimer = null;
  }
});

app.whenReady().then(async () => {
  try {
    registerDesktopIpc();
    await startBackendForDesktop();
    createWindow();
  } catch (error) {
    dialog.showErrorBox(
      'Fatboy POS',
      `No se pudo iniciar la aplicación de escritorio.\n\n${error.message}`,
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await startBackendForDesktop();
    createWindow();
  }
});
