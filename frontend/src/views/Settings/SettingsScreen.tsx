import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, HardDrive, Loader2, Mail, Palette, Printer, RefreshCw, Save, Server, ShieldCheck, SlidersHorizontal, Table2, Trash2, UserPlus, Users, Plus, Pencil, Trash } from 'lucide-react';
import { toast } from 'sonner';
import { DesktopPrintQueueCard } from '../../components/printing/DesktopPrintQueueCard';
import { ServerConnectionPanel } from '../../components/settings/ServerConnectionPanel';
import { useDesktopPrintQueue } from '../../hooks/useDesktopPrintQueue';
import { isDesktopRuntime, openDesktopCashDrawer } from '../../lib/runtime';
import ActionButton from '../../components/ui/ActionButton';
import ModalShell from '../../components/ui/ModalShell';
import Switch from '../../components/ui/Switch';
import {
  clearBusinessData,
  clearEmployeesData,
  createArea,
  createTable,
  createUser,
  deleteArea,
  deleteTable,
  deleteUser,
  getAdminSettings,
  getAreas,
  getInstalledPrinters,
  getRoles,
  getTables,
  getUsers,
  testShiftEmailSettings,
  updateArea,
  updateSettings,
  updateTable,
  updateUser,
} from '../../services/api';
import { useSettingsStore } from '../../store/settingsStore';
import { cn } from '../../lib/utils';
import { getThemePalette, resolveThemePresetFromSettings, themeFamilies, themePalettes, type ThemePresetId } from '../../lib/theme';

type TabId = 'general' | 'appearance' | 'server' | 'users' | 'waiters' | 'database' | 'email' | 'devices' | 'floorplan';
type Role = { id: number; name: string };
type User = { id: number; name: string; email: string; tabletPin?: string | null; isActive: boolean; createdAt: string; role: Role };
type UserForm = { name: string; email: string; password: string; roleId: string; tabletPin: string; isActive: boolean };

const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: 'general', label: 'General', icon: <SlidersHorizontal className="w-3.5 h-3.5" /> },
  { id: 'appearance', label: 'Apariencia', icon: <Palette className="w-3.5 h-3.5" /> },
  { id: 'server', label: 'Servidor', icon: <Server className="w-3.5 h-3.5" /> },
  { id: 'users', label: 'Usuarios', icon: <Users className="w-3.5 h-3.5" /> },
  { id: 'waiters', label: 'Meseros', icon: <Users className="w-3.5 h-3.5" /> },
  { id: 'database', label: 'Base de datos', icon: <Database className="w-3.5 h-3.5" /> },
  { id: 'email', label: 'Correo', icon: <Mail className="w-3.5 h-3.5" /> },
  { id: 'devices', label: 'Impresión / KDS', icon: <Printer className="w-3.5 h-3.5" /> },
  { id: 'floorplan', label: 'Salón y Mesas', icon: <Table2 className="w-3.5 h-3.5" /> },
];

const emptyUserForm: UserForm = { name: '', email: '', password: '', roleId: '', tabletPin: '', isActive: true };
const fieldClass = 'admin-input';

interface SettingsScreenProps {
  initialTab?: TabId;
}

export function SettingsScreen({ initialTab }: SettingsScreenProps) {
  const queryClient = useQueryClient();
  const setSettingsStore = useSettingsStore((state) => state.setSettings);
  const [tab, setTab] = useState<TabId>(initialTab || 'general');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState<UserForm>(emptyUserForm);
  const [adminPassword, setAdminPassword] = useState('');
  const [employeePurgePassword, setEmployeePurgePassword] = useState('');
  const [generalForm, setGeneralForm] = useState({
    restaurantName: '',
    restaurantAddress: '',
    taxEnabled: true,
    taxRate: '16',
    receiptAutoPrint: false,
    receiptPaperWidth: '80' as '58' | '80',
    receiptPrinterName: '',
    kitchenPrinterName: '',
    kitchenPaperWidth: '80' as '58' | '80',
    receiptCutEnabled: true,
    cashDrawerEnabled: false,
    cashDrawerOpenOnCash: false,
    themePreset: 'obsidian' as ThemePresetId,
    shiftEmailEnabled: false,
    shiftEmailHost: '',
    shiftEmailPort: '587',
    shiftEmailSecure: false,
    shiftEmailUser: '',
    shiftEmailPassword: '',
    shiftEmailFrom: '',
    shiftEmailTo: '',
    shiftEmailCc: '',
    whatsappAddonEnabled: false,
  });
  const desktopMode = isDesktopRuntime();
  const { queue: desktopPrintQueue, loading: loadingDesktopPrintQueue } = useDesktopPrintQueue(
    tab === 'devices' && desktopMode,
  );

  const { data: settingsData, isLoading: loadingSettings } = useQuery({
    queryKey: ['settings-data'],
    queryFn: getAdminSettings,
  });
  const { data: installedPrinters = [], isLoading: loadingPrinters } = useQuery<string[]>({
    queryKey: ['installed-printers'],
    queryFn: getInstalledPrinters,
    enabled: tab === 'devices',
  });
  const { data: users = [], isLoading: loadingUsers } = useQuery<User[]>({
    queryKey: ['users-admin'],
    queryFn: () => getUsers(),
  });
  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: getRoles,
  });

  // Areas and Tables management state
  const [selectedAreaIdForTables, setSelectedAreaIdForTables] = useState<number | null>(null);
  const [areaModalOpen, setAreaModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<{ id: number; name: string } | null>(null);
  const [areaName, setAreaName] = useState('');

  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<{ id: number; name: string; areaId: number } | null>(null);
  const [tableName, setTableName] = useState('');

  const { data: areas = [], isLoading: loadingAreas } = useQuery({
    queryKey: ['areas-admin'],
    queryFn: getAreas,
    enabled: tab === 'floorplan',
  });

  const { data: tablesForArea = [], isLoading: loadingTablesForArea } = useQuery({
    queryKey: ['tables-admin', selectedAreaIdForTables],
    queryFn: () => getTables(selectedAreaIdForTables ? String(selectedAreaIdForTables) : undefined),
    enabled: tab === 'floorplan' && !!selectedAreaIdForTables,
  });

  const saveArea = useMutation({
    mutationFn: () => (editingArea ? updateArea(editingArea.id, { name: areaName }) : createArea({ name: areaName })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['areas-admin'] });
      setAreaModalOpen(false);
      setAreaName('');
      setEditingArea(null);
      toast.success(editingArea ? 'Área actualizada' : 'Área creada');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Error al guardar el área');
    },
  });

  const removeArea = useMutation({
    mutationFn: (id: number) => deleteArea(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['areas-admin'] });
      if (selectedAreaIdForTables === editingArea?.id) setSelectedAreaIdForTables(null);
      toast.success('Área eliminada');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'No se puede eliminar el área si tiene mesas');
    },
  });

  const saveTable = useMutation({
    mutationFn: () =>
      editingTable
        ? updateTable(editingTable.id, { name: tableName, areaId: selectedAreaIdForTables! })
        : createTable({ name: tableName, areaId: selectedAreaIdForTables! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables-admin'] });
      setTableModalOpen(false);
      setTableName('');
      setEditingTable(null);
      toast.success(editingTable ? 'Mesa actualizada' : 'Mesa creada');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Error al guardar la mesa');
    },
  });

  const removeTable = useMutation({
    mutationFn: (id: number) => deleteTable(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables-admin'] });
      toast.success('Mesa eliminada');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'No se puede eliminar la mesa si tiene pedidos');
    },
  });

  useEffect(() => {
    if (!settingsData) return;
    setSettingsStore({
      ...settingsData,
      themePreset: resolveThemePresetFromSettings(settingsData),
    });
    setGeneralForm({
      restaurantName: settingsData.restaurantName ?? '',
      restaurantAddress: settingsData.restaurantAddress ?? '',
      taxEnabled: settingsData.taxEnabled ?? true,
      taxRate: String(settingsData.taxRate ?? 16),
      receiptAutoPrint: settingsData.receiptAutoPrint ?? false,
      receiptPaperWidth: settingsData.receiptPaperWidth ?? '80',
      receiptPrinterName: settingsData.receiptPrinterName ?? '',
      kitchenPrinterName: settingsData.kitchenPrinterName ?? '',
      kitchenPaperWidth: settingsData.kitchenPaperWidth ?? '80',
      receiptCutEnabled: settingsData.receiptCutEnabled ?? true,
      cashDrawerEnabled: settingsData.cashDrawerEnabled ?? false,
      cashDrawerOpenOnCash: settingsData.cashDrawerOpenOnCash ?? false,
      themePreset: resolveThemePresetFromSettings(settingsData),
      shiftEmailEnabled: settingsData.shiftEmailEnabled ?? false,
      shiftEmailHost: settingsData.shiftEmailHost ?? '',
      shiftEmailPort: String(settingsData.shiftEmailPort ?? 587),
      shiftEmailSecure: settingsData.shiftEmailSecure ?? false,
      shiftEmailUser: settingsData.shiftEmailUser ?? '',
      shiftEmailPassword: settingsData.shiftEmailPassword ?? '',
      shiftEmailFrom: settingsData.shiftEmailFrom ?? '',
      shiftEmailTo: settingsData.shiftEmailTo ?? '',
      shiftEmailCc: settingsData.shiftEmailCc ?? '',
      whatsappAddonEnabled: settingsData.whatsappAddonEnabled ?? false,
    });
  }, [setSettingsStore, settingsData]);

  useEffect(() => {
    if (!selectedUserId && users.length) setSelectedUserId(users[0].id);
  }, [selectedUserId, users]);

  const selectedUser = users.find((u) => u.id === selectedUserId) ?? null;
  const waiterRole = roles.find((role) => role.name === 'MESERO') ?? null;
  const waiters = users.filter((user) => user.role.name === 'MESERO');
  const selectedWaiter = waiters.find((user) => user.id === selectedUserId) ?? null;
  const isSinglePaneTab = tab === 'devices' || tab === 'email' || tab === 'server';
  const metrics = useMemo(() => ({
    activeUsers: users.filter((u) => u.isActive).length,
    adminUsers: users.filter((u) => u.role.name === 'ADMIN').length,
    activeWaiters: users.filter((u) => u.role.name === 'MESERO' && u.isActive).length,
    enabledDevices: [
      generalForm.receiptPrinterName,
      generalForm.kitchenPrinterName,
      generalForm.cashDrawerEnabled ? 'drawer' : '',
      generalForm.shiftEmailEnabled ? 'mail' : '',
    ].filter(Boolean).length,
  }), [generalForm.cashDrawerEnabled, generalForm.kitchenPrinterName, generalForm.receiptPrinterName, generalForm.shiftEmailEnabled, users]);
  const selectedTheme = getThemePalette(generalForm.themePreset);

  const saveSettings = useMutation({
    mutationFn: () => updateSettings({
      restaurantName: generalForm.restaurantName,
      restaurantAddress: generalForm.restaurantAddress,
      taxEnabled: generalForm.taxEnabled,
      taxRate: Number(generalForm.taxRate),
      receiptAutoPrint: generalForm.receiptAutoPrint,
      receiptPaperWidth: generalForm.receiptPaperWidth,
      receiptPrinterName: generalForm.receiptPrinterName || null,
      kitchenPrinterName: generalForm.kitchenPrinterName || null,
      kitchenPaperWidth: generalForm.kitchenPaperWidth,
      receiptCutEnabled: generalForm.receiptCutEnabled,
      cashDrawerEnabled: generalForm.cashDrawerEnabled,
      cashDrawerOpenOnCash: generalForm.cashDrawerOpenOnCash,
      accentColor: selectedTheme.accentColor,
      panelColor: selectedTheme.panelColor,
      paperColor: selectedTheme.paperColor,
      inkColor: selectedTheme.inkColor,
      shiftEmailEnabled: generalForm.shiftEmailEnabled,
      shiftEmailHost: generalForm.shiftEmailHost.trim() || null,
      shiftEmailPort: Number(generalForm.shiftEmailPort || 587),
      shiftEmailSecure: generalForm.shiftEmailSecure,
      shiftEmailUser: generalForm.shiftEmailUser.trim() || null,
      shiftEmailPassword: generalForm.shiftEmailPassword.trim() || null,
      shiftEmailFrom: generalForm.shiftEmailFrom.trim() || null,
      shiftEmailTo: generalForm.shiftEmailTo.trim() || null,
      shiftEmailCc: generalForm.shiftEmailCc.trim() || null,
      whatsappAddonEnabled: generalForm.whatsappAddonEnabled,
    }),
    onSuccess: (data) => {
      toast.success('Configuración actualizada');
      setSettingsStore({
        ...data,
        themePreset: generalForm.themePreset,
      });
      queryClient.invalidateQueries({ queryKey: ['settings-data'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'No se pudo guardar'),
  });

  const testEmailSettings = useMutation({
    mutationFn: () =>
      testShiftEmailSettings({
        shiftEmailHost: generalForm.shiftEmailHost.trim() || undefined,
        shiftEmailPort: Number(generalForm.shiftEmailPort || 587),
        shiftEmailSecure: generalForm.shiftEmailSecure,
        shiftEmailUser: generalForm.shiftEmailUser.trim() || undefined,
        shiftEmailPassword: generalForm.shiftEmailPassword.trim() || undefined,
        shiftEmailFrom: generalForm.shiftEmailFrom.trim() || undefined,
        shiftEmailTo: generalForm.shiftEmailTo.trim() || undefined,
        shiftEmailCc: generalForm.shiftEmailCc.trim() || undefined,
      }),
    onSuccess: (result: any) => {
      if (result?.sent) {
        toast.success(result?.message || 'Correo de prueba enviado correctamente');
        return;
      }

      toast.error(result?.message || 'No se pudo enviar el correo de prueba');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || e?.message || 'No se pudo enviar el correo de prueba'),
  });

  const saveUser = useMutation({
    mutationFn: () => {
      const payload: any = {
        name: userForm.name,
        email: userForm.email,
        roleId: Number(userForm.roleId),
      };
      const isStaffRole = ['ADMIN', 'SUPERVISOR', 'CAJERO', 'COCINA', 'MESERO'].includes(selectedRole?.name || '');
      if (isStaffRole) {
        payload.tabletPin = userForm.tabletPin || null;
      }
      if (editingUser) payload.isActive = userForm.isActive;
      else payload.password = userForm.password;
      return editingUser ? updateUser(editingUser.id, payload) : createUser(payload);
    },
    onSuccess: () => {
      toast.success(editingUser ? 'Usuario actualizado' : 'Usuario creado');
      setUserModalOpen(false);
      setEditingUser(null);
      setUserForm(emptyUserForm);
      queryClient.invalidateQueries({ queryKey: ['users-admin'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'No se pudo guardar el usuario'),
  });

  const removeUser = useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onSuccess: () => {
      toast.success('Usuario eliminado');
      setSelectedUserId(null);
      queryClient.invalidateQueries({ queryKey: ['users-admin'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'No se pudo eliminar'),
  });

  const purgeDb = useMutation({
    mutationFn: () => clearBusinessData(adminPassword),
    onSuccess: () => {
      toast.success('Purga ejecutada');
      setAdminPassword('');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'No se pudo purgar'),
  });

  const purgeEmployees = useMutation({
    mutationFn: () => clearEmployeesData(employeePurgePassword),
    onSuccess: () => {
      toast.success('Historial de empleados eliminado');
      setEmployeePurgePassword('');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'No se pudo limpiar empleados'),
  });

  const testCashDrawer = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('token');

      if (!desktopMode) {
        throw new Error('La prueba de cajón solo está disponible en la app de escritorio.');
      }

      if (!token) {
        throw new Error('No hay sesión activa para abrir el cajón.');
      }

      return openDesktopCashDrawer({
        token,
        printerName: generalForm.receiptPrinterName || undefined,
      });
    },
    onSuccess: () => toast.success('Pulso de apertura enviado al cajón'),
    onError: (e: any) => toast.error(e?.message || 'No se pudo abrir el cajón'),
  });

  const openCreateUser = () => {
    setEditingUser(null);
    setUserForm({ ...emptyUserForm, roleId: roles[0] ? String(roles[0].id) : '' });
    setUserModalOpen(true);
  };

  const openCreateWaiter = () => {
    if (!waiterRole) {
      toast.error('No existe el rol MESERO configurado');
      return;
    }

    setEditingUser(null);
    setUserForm({ ...emptyUserForm, roleId: String(waiterRole.id) });
    setUserModalOpen(true);
  };

  const openEditUser = (user: User) => {
    setEditingUser(user);
    setUserForm({
      name: user.name,
      email: user.email,
      password: '',
      roleId: String(user.role.id),
      tabletPin: user.tabletPin ?? '',
      isActive: user.isActive,
    });
    setUserModalOpen(true);
  };

  const selectedRole = roles.find((role) => String(role.id) === userForm.roleId) ?? null;
  const isStaffRole = ['ADMIN', 'SUPERVISOR', 'CAJERO', 'COCINA', 'MESERO'].includes(selectedRole?.name || '');

  const handleThemeSelect = (themeId: ThemePresetId) => {
    const theme = getThemePalette(themeId);
    setGeneralForm((current) => ({ ...current, themePreset: theme.id }));
    setSettingsStore({
      themePreset: theme.id,
      accentColor: theme.accentColor,
      panelColor: theme.panelColor,
      paperColor: theme.paperColor,
      inkColor: theme.inkColor,
      taxEnabled: generalForm.taxEnabled,
      taxRate: Number(generalForm.taxRate),
      restaurantName: generalForm.restaurantName,
      restaurantAddress: generalForm.restaurantAddress,
      receiptAutoPrint: generalForm.receiptAutoPrint,
      receiptPaperWidth: generalForm.receiptPaperWidth,
      receiptPrinterName: generalForm.receiptPrinterName,
      kitchenPrinterName: generalForm.kitchenPrinterName,
      kitchenPaperWidth: generalForm.kitchenPaperWidth,
      receiptCutEnabled: generalForm.receiptCutEnabled,
      cashDrawerEnabled: generalForm.cashDrawerEnabled,
      cashDrawerOpenOnCash: generalForm.cashDrawerOpenOnCash,
      shiftEmailEnabled: generalForm.shiftEmailEnabled,
      shiftEmailHost: generalForm.shiftEmailHost,
      shiftEmailPort: Number(generalForm.shiftEmailPort || 587),
      shiftEmailSecure: generalForm.shiftEmailSecure,
      shiftEmailUser: generalForm.shiftEmailUser,
      shiftEmailPassword: generalForm.shiftEmailPassword,
      shiftEmailFrom: generalForm.shiftEmailFrom,
      shiftEmailTo: generalForm.shiftEmailTo,
      shiftEmailCc: generalForm.shiftEmailCc,
      whatsappAddonEnabled: generalForm.whatsappAddonEnabled,
    });
  };

  return (
    <div className="admin-shell h-full flex flex-col overflow-hidden p-4 gap-4">
      <div className="flex flex-wrap gap-2 border border-white/8 bg-black/16 backdrop-blur-md shadow-sm p-2 rounded-[1.25rem] shrink-0 ring-1 ring-white/5">
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] transition-all duration-300',
              tab === item.id
                ? 'bg-primary/12 text-primary border border-primary/20 shadow-[0_12px_28px_rgba(255,215,0,0.08)]'
                : 'text-outline hover:bg-white/[0.05] hover:text-on-surface border border-transparent',
            )}
          >
            <span className={cn('transition-all duration-300', tab === item.id ? 'text-primary' : 'text-outline/60')}>{item.icon}</span>
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 flex min-w-0 min-h-0 overflow-hidden rounded-[1.5rem] border border-white/8 bg-black/14 backdrop-blur-lg shadow-2xl relative before:absolute before:inset-0 before:ring-1 before:ring-white/5 before:pointer-events-none">
        <div className={cn('flex flex-1 min-h-0 min-w-0 overflow-hidden relative z-10', isSinglePaneTab ? '' : 'flex flex-row divide-x divide-outline-variant/10')}>
          <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden bg-surface-container-lowest/50">
            {tab === 'general' && (
              <div className="flex h-full flex-col">
                <Header>
                  <ActionButton variant="primary" size="sm" onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending || loadingSettings}>
                    {saveSettings.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Guardar
                  </ActionButton>
                </Header>
                <div className="grid flex-1 grid-cols-[minmax(0,1.8fr)_220px] gap-1.5 p-1.5 overflow-y-auto">
                  <div className="space-y-1.5">
                    <Field label="Nombre del negocio"><input value={generalForm.restaurantName} onChange={(e) => setGeneralForm((c) => ({ ...c, restaurantName: e.target.value }))} className={fieldClass} /></Field>
                    <Field label="Dirección"><textarea rows={2} value={generalForm.restaurantAddress} onChange={(e) => setGeneralForm((c) => ({ ...c, restaurantAddress: e.target.value }))} className={`${fieldClass} resize-none h-10`} /></Field>
                    <Field label="Tasa de impuesto (%)"><input type="number" min="0" step="0.01" value={generalForm.taxRate} onChange={(e) => setGeneralForm((c) => ({ ...c, taxRate: e.target.value }))} className={fieldClass} /></Field>
                  </div>
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-2 gap-1.5">
                      <Metric label="Usuarios" value={String(metrics.activeUsers).padStart(2, '0')} />
                      <Metric label="Admins" value={String(metrics.adminUsers).padStart(2, '0')} />
                    </div>
                    <div className="border border-white/5 bg-surface-container-highest/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-[3px] backdrop-blur-md p-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-on-surface">IVA habilitado</p>
                          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-outline">Impuesto global</p>
                        </div>
                        <Switch checked={generalForm.taxEnabled} onChange={(checked) => setGeneralForm((c) => ({ ...c, taxEnabled: checked }))} ariaLabel="IVA habilitado" />
                      </div>
                    </div>
                    <div className="border border-white/5 bg-surface-container-highest/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-[3px] backdrop-blur-md p-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-on-surface">Notificaciones WA</p>
                          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-outline">Activa el addon externo</p>
                        </div>
                        <Switch checked={generalForm.whatsappAddonEnabled} onChange={(checked) => setGeneralForm((c) => ({ ...c, whatsappAddonEnabled: checked }))} ariaLabel="Notificaciones WA" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'appearance' && (
              <div className="flex h-full flex-col">
                <Header>
                  <ActionButton variant="primary" size="sm" onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending || loadingSettings}>
                    {saveSettings.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Guardar
                  </ActionButton>
                </Header>
                <div className="grid flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_320px] gap-3 p-3 overflow-hidden">
                  <div className="min-h-0 overflow-hidden flex flex-col space-y-3">
                    <div className="border border-white/5 bg-surface-container-highest/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-[3px] backdrop-blur-md p-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">Tema del Sistema</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-outline">El sistema ahora utiliza una identidad visual única y premium.</p>
                    </div>

                    <div className="flex-1 border border-primary/20 bg-surface-container-low shadow-2xl rounded-[4px] p-6 flex flex-col items-center justify-center text-center space-y-4">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#1c1b1b] to-[#393939] border-2 border-primary flex items-center justify-center shadow-[0_0_30px_rgba(255,215,0,0.2)]">
                        <Palette className="w-10 h-10 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-headline font-black uppercase tracking-tighter text-on-surface">
                          Grafito <span className="text-primary italic">Elegante</span>
                        </h2>
                        <p className="mt-2 text-[12px] font-bold uppercase tracking-[0.2em] text-outline">Acento Dorado Premium</p>
                      </div>
                      <div className="flex gap-2">
                        <div className="w-8 h-8 border border-white/10" style={{ backgroundColor: '#131313' }} />
                        <div className="w-8 h-8 border border-white/10" style={{ backgroundColor: '#1c1b1b' }} />
                        <div className="w-8 h-8 border border-white/10" style={{ backgroundColor: '#FFD700' }} />
                        <div className="w-8 h-8 border border-white/10" style={{ backgroundColor: '#e5e2e1' }} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="border border-white/5 bg-surface-container-highest/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-[3px] backdrop-blur-md p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-on-surface">Estado Visual</p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        <p className="text-[13px] font-headline font-black uppercase text-primary">Oscuro Activo</p>
                      </div>
                      <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-outline leading-relaxed">
                        Optimizado para fatiga visual mínima y máximo contraste en entornos profesionales.
                      </p>
                    </div>

                    <div className="border border-white/5 bg-surface-container-highest/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-[3px] backdrop-blur-md p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-on-surface">Vista previa de interfaz</p>
                      <div className="mt-3 space-y-2 border border-outline-variant/10 p-3 shadow-inner" style={{ backgroundColor: selectedTheme.paperColor }}>
                        <div className="border px-3 py-3 shadow-lg" style={{ backgroundColor: selectedTheme.panelColor, borderColor: `${selectedTheme.accentColor}44` }}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: selectedTheme.inkColor }}>
                              Panel Principal
                            </span>
                            <span
                              className="px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] shadow-sm"
                              style={{ backgroundColor: selectedTheme.accentColor, color: '#000000' }}
                            >
                              Botón
                            </span>
                          </div>
                          <div className="mt-3 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-primary w-2/3" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="border p-2" style={{ backgroundColor: selectedTheme.panelColor, borderColor: `${selectedTheme.accentColor}11` }}>
                            <div className="h-1 w-8 bg-primary/30 mb-1" />
                            <div className="h-2 w-full bg-white/5" />
                          </div>
                          <div className="border p-2" style={{ backgroundColor: selectedTheme.panelColor, borderColor: `${selectedTheme.accentColor}11` }}>
                            <div className="h-1 w-8 bg-primary/30 mb-1" />
                            <div className="h-2 w-full bg-white/5" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'users' && (
              <div className="flex h-full flex-col">
                <Header>
                  <div className="flex gap-2">
                    <ActionButton variant="secondary" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['users-admin'] })}>
                      <RefreshCw className="w-3 h-3" />
                      Sincronizar
                    </ActionButton>
                    <ActionButton variant="primary" size="sm" onClick={openCreateUser}>
                      <UserPlus className="w-3 h-3" />
                      Nuevo usuario
                    </ActionButton>
                  </div>
                </Header>
                <div className="min-h-0 flex-1 overflow-auto custom-scrollbar">
                  {loadingUsers ? (
                    <div className="flex h-full items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                  ) : (
                    <table className="w-full table-auto border-collapse text-left">
                      <colgroup>
                        <col />
                        <col />
                        <col style={{ width: '1%' }} />
                        <col style={{ width: '1%' }} />
                        <col style={{ width: '1%' }} />
                        <col style={{ width: '1%' }} />
                      </colgroup>
                      <thead className="sticky top-0 bg-surface-container-lowest">
                        <tr>
                          {['Nombre', 'Correo', 'Rol', 'Estado', 'Alta', 'Editar'].map((label) => (
                            <th key={label} className="px-2 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-outline">{label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/5">
                        {users.map((user) => (
                          <tr key={user.id} onClick={() => setSelectedUserId(user.id)} className={cn('cursor-pointer transition-all duration-300 hover:bg-surface-container-high/50 hover:shadow-sm', selectedUserId === user.id && 'bg-surface-container-high/80 border-l-[3px] border-primary shadow-[inset_0_0_12px_rgba(0,0,0,0.05)] text-shadow')}>

                            <td className="px-2 py-1.5 text-[10px] font-black uppercase text-on-surface">{user.name}</td>
                            <td className="px-2 py-1.5 text-[10px] font-bold text-outline">{user.email}</td>
                            <td className="whitespace-nowrap px-2 py-1.5"><span className="border border-primary/20 bg-primary/10 px-1.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-primary">{user.role.name}</span></td>
                            <td className="whitespace-nowrap px-2 py-1.5 text-[9px] font-bold uppercase text-on-surface">{user.isActive ? 'Activo' : 'Inactivo'}</td>
                            <td className="whitespace-nowrap px-2 py-1.5 text-[9px] font-bold uppercase text-outline">{new Date(user.createdAt).toLocaleDateString('es-MX')}</td>
                            <td className="whitespace-nowrap px-2 py-1.5 text-right"><button onClick={(e) => { e.stopPropagation(); openEditUser(user); }} className="border border-white/10 bg-surface-container-highest/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-[3px] backdrop-blur-md/40 shadow-sm backdrop-blur-md rounded-[2px]est px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-on-surface hover:text-primary">Editar</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {tab === 'waiters' && (
              <div className="flex h-full flex-col">
                <Header>
                  <div className="flex gap-2">
                    <ActionButton variant="secondary" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['users-admin'] })}>
                      <RefreshCw className="w-3 h-3" />
                      Sincronizar
                    </ActionButton>
                    <ActionButton variant="primary" size="sm" onClick={openCreateWaiter}>
                      <UserPlus className="w-3 h-3" />
                      Nuevo mesero
                    </ActionButton>
                  </div>
                </Header>
                <div className="min-h-0 flex-1 overflow-auto custom-scrollbar">
                  {loadingUsers ? (
                    <div className="flex h-full items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                  ) : (
                    <table className="w-full table-auto border-collapse text-left">
                      <colgroup>
                        <col />
                        <col />
                        <col style={{ width: '1%' }} />
                        <col style={{ width: '1%' }} />
                        <col style={{ width: '1%' }} />
                      </colgroup>
                      <thead className="sticky top-0 bg-surface-container-lowest">
                        <tr>
                          {['Nombre', 'Correo', 'Estado', 'Alta', 'Editar'].map((label) => (
                            <th key={label} className="px-2 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-outline">{label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/5">
                        {waiters.map((user) => (
                          <tr key={user.id} onClick={() => setSelectedUserId(user.id)} className={cn('cursor-pointer transition-all duration-300 hover:bg-surface-container-high/50 hover:shadow-sm', selectedUserId === user.id && 'bg-surface-container-high/80 border-l-[3px] border-primary shadow-[inset_0_0_12px_rgba(0,0,0,0.05)] text-shadow')}>

                            <td className="px-2 py-1.5 text-[10px] font-black uppercase text-on-surface">{user.name}</td>
                            <td className="px-2 py-1.5 text-[10px] font-bold text-outline">{user.email}</td>
                            <td className="whitespace-nowrap px-2 py-1.5 text-[9px] font-bold uppercase text-on-surface">{user.isActive ? 'Activo' : 'Inactivo'}</td>
                            <td className="whitespace-nowrap px-2 py-1.5 text-[9px] font-bold uppercase text-outline">{new Date(user.createdAt).toLocaleDateString('es-MX')}</td>
                            <td className="whitespace-nowrap px-2 py-1.5 text-right"><button onClick={(e) => { e.stopPropagation(); openEditUser(user); }} className="border border-white/10 bg-surface-container-highest/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-[3px] backdrop-blur-md/40 shadow-sm backdrop-blur-md rounded-[2px]est px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-on-surface hover:text-primary">Editar</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {tab === 'database' && (
              <div className="flex h-full flex-col">
                <div className="grid grid-cols-2 gap-1.5 p-1.5">
                  <Metric label="Motor" value="POSTGRES" />
                  <Metric label="Estado" value="ONLINE" />
                  <div className="col-span-2 flex items-center justify-between border border-red-500/20 bg-red-500/5 p-2 gap-2 backdrop-blur-sm shadow-[inset_0_1px_1px_rgba(255,0,0,0.1)] rounded-[4px]">
                    <div className="flex items-center gap-2">
                      <Trash2 className="w-4 h-4 text-red-400 shrink-0" />
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-300">Purga total de registros</p>
                        <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-outline">Acción irreversible sobre historial.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 w-[280px]">
                      <input type="password" placeholder="Contraseña admin" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className={fieldClass} />
                      <ActionButton variant="danger" size="md" onClick={() => purgeDb.mutate()} disabled={purgeDb.isPending || !adminPassword}>
                        {purgeDb.isPending ? <Loader2 className="w-3 h-3 animate-spin shrink-0" /> : <Trash2 className="w-3 h-3 shrink-0" />}
                        Purga
                      </ActionButton>
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center justify-between border border-amber-500/20 bg-amber-500/5 p-2 gap-2 backdrop-blur-sm shadow-[inset_0_1px_1px_rgba(255,191,0,0.1)] rounded-[4px]">
                    <div className="flex items-center gap-2">
                      <Trash2 className="w-4 h-4 text-amber-300 shrink-0" />
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-200">Purga de empleados</p>
                        <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-outline">Elimina dependientes e historiales.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 w-[280px]">
                      <input type="password" placeholder="Contraseña admin" value={employeePurgePassword} onChange={(e) => setEmployeePurgePassword(e.target.value)} className={fieldClass} />
                      <ActionButton variant="danger" size="md" onClick={() => purgeEmployees.mutate()} disabled={purgeEmployees.isPending || !employeePurgePassword}>
                        {purgeEmployees.isPending ? <Loader2 className="w-3 h-3 animate-spin shrink-0" /> : <Trash2 className="w-3 h-3 shrink-0" />}
                        Limpiar
                      </ActionButton>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'email' && (
              <div className="flex h-full flex-col">
                <Header>
                  <div className="flex gap-2">
                    <ActionButton
                      variant="secondary"
                      size="sm"
                      onClick={() => testEmailSettings.mutate()}
                      disabled={testEmailSettings.isPending}
                    >
                      {testEmailSettings.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      Probar correo
                    </ActionButton>
                    <ActionButton variant="primary" size="sm" onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
                      {saveSettings.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      Guardar
                    </ActionButton>
                  </div>
                </Header>
                <div className="grid flex-1 grid-cols-[minmax(0,1.8fr)_220px] gap-1.5 p-1.5">
                  <div className="space-y-1.5 border border-white/5 bg-surface-container-highest/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-[3px] backdrop-blur-md p-1.5">
                    <div className="flex items-center justify-between gap-3 bg-surface-container-lowest p-1.5 border border-outline-variant/10">
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-primary" />
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-on-surface">Correo de cortes</p>
                          <p className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.1em] text-outline">Envía PDF automático en cierres</p>
                        </div>
                      </div>
                      <Switch checked={generalForm.shiftEmailEnabled} onChange={(checked) => setGeneralForm((curr) => ({ ...curr, shiftEmailEnabled: checked }))} ariaLabel="Correo de cierre habilitado" />
                    </div>
                    <div className="grid grid-cols-[minmax(0,1fr)_80px] gap-1.5">
                      <Field label="SMTP host"><input value={generalForm.shiftEmailHost} onChange={(e) => setGeneralForm((curr) => ({ ...curr, shiftEmailHost: e.target.value }))} className={fieldClass} placeholder="smtp.tudominio.com" /></Field>
                      <Field label="Puerto"><input type="number" value={generalForm.shiftEmailPort} onChange={(e) => setGeneralForm((curr) => ({ ...curr, shiftEmailPort: e.target.value }))} className={fieldClass} placeholder="587" /></Field>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Field label="Usuario SMTP"><input value={generalForm.shiftEmailUser} onChange={(e) => setGeneralForm((curr) => ({ ...curr, shiftEmailUser: e.target.value }))} className={fieldClass} placeholder="usuario@dominio.com" /></Field>
                      <Field label="Password SMTP"><input type="password" value={generalForm.shiftEmailPassword} onChange={(e) => setGeneralForm((curr) => ({ ...curr, shiftEmailPassword: e.target.value }))} className={fieldClass} placeholder="********" /></Field>
                      <Field label="Remitente"><input value={generalForm.shiftEmailFrom} onChange={(e) => setGeneralForm((curr) => ({ ...curr, shiftEmailFrom: e.target.value }))} className={fieldClass} placeholder="cortes@negocio.com" /></Field>
                      <Field label="Destinatario"><input value={generalForm.shiftEmailTo} onChange={(e) => setGeneralForm((curr) => ({ ...curr, shiftEmailTo: e.target.value }))} className={fieldClass} placeholder="gerencia@negocio.com" /></Field>
                    </div>
                    <Field label="Copias (CC)"><textarea rows={1} value={generalForm.shiftEmailCc} onChange={(e) => setGeneralForm((curr) => ({ ...curr, shiftEmailCc: e.target.value }))} className={`${fieldClass} resize-none`} placeholder="dueno@negocio.com" /></Field>
                    <div className="border border-white/5 bg-surface-container-highest/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-[3px] backdrop-blur-md p-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-on-surface">Conexión segura</p>
                          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-outline">SSL directo para 465</p>
                        </div>
                        <button onClick={() => setGeneralForm((curr) => ({ ...curr, shiftEmailSecure: !curr.shiftEmailSecure }))} className={cn('relative h-7 w-14 border transition-colors', generalForm.shiftEmailSecure ? 'border-primary bg-primary' : 'border-outline-variant/20 bg-surface-container-low')}>
                          <span className={cn('absolute top-0 h-full w-7 bg-white transition-transform', generalForm.shiftEmailSecure ? 'translate-x-[14px]' : 'translate-x-0')} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="border border-white/5 bg-surface-container-highest/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-[3px] backdrop-blur-md p-2 space-y-2">
                      <Metric label="Correo automático" value={generalForm.shiftEmailEnabled ? 'ACTIVO' : 'APAGADO'} />
                      <Metric label="Servidor SMTP" value={generalForm.shiftEmailHost ? 'CONFIGURADO' : 'PENDIENTE'} />
                      <Metric label="Destinatario" value={generalForm.shiftEmailTo ? 'OK' : 'PENDIENTE'} />
                      <Metric label="Seguridad" value={generalForm.shiftEmailSecure ? 'SSL' : 'STARTTLS'} />
                    </div>
                    <div className="border border-white/5 bg-surface-container-highest/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-[3px] backdrop-blur-md p-2">
                      <div className="flex items-start gap-3">
                        <div className="border border-primary/20 bg-primary/10 p-1.5 text-primary">
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-on-surface">Uso recomendado</p>
                          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-outline">
                            Mantén aquí solo el envío automático de cortes. La impresión y KDS viven en su propia pestaña.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="border border-white/5 bg-surface-container-highest/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-[3px] backdrop-blur-md p-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-on-surface">Diagnóstico rápido</p>
                      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-outline">
                        Usa "Probar correo" para validar SMTP y envío antes de cerrar turno. Si dejas la contraseña vacía, se conserva la guardada.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'floorplan' && (
              <div className="flex h-full flex-col">
                <Header>
                  <div className="flex gap-2">
                    <ActionButton
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setEditingArea(null);
                        setAreaName('');
                        setAreaModalOpen(true);
                      }}
                    >
                      <Plus className="w-3 h-3" />
                      Nueva Área
                    </ActionButton>
                  </div>
                </Header>
                <div className="flex-1 grid grid-cols-[1fr_1.2fr] divide-x divide-outline-variant/10 overflow-hidden">
                  {/* Areas List */}
                  <div className="flex flex-col min-h-0">
                    <div className="px-3 py-2 border-b border-outline-variant/10 bg-surface-container-high/30">
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-outline">Áreas / Salones</p>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 space-y-1">
                      {loadingAreas ? (
                        <div className="flex h-20 items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
                      ) : areas.length === 0 ? (
                        <Empty message="No hay áreas configuradas." />
                      ) : (
                        areas.map((area: any) => (
                          <div
                            key={area.id}
                            onClick={() => setSelectedAreaIdForTables(area.id)}
                            className={cn(
                              'group flex items-center justify-between gap-2 px-3 py-2 rounded-[2px] cursor-pointer transition-all',
                              selectedAreaIdForTables === area.id
                                ? 'bg-primary/10 border-l-[3px] border-primary'
                                : 'hover:bg-surface-container-high/50'
                            )}
                          >
                            <span className={cn('text-[10px] font-black uppercase', selectedAreaIdForTables === area.id ? 'text-primary' : 'text-on-surface')}>
                              {area.name}
                            </span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingArea(area);
                                  setAreaName(area.name);
                                  setAreaModalOpen(true);
                                }}
                                className="p-1 text-outline hover:text-primary transition-colors"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm('¿Eliminar esta área? Se eliminarán también sus mesas.')) removeArea.mutate(area.id);
                                }}
                                className="p-1 text-outline hover:text-red-400 transition-colors"
                              >
                                <Trash className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Tables List */}
                  <div className="flex flex-col min-h-0">
                    <div className="px-3 py-2 border-b border-outline-variant/10 bg-surface-container-high/30 flex items-center justify-between">
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-outline">Mesas del Área</p>
                      {selectedAreaIdForTables && (
                        <button
                          onClick={() => {
                            setEditingTable(null);
                            setTableName('');
                            setTableModalOpen(true);
                          }}
                          className="flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.12em] text-primary hover:text-primary/80 transition-colors"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          Agregar Mesa
                        </button>
                      )}
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5">
                      {!selectedAreaIdForTables ? (
                        <div className="h-full flex items-center justify-center">
                          <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-outline italic">Selecciona un área para gestionar sus mesas</p>
                        </div>
                      ) : loadingTablesForArea ? (
                        <div className="flex h-20 items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
                      ) : tablesForArea.length === 0 ? (
                        <Empty message="No hay mesas en esta área." />
                      ) : (
                        <div className="grid grid-cols-2 gap-1.5">
                          {tablesForArea.map((table: any) => (
                            <div
                              key={table.id}
                              className="group flex flex-col justify-between border border-outline-variant/10 bg-surface-container-low p-2 rounded-[2px] hover:border-primary/30 transition-all"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-black uppercase text-on-surface">{table.name}</span>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => {
                                      setEditingTable(table);
                                      setTableName(table.name);
                                      setTableModalOpen(true);
                                    }}
                                    className="p-1 text-outline hover:text-primary transition-colors"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm('¿Eliminar esta mesa?')) removeTable.mutate(table.id);
                                    }}
                                    className="p-1 text-outline hover:text-red-400 transition-colors"
                                  >
                                    <Trash className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                              <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-outline">ID: {table.id}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {tab === 'devices' && (
              <div className="flex h-full flex-col">
                <Header>
                  <div className="flex gap-2">
                    <ActionButton variant="secondary" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['installed-printers'] })}>
                      <RefreshCw className="w-3 h-3" />
                      Detectar impresoras
                    </ActionButton>
                    <ActionButton variant="primary" size="sm" onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
                      {saveSettings.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      Guardar
                    </ActionButton>
                  </div>
                </Header>
                <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)] gap-1.5 overflow-y-auto p-1.5 custom-scrollbar content-start">
                  <div className="space-y-1.5">
                    <div className="border border-white/5 bg-surface-container-highest/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-[3px] backdrop-blur-md p-1.5">
                      <div className="flex items-center gap-2.5">
                        <div className="border border-primary/20 bg-primary/10 p-1.5 text-primary">
                          <Printer className="w-3 h-3" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-on-surface">Puente central de impresión</p>
                          <p className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-outline">Electron recibe, enruta y serializa tickets RAW en Windows</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="border border-white/5 bg-surface-container-highest/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-[3px] backdrop-blur-md p-1.5 space-y-1">
                        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-on-surface">Caja / Frontend</p>
                        <Field label="Impresora tickets">
                          <select
                            value={generalForm.receiptPrinterName}
                            onChange={(e) => setGeneralForm((curr) => ({ ...curr, receiptPrinterName: e.target.value }))}
                            className={fieldClass}
                          >
                            <option value="">Selecciona una impresora</option>
                            {installedPrinters.map((printerName) => (
                              <option key={printerName} value={printerName}>
                                {printerName}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Papel">
                          <select
                            value={generalForm.receiptPaperWidth}
                            onChange={(e) => setGeneralForm((curr) => ({ ...curr, receiptPaperWidth: e.target.value as '58' | '80' }))}
                            className={fieldClass}
                          >
                            <option value="80">80 mm</option>
                            <option value="58">58 mm</option>
                          </select>
                        </Field>
                      </div>
                      <div className="border border-white/5 bg-surface-container-highest/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-[3px] backdrop-blur-md p-1.5 space-y-1">
                        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-on-surface">Producción / HM / tablets</p>
                        <Field label="Impresora comandas">
                          <select
                            value={generalForm.kitchenPrinterName}
                            onChange={(e) => setGeneralForm((curr) => ({ ...curr, kitchenPrinterName: e.target.value }))}
                            className={fieldClass}
                          >
                            <option value="">Usar fallback de tickets</option>
                            {installedPrinters.map((printerName) => (
                              <option key={printerName} value={printerName}>
                                {printerName}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Papel">
                          <select
                            value={generalForm.kitchenPaperWidth}
                            onChange={(e) => setGeneralForm((curr) => ({ ...curr, kitchenPaperWidth: e.target.value as '58' | '80' }))}
                            className={fieldClass}
                          >
                            <option value="80">80 mm</option>
                            <option value="58">58 mm</option>
                          </select>
                        </Field>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="border border-white/5 bg-surface-container-highest/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-[3px] backdrop-blur-md p-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-on-surface">Imprimir al cobrar</p>
                            <p className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-outline">Take away imprime automático</p>
                          </div>
                          <Switch checked={generalForm.receiptAutoPrint} onChange={(checked) => setGeneralForm((curr) => ({ ...curr, receiptAutoPrint: checked }))} ariaLabel="Auto print" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="border border-white/5 bg-surface-container-highest/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-[3px] backdrop-blur-md p-1.5">
                          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-outline">Detección</p>
                          <p className="mt-0.5 text-[10px] font-black uppercase text-on-surface">
                            {loadingPrinters ? 'Buscando...' : `${installedPrinters.length} impresoras`}
                          </p>
                        </div>
                        <div className="border border-white/5 bg-surface-container-highest/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-[3px] backdrop-blur-md p-1.5">
                          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-outline">Ruteo</p>
                          <p className="mt-0.5 text-[10px] font-black uppercase text-on-surface">
                            {generalForm.kitchenPrinterName ? 'SEPARADO' : 'FALLBACK'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="border border-white/5 bg-surface-container-highest/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-[3px] backdrop-blur-md p-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-on-surface">Corte automático</p>
                          <p className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-outline">Corta tickets y cortes</p>
                        </div>
                        <Switch checked={generalForm.receiptCutEnabled} onChange={(checked) => setGeneralForm((curr) => ({ ...curr, receiptCutEnabled: checked }))} ariaLabel="Corte automático" />
                      </div>
                    </div>
                    <div className="border border-white/5 bg-surface-container-highest/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-[3px] backdrop-blur-md p-1.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-on-surface">Cajón de dinero</p>
                          <p className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-outline">Pulso ESC/POS de apertura</p>
                        </div>
                        <Switch checked={generalForm.cashDrawerEnabled} onChange={(checked) => setGeneralForm((curr) => ({ ...curr, cashDrawerEnabled: checked }))} ariaLabel="Cajón habilitado" />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-on-surface">Abrir al cobrar en efectivo</p>
                          <p className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-outline">Solo en pagos en efectivo</p>
                        </div>
                        <button
                          onClick={() => setGeneralForm((curr) => ({ ...curr, cashDrawerOpenOnCash: !curr.cashDrawerOpenOnCash }))}
                          disabled={!generalForm.cashDrawerEnabled}
                          className={cn(
                            'relative h-6 w-12 shrink-0 border transition-colors',
                            generalForm.cashDrawerOpenOnCash ? 'border-primary bg-primary' : 'border-outline-variant/20 bg-surface-container-low',
                            !generalForm.cashDrawerEnabled && 'opacity-50',
                          )}
                        >
                          <span className={cn('absolute top-[1px] left-[1px] h-3 w-3 rounded-full bg-white transition-transform shadow-md', generalForm.cashDrawerOpenOnCash ? 'translate-x-[14px]' : 'translate-x-0')} />
                        </button>
                      </div>
                      {desktopMode ? (
                        <ActionButton
                          variant="secondary"
                          size="sm"
                          onClick={() => testCashDrawer.mutate()}
                          disabled={testCashDrawer.isPending || !generalForm.cashDrawerEnabled || !generalForm.receiptPrinterName}
                        >
                          {testCashDrawer.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Printer className="w-3 h-3" />}
                          Probar apertura de cajón
                        </ActionButton>
                      ) : null}
                    </div>
                    <div className="border border-white/5 bg-surface-container-highest/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-[3px] backdrop-blur-md p-1.5 space-y-1.5">
                      <div className="flex items-start gap-2">
                        <div className="border border-primary/20 bg-primary/10 p-1.5 text-primary">
                          <HardDrive className="w-3 h-3" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-on-surface">Estado operativo</p>
                          <p className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-outline">
                            {desktopMode
                              ? 'Electron centraliza tickets frontend y comandas de tablets/HM'
                              : 'La cola visible aparece en la computadora principal'}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <Metric label="Caja / frontend" value={generalForm.receiptPrinterName ? 'OK' : 'PENDIENTE'} />
                        <Metric label="Producción / HM" value={generalForm.kitchenPrinterName ? 'OK' : 'FALLBACK'} />
                        <Metric label="Auto print" value={generalForm.receiptAutoPrint ? 'ACTIVO' : 'MANUAL'} />
                        <Metric label="Corte ticket" value={generalForm.receiptCutEnabled ? 'ACTIVO' : 'APAGADO'} />
                        <Metric label="Cajón" value={generalForm.cashDrawerEnabled ? 'ACTIVO' : 'APAGADO'} />
                        <Metric label="Papel caja" value={`${generalForm.receiptPaperWidth}MM`} />
                        <Metric label="Papel prod" value={`${generalForm.kitchenPaperWidth}MM`} />
                      </div>
                    </div>
                    {desktopMode ? (
                      <DesktopPrintQueueCard
                        queue={desktopPrintQueue}
                        loading={loadingDesktopPrintQueue}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            )}
            {tab === 'server' && (
              <div className="flex h-full flex-col">
                <Header>
                  <div className="flex gap-2">
                    <ActionButton
                      variant="secondary"
                      size="sm"
                      onClick={() => queryClient.invalidateQueries({ queryKey: ['settings-data'] })}
                    >
                      <RefreshCw className="w-3 h-3" />
                      Refrescar panel
                    </ActionButton>
                  </div>
                </Header>
                <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar">
                  <ServerConnectionPanel />
                </div>
              </div>
            )}
          </div>

          {!isSinglePaneTab ? (
            <div className="w-[180px] shrink-0 min-h-0 overflow-hidden bg-surface-container-low border-l border-outline-variant/10">
              <div className="h-full overflow-y-auto p-1.5 custom-scrollbar">
                {tab === 'users' ? (
                  selectedUser ? (
                    <div className="space-y-3">
                      <Info label="Nombre" value={selectedUser.name} />
                      <Info label="Correo" value={selectedUser.email} />
                      <Info label="Rol" value={selectedUser.role.name} />
                      {['ADMIN', 'SUPERVISOR', 'CAJERO', 'COCINA', 'MESERO'].includes(selectedUser.role.name) ? (
                        <Info label="PIN tablet" value={selectedUser.tabletPin || 'Sin PIN'} />
                      ) : null}
                      <Info label="Estado" value={selectedUser.isActive ? 'Activo' : 'Inactivo'} />
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <ActionButton variant="secondary" size="sm" fullWidth onClick={() => openEditUser(selectedUser)}>Editar</ActionButton>
                        <ActionButton variant="danger" size="sm" fullWidth onClick={() => removeUser.mutate(selectedUser.id)} disabled={removeUser.isPending}>Eliminar</ActionButton>
                      </div>
                    </div>
                  ) : <Empty message="Selecciona un usuario para ver el detalle." />
                ) : tab === 'waiters' ? (
                  selectedWaiter ? (
                    <div className="space-y-3">
                      <Info label="Nombre" value={selectedWaiter.name} />
                      <Info label="Correo" value={selectedWaiter.email} />
                      <Info label="PIN tablet" value={selectedWaiter.tabletPin || 'Sin PIN'} />
                      <Info label="Estado" value={selectedWaiter.isActive ? 'Activo' : 'Inactivo'} />
                      <Info label="Rol" value={selectedWaiter.role.name} />
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <ActionButton variant="secondary" size="sm" fullWidth onClick={() => openEditUser(selectedWaiter)}>Editar</ActionButton>
                        <ActionButton variant="danger" size="sm" fullWidth onClick={() => removeUser.mutate(selectedWaiter.id)} disabled={removeUser.isPending}>Eliminar</ActionButton>
                      </div>
                    </div>
                  ) : <Empty message="Selecciona un mesero para ver el detalle." />
                ) : tab === 'appearance' ? (
                  <div className="space-y-3">
                    <Metric label="Tema activo" value={selectedTheme.label.toUpperCase()} />
                    <Metric label="Fondos" value="COHERENTES" />
                    <Metric label="Contraste" value="ALTO" />
                    <Metric label="Acento" value="VISIBLE" />
                    <div className="border border-white/5 bg-surface-container-highest/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-[3px] backdrop-blur-md p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-outline">Criterio</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface">
                        Ningún perfil usa texto claro sobre fondo claro. Cada tema fue armado como sistema completo.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Metric label="Usuarios activos" value={String(metrics.activeUsers).padStart(2, '0')} />
                    <Metric label="Admins" value={String(metrics.adminUsers).padStart(2, '0')} />
                    <Metric label="Dispositivos activos" value={String(metrics.enabledDevices).padStart(2, '0')} />
                    {tab === 'general' ? <Metric label="WhatsApp addon" value={generalForm.whatsappAddonEnabled ? 'ACTIVO' : 'APAGADO'} /> : null}
                    {tab === 'database' ? <Metric label="Módulo" value="SQL" /> : null}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {userModalOpen && (
        <ModalShell title={editingUser ? 'Editar usuario' : 'Nuevo usuario'} description="Credenciales y permisos operativos." onClose={() => { setUserModalOpen(false); setEditingUser(null); setUserForm(emptyUserForm); }}>
          <div className="space-y-4">
            <Field label="Nombre"><input value={userForm.name} onChange={(e) => setUserForm((c) => ({ ...c, name: e.target.value }))} className={fieldClass} /></Field>
            <Field label="Correo"><input type="email" value={userForm.email} onChange={(e) => setUserForm((c) => ({ ...c, email: e.target.value }))} className={fieldClass} /></Field>
            {!editingUser && <Field label="Contraseña"><input type="password" value={userForm.password} onChange={(e) => setUserForm((c) => ({ ...c, password: e.target.value }))} className={fieldClass} /></Field>}
            <Field label="Rol"><select value={userForm.roleId} onChange={(e) => setUserForm((c) => ({ ...c, roleId: e.target.value }))} className={fieldClass} disabled={tab === 'waiters'}>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></Field>
            {isStaffRole ? (
              <Field label="PIN tablet (4 dígitos)">
                <input
                  inputMode="numeric"
                  maxLength={4}
                  value={userForm.tabletPin}
                  onChange={(e) =>
                    setUserForm((c) => ({
                      ...c,
                      tabletPin: e.target.value.replace(/\D/g, '').slice(0, 4),
                    }))
                  }
                  className={fieldClass}
                  placeholder="0000"
                />
              </Field>
            ) : null}
            {editingUser && <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-on-surface"><input type="checkbox" checked={userForm.isActive} onChange={(e) => setUserForm((c) => ({ ...c, isActive: e.target.checked }))} /> Usuario activo</label>}
            <ActionButton variant="primary" size="md" fullWidth onClick={() => saveUser.mutate()} disabled={saveUser.isPending || !userForm.name || !userForm.email || !userForm.roleId || (!editingUser && userForm.password.length < 6) || (selectedRole?.name === 'MESERO' && userForm.tabletPin.length !== 4)}>
              {saveUser.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Guardar usuario
            </ActionButton>
          </div>
        </ModalShell>
      )}

      {areaModalOpen && (
        <ModalShell
          title={editingArea ? 'Editar Área' : 'Nueva Área'}
          description="Define un salón o sección del restaurante."
          onClose={() => setAreaModalOpen(false)}
        >
          <div className="space-y-4">
            <Field label="Nombre del Área">
              <input
                value={areaName}
                onChange={(e) => setAreaName(e.target.value)}
                className={fieldClass}
                placeholder="Ej. Comedor Principal, Terraza, Barra"
              />
            </Field>
            <ActionButton
              variant="primary"
              size="md"
              fullWidth
              onClick={() => saveArea.mutate()}
              disabled={saveArea.isPending || !areaName.trim()}
            >
              {saveArea.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Guardar Área
            </ActionButton>
          </div>
        </ModalShell>
      )}

      {tableModalOpen && (
        <ModalShell
          title={editingTable ? 'Editar Mesa' : 'Nueva Mesa'}
          description={`Ubicada en: ${areas.find((a: any) => a.id === selectedAreaIdForTables)?.name}`}
          onClose={() => setTableModalOpen(false)}
        >
          <div className="space-y-4">
            <Field label="Nombre/Número de Mesa">
              <input
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                className={fieldClass}
                placeholder="Ej. Mesa 1, Barra 5, VIP 1"
              />
            </Field>
            <ActionButton
              variant="primary"
              size="md"
              fullWidth
              onClick={() => saveTable.mutate()}
              disabled={saveTable.isPending || !tableName.trim()}
            >
              {saveTable.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Guardar Mesa
            </ActionButton>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function Header({ children }: { children?: React.ReactNode }) {
  if (!children) {
    return null;
  }

  return <div className="flex flex-wrap items-center justify-end gap-1.5 border-b border-outline-variant/10 bg-surface-container-lower/60 backdrop-blur-md px-2 py-1 z-10 shadow-sm">{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="group"><label className="mb-0.5 block text-[8px] font-black uppercase tracking-[0.14em] text-outline group-focus-within:text-primary transition-colors">{label}</label>{children}</div>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div className="relative overflow-hidden border border-outline-variant/10 bg-gradient-to-br from-surface-container-high/80 to-surface-container/30 px-1.5 py-0.5 rounded-[2px] shadow-sm hover:shadow-md transition-all group duration-300"><div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" /><span className="relative z-10 block text-[7.5px] font-black uppercase tracking-[0.1em] text-outline group-hover:text-primary/70 transition-colors duration-300">{label}</span><span className="relative z-10 mt-0.5 block text-[10px] font-headline font-black uppercase text-on-surface drop-shadow-sm">{value}</span></div>;
}
function Info({ label, value }: { label: string; value: string }) {
  return <div className="border-b border-outline-variant/5 pb-1 last:border-b-0 hover:bg-surface-container-high/20 px-1 transition-colors rounded-[2px]"><p className="text-[9px] font-black uppercase tracking-[0.12em] text-outline">{label}</p><p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.06em] text-on-surface">{value}</p></div>;
}
function Empty({ message }: { message: string }) {
  return <div className="flex min-h-24 items-center justify-center border border-dashed border-outline-variant/20 bg-surface-container-high/10 backdrop-blur-sm px-2 text-center rounded-[4px]"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-outline animate-pulse-slow">{message}</p></div>;
}
