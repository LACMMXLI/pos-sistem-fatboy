import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, HardDrive, Loader2, Mail, Palette, Printer, RefreshCw, Save, ShieldCheck, SlidersHorizontal, Trash2, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { DesktopPrintQueueCard } from '../../components/printing/DesktopPrintQueueCard';
import { useDesktopPrintQueue } from '../../hooks/useDesktopPrintQueue';
import { isDesktopRuntime, openDesktopCashDrawer } from '../../lib/runtime';
import ActionButton from '../../components/ui/ActionButton';
import ModalShell from '../../components/ui/ModalShell';
import { clearBusinessData, clearEmployeesData, createUser, deleteUser, getAdminSettings, getInstalledPrinters, getRoles, getUsers, testShiftEmailSettings, updateSettings, updateUser } from '../../services/api';
import { useSettingsStore } from '../../store/settingsStore';
import { cn } from '../../lib/utils';
import { getThemePalette, resolveThemePresetFromSettings, themeFamilies, themePalettes, type ThemePresetId } from '../../lib/theme';

type TabId = 'general' | 'appearance' | 'users' | 'waiters' | 'database' | 'email' | 'devices';
type Role = { id: number; name: string };
type User = { id: number; name: string; email: string; tabletPin?: string | null; isActive: boolean; createdAt: string; role: Role };
type UserForm = { name: string; email: string; password: string; roleId: string; tabletPin: string; isActive: boolean };

const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: 'general', label: 'General', icon: <SlidersHorizontal className="w-3.5 h-3.5" /> },
  { id: 'appearance', label: 'Apariencia', icon: <Palette className="w-3.5 h-3.5" /> },
  { id: 'users', label: 'Usuarios', icon: <Users className="w-3.5 h-3.5" /> },
  { id: 'waiters', label: 'Meseros', icon: <Users className="w-3.5 h-3.5" /> },
  { id: 'database', label: 'Base de datos', icon: <Database className="w-3.5 h-3.5" /> },
  { id: 'email', label: 'Correo', icon: <Mail className="w-3.5 h-3.5" /> },
  { id: 'devices', label: 'Impresión / KDS', icon: <Printer className="w-3.5 h-3.5" /> },
];

const emptyUserForm: UserForm = { name: '', email: '', password: '', roleId: '', tabletPin: '', isActive: true };
const fieldClass = 'w-full bg-surface-container-highest border border-outline-variant/20 px-2 py-1.5 text-[10px] font-bold text-on-surface outline-none focus:border-primary';

export function SettingsScreen() {
  const queryClient = useQueryClient();
  const setSettingsStore = useSettingsStore((state) => state.setSettings);
  const [tab, setTab] = useState<TabId>('general');
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
  const isSinglePaneTab = tab === 'devices' || tab === 'email';
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
      if (selectedRole?.name === 'MESERO') {
        payload.tabletPin = userForm.tabletPin;
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
  const isWaiterRoleSelected = selectedRole?.name === 'MESERO';

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
    <div className="h-full p-1">
      <div className="flex h-full flex-col gap-1 overflow-hidden">
        <div className="border border-outline-variant/10 bg-surface-container-low shadow-xl">
          <div className="flex flex-wrap items-end gap-0.5 px-1.5 py-1">
            {tabs.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={cn(
                  'flex w-fit items-center justify-center gap-1.5 rounded-t-sm border border-b-0 px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[0.14em] transition-all',
                  tab === item.id ? 'border-primary/40 bg-surface text-primary' : 'border-outline-variant/15 bg-surface-container-high text-outline hover:text-white',
                )}
              >
                <span className={cn(tab === item.id ? 'text-primary' : 'text-outline/50')}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className={cn('grid min-h-0 flex-1 gap-1 overflow-hidden', isSinglePaneTab ? 'grid-cols-1' : 'grid-cols-12')}>
          <div className={cn('min-h-0 overflow-hidden border border-outline-variant/10 bg-surface-container-low shadow-xl', isSinglePaneTab ? 'col-span-1' : 'col-span-9')}>
            {tab === 'general' && (
              <div className="flex h-full flex-col">
                <Header>
                  <ActionButton variant="primary" size="sm" onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending || loadingSettings}>
                    {saveSettings.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Guardar
                  </ActionButton>
                </Header>
                <div className="grid flex-1 grid-cols-[minmax(0,1.45fr)_minmax(260px,0.95fr)] gap-2 p-2">
                  <div className="space-y-2">
                    <Field label="Nombre del negocio"><input value={generalForm.restaurantName} onChange={(e) => setGeneralForm((c) => ({ ...c, restaurantName: e.target.value }))} className={fieldClass} /></Field>
                    <Field label="Dirección"><textarea rows={5} value={generalForm.restaurantAddress} onChange={(e) => setGeneralForm((c) => ({ ...c, restaurantAddress: e.target.value }))} className={`${fieldClass} resize-none`} /></Field>
                  </div>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-1.5">
                      <Metric label="Usuarios activos" value={String(metrics.activeUsers).padStart(2, '0')} />
                      <Metric label="Admins" value={String(metrics.adminUsers).padStart(2, '0')} />
                    </div>
                    <div className="border border-outline-variant/10 bg-surface-container-high p-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[8px] font-black uppercase tracking-[0.16em] text-on-surface">IVA habilitado</p>
                          <p className="mt-1 text-[7px] font-bold uppercase tracking-[0.12em] text-outline">Impuesto global en ventas</p>
                        </div>
                        <button onClick={() => setGeneralForm((c) => ({ ...c, taxEnabled: !c.taxEnabled }))} className={cn('relative h-7 w-14 border transition-colors', generalForm.taxEnabled ? 'border-primary bg-primary' : 'border-outline-variant/20 bg-surface-container-lowest')}>
                          <span className={cn('absolute top-0 h-full w-7 bg-white transition-transform', generalForm.taxEnabled ? 'translate-x-7' : 'translate-x-0')} />
                        </button>
                      </div>
                    </div>
                    <div className="border border-outline-variant/10 bg-surface-container-high p-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[8px] font-black uppercase tracking-[0.16em] text-on-surface">Notificaciones de WhatsApp</p>
                          <p className="mt-1 text-[7px] font-bold uppercase tracking-[0.12em] text-outline">Activa o desactiva el addon externo desde el sistema</p>
                        </div>
                        <button onClick={() => setGeneralForm((c) => ({ ...c, whatsappAddonEnabled: !c.whatsappAddonEnabled }))} className={cn('relative h-7 w-14 border transition-colors', generalForm.whatsappAddonEnabled ? 'border-primary bg-primary' : 'border-outline-variant/20 bg-surface-container-lowest')}>
                          <span className={cn('absolute top-0 h-full w-7 bg-white transition-transform', generalForm.whatsappAddonEnabled ? 'translate-x-7' : 'translate-x-0')} />
                        </button>
                      </div>
                    </div>
                    <Field label="Tasa de impuesto (%)"><input type="number" min="0" step="0.01" value={generalForm.taxRate} onChange={(e) => setGeneralForm((c) => ({ ...c, taxRate: e.target.value }))} className={fieldClass} /></Field>
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
                <div className="grid flex-1 grid-cols-[minmax(0,1.5fr)_280px] gap-2 p-2">
                  <div className="min-h-0 overflow-hidden">
                    <div className="mb-1.5 border border-outline-variant/10 bg-surface-container-high p-2">
                      <p className="text-[8px] font-black uppercase tracking-[0.16em] text-on-surface">Perfiles predefinidos</p>
                      <p className="mt-1 text-[7px] font-bold uppercase tracking-[0.12em] text-outline">
                        Todos están balanceados para mantener contraste entre fondo, panel y texto.
                      </p>
                    </div>
                    <div className="grid h-full grid-cols-2 gap-2 overflow-y-auto custom-scrollbar content-start pr-1 pb-10 uppercase md:grid-cols-3">
                      {themeFamilies.map((family) => {
                        const familyThemes = themePalettes.filter((theme) => theme.family === family.id);

                        return (
                          <section key={family.id} className="flex h-fit flex-col border border-outline-variant/10 bg-surface-container-high p-1.5">
                            <div className="mb-1.5 flex items-end justify-between gap-2 border-b border-outline-variant/10 pb-1">
                              <div>
                                <p className="text-[8px] font-black uppercase tracking-[0.18em] text-on-surface">{family.label}</p>
                                <p className="mt-1 text-[7px] font-bold uppercase tracking-[0.12em] text-outline">{family.description}</p>
                              </div>
                              <span className="border border-outline-variant/10 bg-surface-container px-1.5 py-0.5 text-[6px] font-black uppercase tracking-[0.16em] text-outline">
                                {familyThemes.length} temas
                              </span>
                            </div>
                            <div className="grid flex-1 gap-1">
                              {familyThemes.map((theme) => {
                                const isActive = generalForm.themePreset === theme.id;
                                return (
                                  <button
                                    key={theme.id}
                                    type="button"
                                    onClick={() => handleThemeSelect(theme.id)}
                                    className={cn(
                                      'border p-1.5 text-left transition-all',
                                      isActive
                                        ? 'border-primary/40 bg-surface-container-highest shadow-lg shadow-primary/10'
                                        : 'border-outline-variant/10 bg-surface-container-lowest hover:border-primary/20 hover:bg-surface-container-high',
                                    )}
                                  >
                                    <div className="mb-1 flex items-center justify-between gap-2">
                                      <span className="text-[8px] font-black uppercase tracking-[0.16em] text-on-surface">{theme.label}</span>
                                      <span
                                        className={cn(
                                          'border px-1.5 py-0.5 text-[6px] font-black uppercase tracking-[0.16em]',
                                          isActive
                                            ? 'border-primary/30 bg-primary/10 text-primary'
                                            : 'border-outline-variant/10 bg-surface-container text-outline',
                                        )}
                                      >
                                        {isActive ? 'Activo' : 'Elegir'}
                                      </span>
                                    </div>
                                    <div className="mb-1 grid grid-cols-[1.2fr_1.2fr_0.9fr_0.7fr] gap-1">
                                      <span className="h-5 border border-black/10" style={{ backgroundColor: theme.paperColor }} />
                                      <span className="h-5 border border-black/10" style={{ backgroundColor: theme.panelColor }} />
                                      <span className="h-5 border border-black/10" style={{ backgroundColor: theme.accentColor }} />
                                      <span className="h-5 border border-black/10" style={{ backgroundColor: theme.inkColor }} />
                                    </div>
                                    <p className="text-[6px] font-bold uppercase tracking-[0.1em] text-outline">{theme.description}</p>
                                  </button>
                                );
                              })}
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="border border-outline-variant/10 bg-surface-container-high p-2.5">
                      <p className="text-[8px] font-black uppercase tracking-[0.16em] text-on-surface">Tema activo</p>
                      <p className="mt-1 text-[11px] font-headline font-black uppercase text-primary">{selectedTheme.label}</p>
                      <p className="mt-1 text-[7px] font-bold uppercase tracking-[0.12em] text-outline">{selectedTheme.description}</p>
                    </div>
                    <div className="border border-outline-variant/10 bg-surface-container-high p-2.5">
                      <p className="text-[8px] font-black uppercase tracking-[0.16em] text-on-surface">Vista previa</p>
                      <div className="mt-1.5 space-y-1.5 border border-outline-variant/10 p-2" style={{ backgroundColor: selectedTheme.paperColor }}>
                        <div className="border px-2 py-2" style={{ backgroundColor: selectedTheme.panelColor, borderColor: `${selectedTheme.accentColor}55` }}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[8px] font-black uppercase tracking-[0.16em]" style={{ color: selectedTheme.inkColor }}>
                              Encabezado
                            </span>
                            <span
                              className="px-2 py-1 text-[7px] font-black uppercase tracking-[0.16em]"
                              style={{ backgroundColor: selectedTheme.accentColor, color: selectedTheme.paperColor === '#ffffff' || selectedTheme.paperColor === '#fffdf8' ? '#ffffff' : '#1a0a00' }}
                            >
                              Acción
                            </span>
                          </div>
                          <p className="mt-2 text-[7px] font-bold uppercase tracking-[0.12em]" style={{ color: `${selectedTheme.inkColor}D9` }}>
                            Texto principal visible, panel definido y botones con acento fuerte.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1 border px-2 py-2" style={{ backgroundColor: selectedTheme.panelColor, borderColor: `${selectedTheme.accentColor}22` }}>
                            <span className="block text-[6px] font-black uppercase tracking-[0.14em]" style={{ color: `${selectedTheme.inkColor}B8` }}>Panel</span>
                            <span className="mt-1 block text-[9px] font-black uppercase" style={{ color: selectedTheme.inkColor }}>Contenido</span>
                          </div>
                          <div className="flex-1 border px-2 py-2" style={{ backgroundColor: selectedTheme.accentColor, borderColor: `${selectedTheme.accentColor}88`, color: selectedTheme.paperColor === '#ffffff' || selectedTheme.paperColor === '#fffdf8' ? '#ffffff' : '#1a0a00' }}>
                            <span className="block text-[6px] font-black uppercase tracking-[0.14em]">Primario</span>
                            <span className="mt-1 block text-[9px] font-black uppercase">Botón</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Metric label="Temas disponibles" value={String(themePalettes.length).padStart(2, '0')} />
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
                            <th key={label} className="px-2 py-1.5 text-[6px] font-black uppercase tracking-[0.14em] text-outline">{label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/5">
                        {users.map((user) => (
                          <tr key={user.id} onClick={() => setSelectedUserId(user.id)} className={cn('cursor-pointer transition-colors hover:bg-surface-container-high', selectedUserId === user.id && 'bg-surface-container-high border-l-4 border-primary')}>
                            <td className="px-2 py-1.5 text-[9px] font-black uppercase text-on-surface">{user.name}</td>
                            <td className="px-2 py-1.5 text-[7px] font-bold text-outline">{user.email}</td>
                            <td className="whitespace-nowrap px-2 py-1.5"><span className="border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[6px] font-black uppercase tracking-[0.12em] text-primary">{user.role.name}</span></td>
                            <td className="whitespace-nowrap px-2 py-1.5 text-[7px] font-bold uppercase text-on-surface">{user.isActive ? 'Activo' : 'Inactivo'}</td>
                            <td className="whitespace-nowrap px-2 py-1.5 text-[7px] font-bold uppercase text-outline">{new Date(user.createdAt).toLocaleDateString('es-MX')}</td>
                            <td className="whitespace-nowrap px-2 py-1.5 text-right"><button onClick={(e) => { e.stopPropagation(); openEditUser(user); }} className="border border-outline-variant/10 bg-surface-container-highest px-2 py-0.5 text-[6px] font-black uppercase tracking-[0.12em] text-on-surface hover:text-primary">Editar</button></td>
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
                            <th key={label} className="px-2 py-1.5 text-[6px] font-black uppercase tracking-[0.14em] text-outline">{label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/5">
                        {waiters.map((user) => (
                          <tr key={user.id} onClick={() => setSelectedUserId(user.id)} className={cn('cursor-pointer transition-colors hover:bg-surface-container-high', selectedUserId === user.id && 'bg-surface-container-high border-l-4 border-primary')}>
                            <td className="px-2 py-1.5 text-[9px] font-black uppercase text-on-surface">{user.name}</td>
                            <td className="px-2 py-1.5 text-[7px] font-bold text-outline">{user.email}</td>
                            <td className="whitespace-nowrap px-2 py-1.5 text-[7px] font-bold uppercase text-on-surface">{user.isActive ? 'Activo' : 'Inactivo'}</td>
                            <td className="whitespace-nowrap px-2 py-1.5 text-[7px] font-bold uppercase text-outline">{new Date(user.createdAt).toLocaleDateString('es-MX')}</td>
                            <td className="whitespace-nowrap px-2 py-1.5 text-right"><button onClick={(e) => { e.stopPropagation(); openEditUser(user); }} className="border border-outline-variant/10 bg-surface-container-highest px-2 py-0.5 text-[6px] font-black uppercase tracking-[0.12em] text-on-surface hover:text-primary">Editar</button></td>
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
                <div className="grid flex-1 grid-cols-2 gap-1.5 p-1.5">
                  <Metric label="Motor" value="POSTGRES" />
                  <Metric label="Estado" value="ONLINE" />
                  <div className="col-span-2 border border-red-500/15 bg-red-500/5 p-2.5">
                    <div className="flex items-start gap-3">
                      <Trash2 className="mt-0.5 w-4 h-4 text-red-400" />
                      <div className="flex-1">
                        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-red-300">Purga total de registros</p>
                        <p className="mt-2 text-[8px] font-bold uppercase tracking-[0.12em] text-outline">Acción irreversible sobre historial comercial y operativo.</p>
                        <div className="mt-2.5 flex gap-1.5">
                          <input type="password" placeholder="Contraseña de administrador" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className={fieldClass} />
                          <ActionButton variant="danger" size="md" onClick={() => purgeDb.mutate()} disabled={purgeDb.isPending || !adminPassword}>
                            {purgeDb.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            Purga
                          </ActionButton>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 border border-amber-500/15 bg-amber-500/5 p-2.5">
                    <div className="flex items-start gap-3">
                      <Trash2 className="mt-0.5 w-4 h-4 text-amber-300" />
                      <div className="flex-1">
                        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-amber-200">Purga total de empleados</p>
                        <p className="mt-2 text-[8px] font-bold uppercase tracking-[0.12em] text-outline">Elimina empleados, asistencias, adelantos, deudas, consumos e historial de nomina.</p>
                        <div className="mt-2.5 flex gap-1.5">
                          <input type="password" placeholder="Contraseña de administrador" value={employeePurgePassword} onChange={(e) => setEmployeePurgePassword(e.target.value)} className={fieldClass} />
                          <ActionButton variant="danger" size="md" onClick={() => purgeEmployees.mutate()} disabled={purgeEmployees.isPending || !employeePurgePassword}>
                            {purgeEmployees.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            Limpiar empleados
                          </ActionButton>
                        </div>
                      </div>
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
                <div className="grid flex-1 grid-cols-[minmax(0,1.4fr)_260px] gap-1.5 p-1.5">
                  <div className="space-y-1.5 border border-outline-variant/10 bg-surface-container-high p-2">
                    <div className="flex items-start gap-3">
                      <div className="border border-primary/20 bg-primary/10 p-1.5 text-primary">
                        <Mail className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[8px] font-black uppercase tracking-[0.14em] text-on-surface">Correo de cortes</p>
                            <p className="mt-0.5 text-[6px] font-bold uppercase tracking-[0.1em] text-outline">Envía PDF al cierre del turno</p>
                          </div>
                          <button onClick={() => setGeneralForm((curr) => ({ ...curr, shiftEmailEnabled: !curr.shiftEmailEnabled }))} className={cn('relative h-7 w-14 border transition-colors', generalForm.shiftEmailEnabled ? 'border-primary bg-primary' : 'border-outline-variant/20 bg-surface-container-low')}>
                            <span className={cn('absolute top-0 h-full w-7 bg-white transition-transform', generalForm.shiftEmailEnabled ? 'translate-x-7' : 'translate-x-0')} />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-[minmax(0,1.2fr)_110px] gap-1.5">
                      <Field label="SMTP host">
                        <input value={generalForm.shiftEmailHost} onChange={(e) => setGeneralForm((curr) => ({ ...curr, shiftEmailHost: e.target.value }))} className={fieldClass} placeholder="smtp.tudominio.com" />
                      </Field>
                      <Field label="Puerto">
                        <input type="number" value={generalForm.shiftEmailPort} onChange={(e) => setGeneralForm((curr) => ({ ...curr, shiftEmailPort: e.target.value }))} className={fieldClass} placeholder="587" />
                      </Field>
                      <Field label="Usuario SMTP">
                        <input value={generalForm.shiftEmailUser} onChange={(e) => setGeneralForm((curr) => ({ ...curr, shiftEmailUser: e.target.value }))} className={fieldClass} placeholder="usuario@dominio.com" />
                      </Field>
                      <Field label="Password SMTP">
                        <input type="password" value={generalForm.shiftEmailPassword} onChange={(e) => setGeneralForm((curr) => ({ ...curr, shiftEmailPassword: e.target.value }))} className={fieldClass} placeholder="********" />
                      </Field>
                      <Field label="Remitente">
                        <input value={generalForm.shiftEmailFrom} onChange={(e) => setGeneralForm((curr) => ({ ...curr, shiftEmailFrom: e.target.value }))} className={fieldClass} placeholder="cortes@negocio.com" />
                      </Field>
                      <Field label="Destinatario principal">
                        <input value={generalForm.shiftEmailTo} onChange={(e) => setGeneralForm((curr) => ({ ...curr, shiftEmailTo: e.target.value }))} className={fieldClass} placeholder="gerencia@negocio.com" />
                      </Field>
                    </div>
                    <Field label="Copias (CC)">
                      <textarea rows={2} value={generalForm.shiftEmailCc} onChange={(e) => setGeneralForm((curr) => ({ ...curr, shiftEmailCc: e.target.value }))} className={`${fieldClass} resize-none`} placeholder="dueno@negocio.com, contador@negocio.com" />
                    </Field>
                    <div className="border border-outline-variant/10 bg-surface-container-high p-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[7px] font-black uppercase tracking-[0.14em] text-on-surface">Conexión segura</p>
                          <p className="mt-0.5 text-[6px] font-bold uppercase tracking-[0.1em] text-outline">SSL directo para 465</p>
                        </div>
                        <button onClick={() => setGeneralForm((curr) => ({ ...curr, shiftEmailSecure: !curr.shiftEmailSecure }))} className={cn('relative h-7 w-14 border transition-colors', generalForm.shiftEmailSecure ? 'border-primary bg-primary' : 'border-outline-variant/20 bg-surface-container-low')}>
                          <span className={cn('absolute top-0 h-full w-7 bg-white transition-transform', generalForm.shiftEmailSecure ? 'translate-x-7' : 'translate-x-0')} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="border border-outline-variant/10 bg-surface-container-high p-2 space-y-2">
                      <Metric label="Correo automático" value={generalForm.shiftEmailEnabled ? 'ACTIVO' : 'APAGADO'} />
                      <Metric label="Servidor SMTP" value={generalForm.shiftEmailHost ? 'CONFIGURADO' : 'PENDIENTE'} />
                      <Metric label="Destinatario" value={generalForm.shiftEmailTo ? 'OK' : 'PENDIENTE'} />
                      <Metric label="Seguridad" value={generalForm.shiftEmailSecure ? 'SSL' : 'STARTTLS'} />
                    </div>
                    <div className="border border-outline-variant/10 bg-surface-container-high p-2">
                      <div className="flex items-start gap-3">
                        <div className="border border-primary/20 bg-primary/10 p-1.5 text-primary">
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="text-[7px] font-black uppercase tracking-[0.14em] text-on-surface">Uso recomendado</p>
                          <p className="mt-0.5 text-[6px] font-bold uppercase tracking-[0.1em] text-outline">
                            Mantén aquí solo el envío automático de cortes. La impresión y KDS viven en su propia pestaña.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="border border-outline-variant/10 bg-surface-container-high p-2">
                      <p className="text-[7px] font-black uppercase tracking-[0.14em] text-on-surface">Diagnóstico rápido</p>
                      <p className="mt-0.5 text-[6px] font-bold uppercase tracking-[0.1em] text-outline">
                        Usa "Probar correo" para validar SMTP y envío antes de cerrar turno. Si dejas la contraseña vacía, se conserva la guardada.
                      </p>
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
                    <div className="border border-outline-variant/10 bg-surface-container-high p-1.5">
                      <div className="flex items-center gap-2.5">
                        <div className="border border-primary/20 bg-primary/10 p-1.5 text-primary">
                          <Printer className="w-3 h-3" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[6px] font-black uppercase tracking-[0.12em] text-on-surface">Puente central de impresión</p>
                          <p className="mt-0.5 text-[5px] font-bold uppercase tracking-[0.08em] text-outline">Electron recibe, enruta y serializa tickets RAW en Windows</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="border border-outline-variant/10 bg-surface-container-high p-1.5 space-y-1">
                        <p className="text-[6px] font-black uppercase tracking-[0.12em] text-on-surface">Caja / Frontend</p>
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
                      <div className="border border-outline-variant/10 bg-surface-container-high p-1.5 space-y-1">
                        <p className="text-[6px] font-black uppercase tracking-[0.12em] text-on-surface">Producción / HM / tablets</p>
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
                      <div className="border border-outline-variant/10 bg-surface-container-high p-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[6px] font-black uppercase tracking-[0.12em] text-on-surface">Imprimir al cobrar</p>
                            <p className="mt-0.5 text-[5px] font-bold uppercase tracking-[0.08em] text-outline">Take away imprime automático</p>
                          </div>
                          <button onClick={() => setGeneralForm((curr) => ({ ...curr, receiptAutoPrint: !curr.receiptAutoPrint }))} className={cn('relative h-6 w-12 shrink-0 border transition-colors', generalForm.receiptAutoPrint ? 'border-primary bg-primary' : 'border-outline-variant/20 bg-surface-container-low')}>
                            <span className={cn('absolute top-0 h-full w-6 bg-white transition-transform', generalForm.receiptAutoPrint ? 'translate-x-6' : 'translate-x-0')} />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="border border-outline-variant/10 bg-surface-container-high p-1.5">
                          <p className="text-[6px] font-black uppercase tracking-[0.12em] text-outline">Detección</p>
                          <p className="mt-0.5 text-[8px] font-black uppercase text-on-surface">
                            {loadingPrinters ? 'Buscando...' : `${installedPrinters.length} impresoras`}
                          </p>
                        </div>
                        <div className="border border-outline-variant/10 bg-surface-container-high p-1.5">
                          <p className="text-[6px] font-black uppercase tracking-[0.12em] text-outline">Ruteo</p>
                          <p className="mt-0.5 text-[8px] font-black uppercase text-on-surface">
                            {generalForm.kitchenPrinterName ? 'SEPARADO' : 'FALLBACK'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="border border-outline-variant/10 bg-surface-container-high p-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[6px] font-black uppercase tracking-[0.12em] text-on-surface">Corte automático</p>
                          <p className="mt-0.5 text-[5px] font-bold uppercase tracking-[0.08em] text-outline">Corta tickets y cortes</p>
                        </div>
                        <button onClick={() => setGeneralForm((curr) => ({ ...curr, receiptCutEnabled: !curr.receiptCutEnabled }))} className={cn('relative h-6 w-12 shrink-0 border transition-colors', generalForm.receiptCutEnabled ? 'border-primary bg-primary' : 'border-outline-variant/20 bg-surface-container-low')}>
                          <span className={cn('absolute top-0 h-full w-6 bg-white transition-transform', generalForm.receiptCutEnabled ? 'translate-x-6' : 'translate-x-0')} />
                        </button>
                      </div>
                    </div>
                    <div className="border border-outline-variant/10 bg-surface-container-high p-1.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[6px] font-black uppercase tracking-[0.12em] text-on-surface">Cajón de dinero</p>
                          <p className="mt-0.5 text-[5px] font-bold uppercase tracking-[0.08em] text-outline">Pulso ESC/POS de apertura</p>
                        </div>
                        <button onClick={() => setGeneralForm((curr) => ({ ...curr, cashDrawerEnabled: !curr.cashDrawerEnabled }))} className={cn('relative h-6 w-12 shrink-0 border transition-colors', generalForm.cashDrawerEnabled ? 'border-primary bg-primary' : 'border-outline-variant/20 bg-surface-container-low')}>
                          <span className={cn('absolute top-0 h-full w-6 bg-white transition-transform', generalForm.cashDrawerEnabled ? 'translate-x-6' : 'translate-x-0')} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[6px] font-black uppercase tracking-[0.12em] text-on-surface">Abrir al cobrar en efectivo</p>
                          <p className="mt-0.5 text-[5px] font-bold uppercase tracking-[0.08em] text-outline">Solo en pagos en efectivo</p>
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
                          <span className={cn('absolute top-0 h-full w-6 bg-white transition-transform', generalForm.cashDrawerOpenOnCash ? 'translate-x-6' : 'translate-x-0')} />
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
                    <div className="border border-outline-variant/10 bg-surface-container-high p-1.5 space-y-1.5">
                      <div className="flex items-start gap-2">
                        <div className="border border-primary/20 bg-primary/10 p-1.5 text-primary">
                          <HardDrive className="w-3 h-3" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[6px] font-black uppercase tracking-[0.12em] text-on-surface">Estado operativo</p>
                          <p className="mt-0.5 text-[5px] font-bold uppercase tracking-[0.08em] text-outline">
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
          </div>

          {!isSinglePaneTab ? (
            <div className="col-span-3 min-h-0 overflow-hidden border border-outline-variant/10 bg-surface-container-low shadow-xl">
              <div className="h-full overflow-y-auto p-2 custom-scrollbar pb-8">
                {tab === 'users' ? (
                  selectedUser ? (
                    <div className="space-y-3">
                      <Info label="Nombre" value={selectedUser.name} />
                      <Info label="Correo" value={selectedUser.email} />
                      <Info label="Rol" value={selectedUser.role.name} />
                      {selectedUser.role.name === 'MESERO' ? (
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
                    <div className="border border-outline-variant/10 bg-surface-container-high p-3">
                      <p className="text-[7px] font-black uppercase tracking-[0.16em] text-outline">Criterio</p>
                      <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.12em] text-on-surface">
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
            {isWaiterRoleSelected ? (
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
            {editingUser && <label className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-on-surface"><input type="checkbox" checked={userForm.isActive} onChange={(e) => setUserForm((c) => ({ ...c, isActive: e.target.checked }))} /> Usuario activo</label>}
            <ActionButton variant="primary" size="md" fullWidth onClick={() => saveUser.mutate()} disabled={saveUser.isPending || !userForm.name || !userForm.email || !userForm.roleId || (!editingUser && userForm.password.length < 6) || (isWaiterRoleSelected && userForm.tabletPin.length !== 4)}>
              {saveUser.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Guardar usuario
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

  return <div className="flex flex-wrap items-center justify-end gap-1 border-b border-outline-variant/10 bg-surface-container-lowest px-2 py-1.5">{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-0.5 block text-[6px] font-black uppercase tracking-[0.12em] text-outline">{label}</label>{children}</div>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div className="border border-outline-variant/10 bg-surface-container-high px-1.5 py-1"><span className="block text-[5px] font-black uppercase tracking-[0.08em] text-outline">{label}</span><span className="mt-0.5 block text-[8px] font-headline font-black uppercase text-on-surface">{value}</span></div>;
}
function Info({ label, value }: { label: string; value: string }) {
  return <div className="border-b border-outline-variant/10 pb-1.5 last:border-b-0"><p className="text-[7px] font-black uppercase tracking-[0.12em] text-outline">{label}</p><p className="mt-1 text-[9px] font-black uppercase tracking-[0.06em] text-on-surface">{value}</p></div>;
}
function Empty({ message }: { message: string }) {
  return <div className="flex min-h-40 items-center justify-center border border-dashed border-outline-variant/20 bg-surface-container-high px-4 text-center"><p className="text-[8px] font-bold uppercase tracking-[0.12em] text-outline">{message}</p></div>;
}

        <div className="mb-6 flex h-44 w-44 items-center justify-center"></div>