const { contextBridge, ipcRenderer, webFrame } = require('electron');

function readFlag(prefix) {
  const entry = process.argv.find((argument) => argument.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : undefined;
}

const runtimeConfig = {
  apiBaseUrl: readFlag('--fatboy-api-base-url='),
  socketUrl: readFlag('--fatboy-socket-url='),
};

try {
  Object.assign(runtimeConfig, ipcRenderer.sendSync('fatboy:get-runtime-config-sync') || {});
} catch {
  // Fallback to launch flags when IPC sync is not available.
}

ipcRenderer.on('fatboy:server-config-changed', (_event, nextConfig) => {
  Object.assign(runtimeConfig, nextConfig || {});
});

contextBridge.exposeInMainWorld('fatboyDesktop', {
  getRuntimeConfig: () => runtimeConfig,
  getServerConfig: () => ipcRenderer.invoke('fatboy:get-server-config'),
  testServerConfig: (payload) => ipcRenderer.invoke('fatboy:test-server-config', payload),
  saveServerConfig: (payload) => ipcRenderer.invoke('fatboy:save-server-config', payload),
  isDesktop: () => true,
  getZoomFactor: () => webFrame.getZoomFactor(),
  setZoomFactor: (factor) => webFrame.setZoomFactor(factor),
  setSessionToken: (token) => ipcRenderer.invoke('fatboy:set-session-token', { token }),
  getSessionToken: () => ipcRenderer.invoke('fatboy:get-session-token'),
  clearSessionToken: () => ipcRenderer.invoke('fatboy:clear-session-token'),
  getInstalledPrinters: (token) => ipcRenderer.invoke('fatboy:get-installed-printers', { token }),
  printOrderReceipt: (payload) => ipcRenderer.invoke('fatboy:print-order-receipt', payload),
  printDocument: (payload) => ipcRenderer.invoke('fatboy:print-document', payload),
  testPrint: (payload) => ipcRenderer.invoke('fatboy:test-print', payload),
  reprintDocument: (payload) => ipcRenderer.invoke('fatboy:reprint-document', payload),
  getPrintJobStatus: (payload) => ipcRenderer.invoke('fatboy:get-print-job-status', payload),
  printShiftReport: (payload) => ipcRenderer.invoke('fatboy:print-shift-report', payload),
  openCashDrawer: (payload) => ipcRenderer.invoke('fatboy:open-cash-drawer', payload),
  getPrintQueue: () => ipcRenderer.invoke('fatboy:get-print-queue'),
  onPrintQueueChanged: (callback) => {
    if (typeof callback !== 'function') {
      return () => undefined;
    }

    const listener = (_event, queue) => callback(queue);
    ipcRenderer.on('fatboy:print-queue-changed', listener);
    return () => ipcRenderer.removeListener('fatboy:print-queue-changed', listener);
  },
});
