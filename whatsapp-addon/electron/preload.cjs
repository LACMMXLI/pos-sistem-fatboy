const { contextBridge, ipcRenderer } = require('electron');

function readFlag(prefix) {
  const match = process.argv.find((argument) => argument.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

const runtimeConfig = {
  environment: readFlag('--wa-addon-environment=') || 'development',
  backendUrl: '',
};

console.log('[wa-addon] preload-ready', {
  environment: runtimeConfig.environment,
  argvFlags: process.argv.filter((argument) => argument.startsWith('--wa-addon-')),
});

contextBridge.exposeInMainWorld('fatboyWhatsappAddon', {
  getRuntimeConfig: () => runtimeConfig,
  getRuntimeState: () => ipcRenderer.invoke('wa-addon:get-runtime-state'),
  getStorageState: () => ipcRenderer.invoke('wa-addon:get-storage-state'),
  getAppSettings: () => ipcRenderer.invoke('wa-addon:get-app-settings'),
  updateAppSettings: (payload) => ipcRenderer.invoke('wa-addon:update-app-settings', payload),
  reconnectBackend: () => ipcRenderer.invoke('wa-addon:reconnect-backend'),
  listRecipients: () => ipcRenderer.invoke('wa-addon:list-recipients'),
  createRecipient: (payload) => ipcRenderer.invoke('wa-addon:create-recipient', payload),
  listRules: () => ipcRenderer.invoke('wa-addon:list-rules'),
  listDispatchHistory: (limit) => ipcRenderer.invoke('wa-addon:list-dispatch-history', limit),
  listMessageHistory: (limit) => ipcRenderer.invoke('wa-addon:list-message-history', limit),
  listErrorLogs: (limit) => ipcRenderer.invoke('wa-addon:list-error-logs', limit),
  createRule: (payload) => ipcRenderer.invoke('wa-addon:create-rule', payload),
  refreshStorageState: () => ipcRenderer.invoke('wa-addon:refresh-storage-state'),
  processDispatchQueue: () => ipcRenderer.invoke('wa-addon:process-dispatch-queue'),
  initializeWhatsApp: () => ipcRenderer.invoke('wa-addon:initialize-whatsapp'),
  resetWhatsAppSession: () => ipcRenderer.invoke('wa-addon:reset-whatsapp-session'),
  onRuntimeStateChanged: (callback) => {
    if (typeof callback !== 'function') {
      return () => undefined;
    }

    const listener = (_event, state) => callback(state);
    ipcRenderer.on('wa-addon:state-changed', listener);
    return () => ipcRenderer.removeListener('wa-addon:state-changed', listener);
  },
});
