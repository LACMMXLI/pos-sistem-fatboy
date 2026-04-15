import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, HandCoins, Loader2, RefreshCw, UserRound } from 'lucide-react';
import ActionButton from '../../components/ui/ActionButton';
import { cn, formatCurrency } from '../../lib/utils';
import { getEmployeeLedger, getEmployees } from '../../services/api';

type EmployeeRecord = {
  id: number;
  fullName: string;
  employeeCode: string;
  weeklySalary: number;
  pendingBalance?: number;
  isActive: boolean;
};

type LedgerEntry = {
  id: number;
  type: string;
  amount: number | string;
  description: string;
  entryDate: string;
  status: string;
  createdBy?: {
    id: number;
    name: string;
  };
  payroll?: {
    id: number;
    periodStart: string;
    periodEnd: string;
    status: string;
  } | null;
};

export function EmployeeAdvancesHistoryScreen() {
  const queryClient = useQueryClient();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);

  const { data: employees = [], isLoading: isLoadingEmployees } = useQuery<EmployeeRecord[]>({
    queryKey: ['employees-advance-history'],
    queryFn: getEmployees,
  });

  useEffect(() => {
    if (!selectedEmployeeId && employees.length > 0) {
      setSelectedEmployeeId(employees[0].id);
    }
  }, [employees, selectedEmployeeId]);

  const { data: advances = [], isLoading: isLoadingAdvances } = useQuery<LedgerEntry[]>({
    queryKey: ['employee-advance-history', selectedEmployeeId],
    queryFn: () => getEmployeeLedger(selectedEmployeeId!, { type: 'SALARY_ADVANCE' }),
    enabled: !!selectedEmployeeId,
  });

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedEmployeeId),
    [employees, selectedEmployeeId],
  );

  const totals = useMemo(() => {
    const totalAmount = advances.reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);
    const pending = advances.filter((entry) => entry.status === 'PENDING').length;
    const settled = advances.filter((entry) => entry.status === 'SETTLED').length;
    return { totalAmount, pending, settled };
  }, [advances]);

  return (
    <div className="h-full p-2">
      <div className="mx-auto flex h-full max-w-[1600px] gap-2 overflow-hidden">
        <aside className="w-[260px] shrink-0 overflow-hidden border border-outline-variant/10 bg-surface-container-low shadow-xl">
          <div className="flex items-center justify-between border-b border-outline-variant/10 bg-surface-container-lowest px-2 py-1.5">
            <div>
              <div className="text-[7px] font-black uppercase tracking-[0.18em] text-primary font-headline">
                Empleados
              </div>
              <p className="text-[7px] font-bold uppercase tracking-widest text-outline">
                Selección rápida
              </p>
            </div>
            <ActionButton
              onClick={() => queryClient.invalidateQueries({ queryKey: ['employees-advance-history'] })}
              variant="secondary"
              size="sm"
            >
              <RefreshCw className="w-3 h-3" />
            </ActionButton>
          </div>

          <div className="h-full overflow-y-auto p-1.5 custom-scrollbar">
            {isLoadingEmployees ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-1">
                {employees.map((employee) => {
                  const isSelected = employee.id === selectedEmployeeId;
                  return (
                    <button
                      key={employee.id}
                      type="button"
                      onClick={() => setSelectedEmployeeId(employee.id)}
                      className={cn(
                        'w-full border px-2 py-1.5 text-left transition-colors',
                        isSelected
                          ? 'border-primary/30 bg-primary/10 text-on-surface'
                          : 'border-outline-variant/10 bg-surface-container-high text-on-surface hover:bg-surface-container-highest',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            'flex h-7 w-7 shrink-0 items-center justify-center border',
                            isSelected ? 'border-primary/20 text-primary' : 'border-outline-variant/10 text-outline',
                          )}
                        >
                          <UserRound className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[9px] font-black uppercase">{employee.fullName}</div>
                          <div className="truncate text-[7px] font-bold uppercase tracking-widest text-outline">
                            Clave {employee.employeeCode}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <section className="min-w-0 flex-1 overflow-hidden">
          <div className="grid h-full grid-cols-12 gap-2">
            <div className="col-span-12 flex flex-col gap-2 overflow-hidden xl:col-span-8">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[8px] font-bold uppercase tracking-widest text-outline">
                    Historial de adelantos
                  </div>
                  <h2 className="text-[13px] font-black uppercase tracking-tight text-on-surface font-headline">
                    {selectedEmployee?.fullName || 'Seleccione empleado'}
                  </h2>
                </div>
                <ActionButton
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ['employees-advance-history'] });
                    if (selectedEmployeeId) {
                      queryClient.invalidateQueries({ queryKey: ['employee-advance-history', selectedEmployeeId] });
                    }
                  }}
                  variant="secondary"
                  size="sm"
                >
                  <RefreshCw className="w-3 h-3" /> Sincronizar
                </ActionButton>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <HistoryMetric label="Total adelantos" value={formatCurrency(totals.totalAmount)} />
                <HistoryMetric label="Pendientes" value={totals.pending.toString().padStart(2, '0')} />
                <HistoryMetric label="Liquidados" value={totals.settled.toString().padStart(2, '0')} />
              </div>

              <div className="min-h-0 flex-1 overflow-hidden border border-outline-variant/10 bg-surface-container-low shadow-xl">
                <div className="h-full overflow-y-auto custom-scrollbar">
                  {isLoadingAdvances ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : advances.length === 0 ? (
                    <EmptyPanel message="Este empleado no tiene adelantos registrados." />
                  ) : (
                    <div className="divide-y divide-outline-variant/5">
                      {advances.map((entry) => (
                        <article key={entry.id} className="bg-surface-container-high/40 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-primary/20 bg-primary/10 text-primary">
                                  <HandCoins className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <h3 className="truncate text-[10px] font-black uppercase text-on-surface">
                                    {entry.description || 'Adelanto de sueldo'}
                                  </h3>
                                  <p className="text-[7px] font-bold uppercase tracking-widest text-outline">
                                    Movimiento #{entry.id}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[11px] font-black uppercase text-primary">
                                {formatCurrency(entry.amount)}
                              </div>
                              <StatusPill status={entry.status} />
                            </div>
                          </div>

                          <div className="mt-3 grid gap-2 md:grid-cols-3">
                            <DetailCard
                              icon={<CalendarClock className="w-3 h-3" />}
                              label="Fecha"
                              value={entry.entryDate.slice(0, 10)}
                            />
                            <DetailCard label="Registró" value={entry.createdBy?.name || 'Sistema'} />
                            <DetailCard
                              label="Nómina"
                              value={entry.payroll ? `#${entry.payroll.id}` : 'Pendiente'}
                            />
                          </div>

                          {entry.payroll ? (
                            <div className="mt-2 border border-outline-variant/10 bg-surface-container-lowest px-2 py-1.5">
                              <p className="text-[7px] font-bold uppercase tracking-widest text-outline">
                                Aplicado en nómina #{entry.payroll.id} del {entry.payroll.periodStart.slice(0, 10)} al {entry.payroll.periodEnd.slice(0, 10)}
                              </p>
                            </div>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <aside className="col-span-12 flex flex-col gap-2 overflow-hidden xl:col-span-4">
              <div className="overflow-hidden border border-outline-variant/10 bg-surface-container-low shadow-xl">
                <div className="border-b border-outline-variant/10 bg-surface-container-lowest px-2 py-1.5">
                  <div className="text-[7px] font-black uppercase tracking-[0.18em] text-primary font-headline">
                    Resumen
                  </div>
                  <p className="text-[7px] font-bold uppercase tracking-widest text-outline">
                    Adelantos del empleado
                  </p>
                </div>
                <div className="space-y-2 p-2">
                  <SummaryLine label="Empleado" value={selectedEmployee?.fullName || 'Sin selección'} />
                  <SummaryLine label="Clave" value={selectedEmployee?.employeeCode || '---'} />
                  <SummaryLine label="Sueldo" value={formatCurrency(selectedEmployee?.weeklySalary ?? 0)} />
                  <SummaryLine label="Saldo pendiente" value={formatCurrency(selectedEmployee?.pendingBalance ?? 0)} />
                  <SummaryLine label="Movimientos" value={advances.length.toString().padStart(2, '0')} />
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </div>
  );
}

function HistoryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-l-4 border-primary bg-surface-container-low px-2 py-1.5 shadow-sm">
      <span className="mb-0.5 block text-[6px] font-bold uppercase tracking-widest text-outline">{label}</span>
      <span className="block truncate text-[11px] font-black uppercase text-on-surface font-headline">{value}</span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const normalizedStatus = status?.toUpperCase();
  return (
    <span
      className={cn(
        'mt-1 inline-flex border px-1 py-0.5 text-[7px] font-black uppercase tracking-widest',
        normalizedStatus === 'SETTLED'
          ? 'border-primary/20 bg-primary/10 text-primary'
          : 'border-tertiary/20 bg-tertiary/10 text-tertiary',
      )}
    >
      {normalizedStatus === 'SETTLED' ? 'LIQUIDADO' : normalizedStatus}
    </span>
  );
}

function DetailCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="border border-outline-variant/10 bg-surface-container-lowest px-2 py-1.5">
      <div className="flex items-center gap-1 text-[7px] font-bold uppercase tracking-widest text-outline">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-[8px] font-black uppercase text-on-surface">{value}</div>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-outline-variant/10 pb-1 last:border-b-0 last:pb-0">
      <span className="text-[7px] font-bold uppercase tracking-widest text-outline">{label}</span>
      <span className="text-right text-[8px] font-black uppercase text-on-surface">{value}</span>
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center p-8 text-center">
      <HandCoins className="mb-3 h-10 w-10 text-outline/40" />
      <p className="text-[9px] font-black uppercase tracking-widest text-outline">{message}</p>
    </div>
  );
}
