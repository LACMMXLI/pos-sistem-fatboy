import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  Clock3,
  KeyRound,
  Loader2,
  RefreshCw,
  Search,
  TimerReset,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import ActionButton from '../../components/ui/ActionButton';
import { cn, formatCurrency } from '../../lib/utils';
import {
  createEmployeeAttendance,
  getEmployeeAttendance,
  getEmployees,
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

type AttendanceRecord = {
  id: number;
  workDate: string;
  hoursWorked: number | string;
  regularHours: number | string;
  overtimeHours: number | string;
  overtimePay: number | string;
  notes?: string | null;
  payrollId?: number | null;
};

const todayIso = new Date().toISOString().slice(0, 10);

const checkerFieldClassName =
  'admin-input uppercase';

export function EmployeeCheckerScreen() {
  const queryClient = useQueryClient();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [employeeCodeInput, setEmployeeCodeInput] = useState('');
  const [workDate, setWorkDate] = useState(todayIso);
  const [hoursWorked, setHoursWorked] = useState('10');
  const [overtimeRate, setOvertimeRate] = useState('100');
  const [notes, setNotes] = useState('');

  const { data: employees = [], isLoading: isLoadingEmployees } = useQuery<EmployeeRecord[]>({
    queryKey: ['employees-checker'],
    queryFn: getEmployees,
  });

  useEffect(() => {
    if (!selectedEmployeeId && employees.length > 0) {
      setSelectedEmployeeId(employees[0].id);
    }
  }, [employees, selectedEmployeeId]);

  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId);

  const selectEmployeeByCode = () => {
    const normalizedCode = employeeCodeInput.trim();
    const matchedEmployee = employees.find(
      (employee) => employee.employeeCode === normalizedCode,
    );

    if (!matchedEmployee) {
      toast.error('No existe un empleado con esa clave');
      return;
    }

    setSelectedEmployeeId(matchedEmployee.id);
    toast.success(`Empleado identificado: ${matchedEmployee.fullName}`);
  };

  const { data: attendance = [], isLoading: isLoadingAttendance } = useQuery<AttendanceRecord[]>({
    queryKey: ['employee-attendance', selectedEmployeeId],
    queryFn: () => getEmployeeAttendance(selectedEmployeeId!),
    enabled: !!selectedEmployeeId,
  });

  const attendanceMutation = useMutation({
    mutationFn: () =>
      createEmployeeAttendance(selectedEmployeeId!, {
        workDate,
        hoursWorked: Number(hoursWorked),
        overtimeRate: Number(overtimeRate),
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Asistencia registrada');
      setHoursWorked('10');
      setNotes('');
      queryClient.invalidateQueries({ queryKey: ['employee-attendance', selectedEmployeeId] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'No se pudo registrar la asistencia');
    },
  });

  const summary = useMemo(
    () =>
      attendance.reduce(
        (acc, item) => {
          acc.totalHours += Number(item.hoursWorked ?? 0);
          acc.totalRegular += Number(item.regularHours ?? 0);
          acc.totalOvertime += Number(item.overtimeHours ?? 0);
          acc.totalOvertimePay += Number(item.overtimePay ?? 0);
          return acc;
        },
        { totalHours: 0, totalRegular: 0, totalOvertime: 0, totalOvertimePay: 0 },
      ),
    [attendance],
  );

  const submitAttendance = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedEmployeeId) {
      toast.error('Selecciona un empleado');
      return;
    }
    attendanceMutation.mutate();
  };

  return (
    <div className="admin-shell h-full p-4">
      <div className="mx-auto grid h-full max-w-[1600px] grid-cols-12 gap-4 overflow-hidden">
        <div className="col-span-9 flex flex-col gap-2 overflow-hidden">
          <div className="flex items-end justify-between gap-4 px-1">
            <div>
              <p className="admin-eyebrow">Checador administrativo</p>
              <h1 className="admin-title">Jornadas y horas extra</h1>
              <p className="admin-subtitle">Captura y consulta de asistencia con lectura más clara y mejor espacio útil.</p>
            </div>
            <ActionButton
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['employees-checker'] });
                if (selectedEmployeeId) {
                  queryClient.invalidateQueries({ queryKey: ['employee-attendance', selectedEmployeeId] });
                }
              }}
              variant="secondary"
              size="sm"
            >
              <RefreshCw className="w-3 h-3" /> Sincronizar
            </ActionButton>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <CheckerMetric label="Empleado" value={selectedEmployee?.fullName || 'Sin selección'} />
            <CheckerMetric label="Horas" value={summary.totalHours.toFixed(1)} />
            <CheckerMetric label="Extra" value={summary.totalOvertime.toFixed(1)} />
            <CheckerMetric label="Pago extra" value={formatCurrency(summary.totalOvertimePay)} />
          </div>

          <div className="admin-panel overflow-hidden flex flex-col min-h-0 flex-1">
            <div className="overflow-x-auto flex-1 custom-scrollbar">
              {isLoadingEmployees ? (
                <div className="p-8 flex justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <table className="admin-table">
                  <thead className="sticky top-0 z-10">
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
                          onClick={() => {
                            setSelectedEmployeeId(employee.id);
                            setEmployeeCodeInput(employee.employeeCode);
                          }}
                          className={cn('cursor-pointer group', isSelected && 'bg-primary/8')}
                        >
                          <td>
                            <div className="flex items-center gap-3">
                              <div className={cn('flex h-11 w-11 items-center justify-center rounded-full border bg-white/[0.04]', isSelected ? 'border-primary/25 text-primary' : 'border-white/10 text-outline')}>
                                <UserRound className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="text-[13px] font-black uppercase text-on-surface">{employee.fullName}</div>
                                <div className="text-[11px] font-semibold uppercase text-outline">Clave {employee.employeeCode} · ID: {employee.id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="text-[13px] font-black text-on-surface">
                            {formatCurrency(employee.weeklySalary)}
                          </td>
                          <td className="text-[13px] font-black text-primary">
                            {formatCurrency(employee.pendingBalance ?? 0)}
                          </td>
                          <td>
                            <div className="flex items-center gap-1">
                              <span className={cn('h-2 w-2 rounded-full', employee.isActive ? 'bg-primary shadow-[0_0_8px_rgba(255,215,0,0.6)]' : 'bg-outline/20')} />
                              <span className={cn('text-[11px] font-black uppercase text-on-surface', !employee.isActive && 'opacity-40')}>
                                {employee.isActive ? 'Activo' : 'Inactivo'}
                              </span>
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

        <aside className="col-span-3 flex flex-col gap-2 overflow-hidden">
          <div className="admin-panel flex flex-col h-full relative overflow-hidden">
            <div className="admin-section-header">
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary font-headline">Registro de Jornada</span>
                <span className="admin-chip">
                  ID: #{selectedEmployee?.id || '---'}
                </span>
              </div>
              <h2 className="font-headline font-black text-[20px] text-on-surface uppercase tracking-tight leading-none">
                {selectedEmployee?.fullName || 'Seleccione empleado'}
              </h2>
              <p className="text-outline text-[11px] font-semibold uppercase flex items-center gap-1 mt-2">
                <TimerReset className="w-2.5 h-2.5" />
                {selectedEmployee
                  ? `Clave ${selectedEmployee.employeeCode} · Pendiente ${formatCurrency(selectedEmployee.pendingBalance ?? 0)}`
                  : 'Esperando selección'}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              <form onSubmit={submitAttendance} className="space-y-3">
                <CheckerField label="Clave del empleado" icon={<KeyRound className="w-3 h-3" />}>
                  <div className="flex gap-2">
                    <input
                      inputMode="numeric"
                      maxLength={4}
                      value={employeeCodeInput}
                      onChange={(event) =>
                        setEmployeeCodeInput(event.target.value.replace(/\D/g, '').slice(0, 4))
                      }
                      className={checkerFieldClassName}
                      placeholder="0000"
                    />
                    <ActionButton
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={selectEmployeeByCode}
                      disabled={employeeCodeInput.length !== 4 || isLoadingEmployees}
                    >
                      <Search className="w-3 h-3" />
                      Buscar
                    </ActionButton>
                  </div>
                </CheckerField>

                <CheckerField label="Fecha" icon={<CalendarDays className="w-3 h-3" />}>
                  <input
                    type="date"
                    value={workDate}
                    onChange={(event) => setWorkDate(event.target.value)}
                    className={checkerFieldClassName}
                  />
                </CheckerField>

                <div className="grid grid-cols-2 gap-2">
                  <CheckerField label="Horas trabajadas" icon={<Clock3 className="w-3 h-3" />}>
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={hoursWorked}
                      onChange={(event) => setHoursWorked(event.target.value)}
                      className={checkerFieldClassName}
                    />
                  </CheckerField>
                  <CheckerField label="Tarifa extra">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={overtimeRate}
                      onChange={(event) => setOvertimeRate(event.target.value)}
                      className={checkerFieldClassName}
                    />
                  </CheckerField>
                </div>

                <CheckerField label="Notas">
                  <textarea
                    rows={4}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className={`${checkerFieldClassName} resize-none`}
                    placeholder="INCIDENCIAS, APOYO EN CIERRE, ETC."
                  />
                </CheckerField>

                <div className="grid grid-cols-2 gap-2">
                  <SummaryBox label="Regulares" value={`${Math.min(Number(hoursWorked || 0), 10).toFixed(1)} h`} />
                  <SummaryBox label="Extra" value={`${Math.max(Number(hoursWorked || 0) - 10, 0).toFixed(1)} h`} />
                </div>

                <ActionButton
                  type="submit"
                  disabled={!selectedEmployeeId || attendanceMutation.isPending}
                  variant="primary"
                  size="md"
                  fullWidth
                >
                  {attendanceMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock3 className="w-3 h-3" />}
                  Guardar asistencia
                </ActionButton>
              </form>

              <div className="space-y-2">
                <h3 className="text-[10px] font-black text-outline uppercase tracking-[0.18em] mb-1 font-headline">
                  Historial reciente
                </h3>
                {isLoadingAttendance ? (
                  <div className="p-6 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : attendance.length === 0 ? (
                  <div className="admin-card-muted p-4 text-center">
                    <p className="text-[11px] uppercase font-black text-outline tracking-widest">
                      Sin asistencias
                    </p>
                  </div>
                ) : (
                  attendance.slice(0, 8).map((entry) => (
                    <div key={entry.id} className="admin-card-muted p-3">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="text-[11px] font-black uppercase text-on-surface">
                            {entry.workDate.slice(0, 10)}
                          </p>
                          <p className="text-[10px] uppercase font-semibold text-outline tracking-widest">
                            {Number(entry.hoursWorked).toFixed(1)} h trabajadas
                          </p>
                        </div>
                        <span className="text-[10px] font-black text-primary">
                          {Number(entry.overtimeHours).toFixed(1)} h extra
                        </span>
                      </div>
                      <div className="mt-2 flex justify-between text-[10px] font-bold uppercase">
                        <span className="text-outline">Pago extra</span>
                        <span className="text-on-surface">{formatCurrency(entry.overtimePay)}</span>
                      </div>
                      {entry.notes ? (
                        <p className="mt-2 text-[10px] text-on-surface-variant uppercase line-clamp-2">{entry.notes}</p>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function CheckerMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-metric min-w-0">
      <span className="admin-metric-label block">{label}</span>
      <span className="admin-metric-value truncate uppercase">{value}</span>
    </div>
  );
}

function CheckerField({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="admin-label">
        <span className="inline-flex items-center gap-1">
          {icon}
          {label}
        </span>
      </label>
      {children}
    </div>
  );
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-card-muted p-3">
      <span className="block text-[10px] font-bold text-outline uppercase tracking-widest">{label}</span>
      <span className="text-[14px] font-black text-on-surface uppercase">{value}</span>
    </div>
  );
}
