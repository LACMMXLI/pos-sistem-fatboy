import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  PencilLine,
  PlusCircle,
  ReceiptText,
  RefreshCw,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import ActionButton from '../../components/ui/ActionButton';
import ModalShell from '../../components/ui/ModalShell';
import Switch from '../../components/ui/Switch';
import { cn, formatCurrency } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import {
  createEmployee,
  createEmployeeAdvance,
  createEmployeeConsumption,
  createEmployeeDebt,
  generateEmployeeCode,
  getEmployeeById,
  getEmployeeLedger,
  getEmployees,
  updateEmployee,
} from '../../services/api';

type EmployeeRecord = {
  id: number;
  fullName: string;
  employeeCode: string;
  weeklySalary: number;
  pendingBalance?: number;
  isActive: boolean;
  notes?: string | null;
};

type EmployeeDetail = EmployeeRecord & {
  payrolls?: Array<{
    id: number;
    periodStart: string;
    periodEnd: string;
    netPay: number;
    status: string;
  }>;
};

type LedgerEntry = {
  id: number;
  type: string;
  amount: number | string;
  description: string;
  entryDate: string;
  status: string;
};

type EmployeeForm = {
  fullName: string;
  employeeCode: string;
  weeklySalary: string;
  isActive: boolean;
  notes: string;
};

type MovementType = 'advance' | 'debt' | 'consumption';

const emptyForm: EmployeeForm = {
  fullName: '',
  employeeCode: '',
  weeklySalary: '',
  isActive: true,
  notes: '',
};

const employeeFieldClassName =
  'admin-input uppercase';

export function EmployeesScreen() {
  const role = useAuthStore((state) => state.user?.role ?? '');
  const canManageEmployees = ['ADMIN', 'SUPERVISOR'].includes(role);
  const canAssignAdvance = ['ADMIN', 'SUPERVISOR', 'CAJERO'].includes(role);
  const queryClient = useQueryClient();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRecord | null>(null);
  const [employeeForm, setEmployeeForm] = useState<EmployeeForm>(emptyForm);
  const [movementType, setMovementType] = useState<MovementType | null>(null);
  const [movementAmount, setMovementAmount] = useState('');
  const [movementDescription, setMovementDescription] = useState('');

  const { data: employees = [], isLoading: isLoadingEmployees } = useQuery<EmployeeRecord[]>({
    queryKey: ['employees-admin'],
    queryFn: getEmployees,
  });

  useEffect(() => {
    if (!selectedEmployeeId && employees.length > 0) {
      setSelectedEmployeeId(employees[0].id);
    }
  }, [employees, selectedEmployeeId]);

  const { data: employeeDetail, isLoading: isLoadingEmployeeDetail } = useQuery<EmployeeDetail>({
    queryKey: ['employee-detail-admin', selectedEmployeeId],
    queryFn: () => getEmployeeById(selectedEmployeeId!),
    enabled: !!selectedEmployeeId,
  });

  const { data: ledger = [], isLoading: isLoadingLedger } = useQuery<LedgerEntry[]>({
    queryKey: ['employee-ledger-admin', selectedEmployeeId],
    queryFn: () => getEmployeeLedger(selectedEmployeeId!),
    enabled: !!selectedEmployeeId,
  });

  const saveEmployeeMutation = useMutation({
    mutationFn: () => {
      const payload = {
        fullName: employeeForm.fullName,
        employeeCode: employeeForm.employeeCode,
        weeklySalary: Number(employeeForm.weeklySalary),
        isActive: employeeForm.isActive,
        notes: employeeForm.notes,
      };
      return editingEmployee ? updateEmployee(editingEmployee.id, payload) : createEmployee(payload);
    },
    onSuccess: () => {
      toast.success(editingEmployee ? 'Empleado actualizado' : 'Empleado creado');
      setIsEmployeeModalOpen(false);
      setEditingEmployee(null);
      setEmployeeForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ['employees-admin'] });
      if (selectedEmployeeId) {
        queryClient.invalidateQueries({ queryKey: ['employee-detail-admin', selectedEmployeeId] });
      }
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'No se pudo guardar el expediente');
    },
  });

  const movementMutation = useMutation({
    mutationFn: () => {
      if (!selectedEmployeeId || !movementType) {
        throw new Error('Selecciona un empleado');
      }

      const amount = Number(movementAmount);

      if (movementType === 'advance') {
        return createEmployeeAdvance(selectedEmployeeId, {
          amount,
          description: movementDescription,
        });
      }

      if (movementType === 'debt') {
        return createEmployeeDebt(selectedEmployeeId, {
          amount,
          description: movementDescription,
        });
      }

      return createEmployeeConsumption(selectedEmployeeId, {
        description: movementDescription,
        items: [
          {
            productName: movementDescription || 'Consumo interno',
            quantity: 1,
            unitPrice: amount,
          },
        ],
      });
    },
    onSuccess: () => {
      toast.success('Movimiento registrado');
      setMovementType(null);
      setMovementAmount('');
      setMovementDescription('');
      queryClient.invalidateQueries({ queryKey: ['employees-admin'] });
      if (selectedEmployeeId) {
        queryClient.invalidateQueries({ queryKey: ['employee-detail-admin', selectedEmployeeId] });
        queryClient.invalidateQueries({ queryKey: ['employee-ledger-admin', selectedEmployeeId] });
        queryClient.invalidateQueries({ queryKey: ['employee-ledger', selectedEmployeeId] });
      }
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'No se pudo registrar el movimiento');
    },
  });

  const openNewEmployee = () => {
    setEditingEmployee(null);
    setEmployeeForm({ ...emptyForm, employeeCode: generateEmployeeCode() });
    setIsEmployeeModalOpen(true);
  };

  const openEditEmployee = () => {
    if (!employeeDetail) return;
    setEditingEmployee(employeeDetail);
    setEmployeeForm({
      fullName: employeeDetail.fullName,
      employeeCode: employeeDetail.employeeCode,
      weeklySalary: String(employeeDetail.weeklySalary),
      isActive: employeeDetail.isActive,
      notes: employeeDetail.notes ?? '',
    });
    setIsEmployeeModalOpen(true);
  };

  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId);

  return (
    <div className="admin-shell h-full p-4">
      <div className="grid h-full grid-cols-12 gap-4 overflow-hidden">
        <div className="col-span-10 flex flex-col gap-1.5 overflow-hidden">
          <div className="flex items-end justify-between gap-4 px-1">
            <div>
              <p className="admin-eyebrow">Gestión de equipo</p>
              <h1 className="admin-title">Expedientes y movimientos</h1>
              <p className="admin-subtitle">Más espacio útil para consultar, editar y registrar movimientos sin perder contexto.</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <ActionButton
                onClick={() => queryClient.invalidateQueries({ queryKey: ['employees-admin'] })}
                variant="secondary"
                size="sm"
              >
                <RefreshCw className="w-3 h-3" /> Sincronizar
              </ActionButton>
              <ActionButton
                onClick={openNewEmployee}
                variant="primary"
                size="sm"
                disabled={!canManageEmployees}
              >
                <PlusCircle className="w-3 h-3" /> Nuevo empleado
              </ActionButton>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <TopMetric label="Empleado" value={selectedEmployee?.fullName || 'Sin selección'} />
            <TopMetric label="Sueldo" value={formatCurrency(selectedEmployee?.weeklySalary ?? 0)} />
            <TopMetric label="Pendiente" value={formatCurrency(selectedEmployee?.pendingBalance ?? 0)} />
            <TopMetric label="Movimientos" value={ledger.length.toString().padStart(2, '0')} />
          </div>

          <div className="admin-panel overflow-hidden flex flex-col min-h-0 flex-1">
            <div className="overflow-x-auto flex-1 custom-scrollbar">
              {isLoadingEmployees ? (
                <div className="p-8 flex justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <table className="admin-table table-auto">
                  <colgroup>
                    <col />
                    <col style={{ width: '1%' }} />
                    <col style={{ width: '1%' }} />
                    <col style={{ width: '1%' }} />
                  </colgroup>
                  <thead className="bg-surface-container-lowest sticky top-0 z-10">
                    <tr>
                      <th className="px-2 py-1.5 text-[7px] font-bold uppercase tracking-widest text-outline font-headline">Empleado</th>
                      <th className="px-2 py-1.5 text-[7px] font-bold uppercase tracking-widest text-outline font-headline">Sueldo</th>
                      <th className="px-2 py-1.5 text-[7px] font-bold uppercase tracking-widest text-outline font-headline">Pendiente</th>
                      <th className="px-2 py-1.5 text-[7px] font-bold uppercase tracking-widest text-outline font-headline">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/5">
                    {employees.map((employee) => {
                      const isSelected = employee.id === selectedEmployeeId;
                      return (
                        <tr
                          key={employee.id}
                          onClick={() => setSelectedEmployeeId(employee.id)}
                          className={cn('cursor-pointer group', isSelected && 'bg-primary/8')}
                        >
                          <td>
                            <div className="flex items-center gap-3">
                              <div className={cn('flex h-11 w-11 items-center justify-center rounded-full border bg-white/[0.04]', isSelected ? 'border-primary/25 text-primary' : 'border-white/10 text-outline')}>
                                <UserRound className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="font-bold text-[13px] text-on-surface uppercase">{employee.fullName}</div>
                                <div className="text-[11px] text-outline uppercase font-medium">Clave {employee.employeeCode} · ID: {employee.id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap text-[13px] font-black text-on-surface">
                            {formatCurrency(employee.weeklySalary)}
                          </td>
                          <td className="whitespace-nowrap text-[13px] font-black text-primary">
                            {formatCurrency(employee.pendingBalance ?? 0)}
                          </td>
                          <td className="whitespace-nowrap">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1 min-w-0">
                                <span className={cn('h-2 w-2 rounded-full shrink-0', employee.isActive ? 'bg-primary shadow-[0_0_8px_rgba(255,215,0,0.6)]' : 'bg-outline/20')} />
                                <span className={cn('text-[11px] font-bold uppercase text-on-surface truncate', !employee.isActive && 'opacity-40')}>
                                  {employee.isActive ? 'Activo' : 'Inactivo'}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedEmployeeId(employee.id);
                                  setEditingEmployee(employee);
                                  setEmployeeForm({
                                    fullName: employee.fullName,
                                    employeeCode: employee.employeeCode,
                                    weeklySalary: String(employee.weeklySalary),
                                    isActive: employee.isActive,
                                    notes: employee.notes ?? '',
                                  });
                                  setIsEmployeeModalOpen(true);
                                }}
                                disabled={!canManageEmployees}
                                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-outline transition-colors hover:border-primary/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 shrink-0"
                                aria-label={`Editar ${employee.fullName}`}
                              >
                                <PencilLine className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <aside className="col-span-2 flex flex-col gap-1.5 overflow-hidden">
          <div className="admin-panel flex flex-col h-full relative overflow-hidden">
            <div className="admin-section-header">
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary font-headline">Expediente</span>
                <span className="admin-chip">
                  ID: #{employeeDetail?.id || '---'}
                </span>
              </div>
              <h2 className="font-headline font-black text-[20px] text-on-surface uppercase tracking-tight leading-none">
                {employeeDetail?.fullName || 'Seleccione empleado'}
              </h2>
              <p className="text-outline text-[11px] font-semibold uppercase flex items-center gap-1 mt-2">
                <ReceiptText className="w-2.5 h-2.5" />
                {employeeDetail?.isActive ? 'Operativo' : 'Inactivo'}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {isLoadingEmployeeDetail ? (
                <div className="p-8 flex justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : employeeDetail ? (
                <>
                  <div className="admin-card-muted p-3 space-y-3">
                    <InfoLine label="Clave checador" value={employeeDetail.employeeCode} />
                    <InfoLine label="Sueldo semanal" value={formatCurrency(employeeDetail.weeklySalary)} />
                    <InfoLine label="Saldo pendiente" value={formatCurrency(employeeDetail.pendingBalance ?? 0)} />
                    <InfoLine label="Notas" value={employeeDetail.notes || 'Sin notas'} multiline />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <ActionBox
                      label="Adelanto"
                      onClick={() => {
                        setMovementType('advance');
                        setMovementDescription('Adelanto de sueldo');
                      }}
                      disabled={!canAssignAdvance}
                    />
                    <ActionBox
                      label="Deuda"
                      onClick={() => {
                        setMovementType('debt');
                        setMovementDescription('Deuda manual');
                      }}
                      disabled={!canManageEmployees}
                    />
                    <ActionBox
                      label="Consumo"
                      onClick={() => {
                        setMovementType('consumption');
                        setMovementDescription('Consumo interno');
                      }}
                      disabled={!canManageEmployees}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-[10px] font-black text-outline uppercase tracking-[0.18em] mb-1 font-headline">
                      Historial reciente
                    </h3>
                    {isLoadingLedger ? (
                      <div className="p-6 flex justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    ) : ledger.length === 0 ? (
                      <div className="admin-card-muted p-4 text-center">
                        <p className="text-[11px] uppercase font-black text-outline tracking-widest">
                          Sin movimientos
                        </p>
                      </div>
                    ) : (
                      ledger.slice(0, 8).map((entry) => (
                        <div key={entry.id} className="admin-card-muted p-3">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <p className="text-[11px] font-black uppercase text-on-surface">
                                {entry.type.replaceAll('_', ' ')}
                              </p>
                              <p className="text-[10px] uppercase font-bold text-outline tracking-widest">
                                {entry.entryDate.slice(0, 10)}
                              </p>
                            </div>
                            <span className="text-[10px] font-black text-primary">
                              {formatCurrency(entry.amount)}
                            </span>
                          </div>
                          <p className="mt-2 text-[10px] text-on-surface-variant uppercase line-clamp-2">{entry.description}</p>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <div className="h-60 flex flex-col items-center justify-center opacity-20 text-center p-8">
                  <UserRound className="w-12 h-12 mb-4" />
                  <p className="text-[9px] uppercase font-black font-headline tracking-widest">
                    Seleccione un miembro del equipo para gestionar su expediente.
                  </p>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {isEmployeeModalOpen && (
        <ModalShell
          title={editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}
          description="Actualiza el expediente operativo del empleado."
          onClose={() => {
            setIsEmployeeModalOpen(false);
            setEditingEmployee(null);
            setEmployeeForm(emptyForm);
          }}
        >
          <div className="space-y-4">
            <FormField label="Nombre completo">
              <input
                value={employeeForm.fullName}
                onChange={(event) => setEmployeeForm((current) => ({ ...current, fullName: event.target.value }))}
                className={employeeFieldClassName}
              />
            </FormField>
            <FormField label="Clave checador">
              <div className="flex gap-2">
                <input
                  maxLength={4}
                  inputMode="numeric"
                  value={employeeForm.employeeCode}
                  onChange={(event) =>
                    setEmployeeForm((current) => ({
                      ...current,
                      employeeCode: event.target.value.replace(/\D/g, '').slice(0, 4),
                    }))
                  }
                  className={employeeFieldClassName}
                  placeholder="0000"
                />
                <ActionButton
                  variant="secondary"
                  size="md"
                  onClick={() =>
                    setEmployeeForm((current) => ({
                      ...current,
                      employeeCode: generateEmployeeCode(),
                    }))
                  }
                >
                  Generar
                </ActionButton>
              </div>
            </FormField>
            <FormField label="Sueldo semanal">
              <input
                type="number"
                value={employeeForm.weeklySalary}
                onChange={(event) => setEmployeeForm((current) => ({ ...current, weeklySalary: event.target.value }))}
                className={employeeFieldClassName}
              />
            </FormField>
            <FormField label="Notas">
              <textarea
                rows={4}
                value={employeeForm.notes}
                onChange={(event) => setEmployeeForm((current) => ({ ...current, notes: event.target.value }))}
                className={`${employeeFieldClassName} resize-none`}
              />
            </FormField>
            <div className="admin-toggle-surface">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-on-surface">Empleado activo</p>
                <p className="mt-1 text-[11px] font-medium text-on-surface-variant">Define si aparece operativo en el sistema.</p>
              </div>
              <Switch
                checked={employeeForm.isActive}
                onChange={(checked) => setEmployeeForm((current) => ({ ...current, isActive: checked }))}
                ariaLabel="Empleado activo"
              />
            </div>
            <ActionButton
              onClick={() => saveEmployeeMutation.mutate()}
              disabled={
                !canManageEmployees ||
                saveEmployeeMutation.isPending ||
                !employeeForm.fullName ||
                !employeeForm.weeklySalary ||
                employeeForm.employeeCode.length !== 4
              }
              variant="primary"
              size="md"
              fullWidth
            >
              {saveEmployeeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <PlusCircle className="w-3 h-3" />}
              Guardar expediente
            </ActionButton>
          </div>
        </ModalShell>
      )}

      {movementType && (
        <ModalShell
          title={movementType === 'advance' ? 'Registrar Adelanto' : movementType === 'debt' ? 'Registrar Deuda' : 'Registrar Consumo'}
          description="Captura el movimiento para aplicarlo al expediente."
          onClose={() => {
            setMovementType(null);
            setMovementAmount('');
            setMovementDescription('');
          }}
        >
          <div className="space-y-4">
            <FormField label="Descripción">
              <input
                value={movementDescription}
                onChange={(event) => setMovementDescription(event.target.value)}
                className={employeeFieldClassName}
              />
            </FormField>
            <FormField label="Monto">
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={movementAmount}
                onChange={(event) => setMovementAmount(event.target.value)}
                className={employeeFieldClassName}
              />
            </FormField>
            <ActionButton
              onClick={() => movementMutation.mutate()}
              disabled={
                movementMutation.isPending ||
                !movementAmount ||
                Number(movementAmount) <= 0 ||
                (movementType === 'advance' ? !canAssignAdvance : !canManageEmployees)
              }
              variant="primary"
              size="md"
              fullWidth
            >
              {movementMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ReceiptText className="w-3 h-3" />}
              Confirmar movimiento
            </ActionButton>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function TopMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-metric min-w-0">
      <span className="admin-metric-label block">{label}</span>
      <span className="admin-metric-value truncate uppercase">{value}</span>
    </div>
  );
}

function InfoLine({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className={cn('border-b border-white/8 pb-2 last:border-b-0 last:pb-0', multiline && 'items-start')}>
      <span className="block text-[10px] font-bold text-outline uppercase tracking-widest">{label}</span>
      <span className="mt-1 block text-[11px] font-black text-on-surface uppercase">{value}</span>
    </div>
  );
}

function ActionBox({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <ActionButton
      onClick={onClick}
      variant="outline"
      size="sm"
      fullWidth
      className="justify-center"
      disabled={disabled}
    >
      {label}
    </ActionButton>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="admin-label">{label}</label>
      {children}
    </div>
  );
}
