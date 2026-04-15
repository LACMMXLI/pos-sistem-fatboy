import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarRange, Loader2, ReceiptText, RefreshCw, ScrollText, UserRound, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import ActionButton from '../../components/ui/ActionButton';
import { cn, formatCurrency } from '../../lib/utils';
import { getEmployees, getPayrollById, getPayrolls, markPayrollPaid } from '../../services/api';

type EmployeeRecord = {
  id: number;
  fullName: string;
  employeeCode: string;
  weeklySalary: number;
  isActive: boolean;
};

type PayrollRecord = {
  id: number;
  periodStart: string;
  periodEnd: string;
  totalDeductions: number;
  totalOvertimePay: number;
  netPay: number;
  status: string;
  employee: {
    id: number;
    fullName: string;
  };
};

type PayrollDetail = PayrollRecord & {
  weeklySalarySnapshot?: number;
  totalHoursWorked?: number;
  totalRegularHours?: number;
  totalOvertimeHours?: number;
  attendanceRecords: Array<{
    id: number;
    workDate: string;
    hoursWorked: number;
    overtimeHours: number;
    overtimePay: number;
  }>;
  ledgerEntries: Array<{
    id: number;
    type: string;
    amount: number;
    description: string;
    entryDate: string;
  }>;
};

export function EmployeePayrollHistoryScreen() {
  const queryClient = useQueryClient();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedPayrollId, setSelectedPayrollId] = useState<number | null>(null);

  const { data: employees = [], isLoading: isLoadingEmployees } = useQuery<EmployeeRecord[]>({
    queryKey: ['employees-payroll-history-list'],
    queryFn: getEmployees,
  });

  useEffect(() => {
    if (!selectedEmployeeId && employees.length > 0) {
      setSelectedEmployeeId(employees[0].id);
    }
  }, [employees, selectedEmployeeId]);

  const { data: payrolls = [], isLoading: isLoadingPayrolls } = useQuery<PayrollRecord[]>({
    queryKey: ['employee-payroll-history', selectedEmployeeId],
    queryFn: () => getPayrolls({ employeeId: selectedEmployeeId! }),
    enabled: !!selectedEmployeeId,
  });

  useEffect(() => {
    if (payrolls.length === 0) {
      setSelectedPayrollId(null);
      return;
    }

    const payrollStillExists = payrolls.some((payroll) => payroll.id === selectedPayrollId);
    if (!payrollStillExists) {
      setSelectedPayrollId(payrolls[0].id);
    }
  }, [payrolls, selectedPayrollId]);

  const { data: payrollDetail, isLoading: isLoadingPayrollDetail } = useQuery<PayrollDetail>({
    queryKey: ['employee-payroll-history-detail', selectedPayrollId],
    queryFn: () => getPayrollById(selectedPayrollId!),
    enabled: !!selectedPayrollId,
  });

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedEmployeeId),
    [employees, selectedEmployeeId],
  );

  const payrollSummary = useMemo(() => {
    const generated = payrolls.filter((payroll) => payroll.status === 'GENERATED').length;
    const paid = payrolls.filter((payroll) => payroll.status === 'PAID').length;
    const totalNet = payrolls.reduce((sum, payroll) => sum + Number(payroll.netPay ?? 0), 0);
    return { generated, paid, totalNet };
  }, [payrolls]);

  const markPaidMutation = useMutation({
    mutationFn: (payrollId: number) => markPayrollPaid(payrollId),
    onSuccess: () => {
      toast.success('Nómina marcada como pagada');
      if (selectedEmployeeId) {
        queryClient.invalidateQueries({ queryKey: ['employee-payroll-history', selectedEmployeeId] });
      }
      if (selectedPayrollId) {
        queryClient.invalidateQueries({ queryKey: ['employee-payroll-history-detail', selectedPayrollId] });
      }
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'No se pudo marcar la nómina como pagada');
    },
  });

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
                Historial por empleado
              </p>
            </div>
            <ActionButton
              onClick={() => queryClient.invalidateQueries({ queryKey: ['employees-payroll-history-list'] })}
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
            <div className="col-span-12 flex flex-col gap-2 overflow-hidden xl:col-span-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[8px] font-bold uppercase tracking-widest text-outline">
                    Historial de nóminas
                  </div>
                  <h2 className="text-[13px] font-black uppercase tracking-tight text-on-surface font-headline">
                    {selectedEmployee?.fullName || 'Seleccione empleado'}
                  </h2>
                </div>
                <ActionButton
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ['employees-payroll-history-list'] });
                    if (selectedEmployeeId) {
                      queryClient.invalidateQueries({ queryKey: ['employee-payroll-history', selectedEmployeeId] });
                    }
                  }}
                  variant="secondary"
                  size="sm"
                >
                  <RefreshCw className="w-3 h-3" /> Sincronizar
                </ActionButton>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <PayrollMetric label="Nóminas" value={payrolls.length.toString().padStart(2, '0')} />
                <PayrollMetric label="Pendientes" value={payrollSummary.generated.toString().padStart(2, '0')} />
                <PayrollMetric label="Pagadas" value={payrollSummary.paid.toString().padStart(2, '0')} />
              </div>

              <div className="min-h-0 flex-1 overflow-hidden border border-outline-variant/10 bg-surface-container-low shadow-xl">
                <div className="h-full overflow-y-auto custom-scrollbar">
                  {isLoadingPayrolls ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : payrolls.length === 0 ? (
                    <EmptyPayrollPanel message="Este empleado todavía no tiene nóminas generadas." />
                  ) : (
                    <div className="divide-y divide-outline-variant/5">
                      {payrolls.map((payroll) => {
                        const isSelected = payroll.id === selectedPayrollId;
                        return (
                          <button
                            key={payroll.id}
                            type="button"
                            onClick={() => setSelectedPayrollId(payroll.id)}
                            className={cn(
                              'w-full border-l-4 p-3 text-left transition-colors',
                              isSelected
                                ? 'border-primary bg-primary/10'
                                : 'border-transparent bg-surface-container-high/40 hover:bg-surface-container-high',
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-[10px] font-black uppercase text-on-surface">
                                  Nómina #{payroll.id}
                                </div>
                                <div className="mt-1 flex items-center gap-1 text-[7px] font-bold uppercase tracking-widest text-outline">
                                  <CalendarRange className="w-3 h-3" />
                                  <span>{payroll.periodStart.slice(0, 10)} / {payroll.periodEnd.slice(0, 10)}</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-[10px] font-black uppercase text-primary">
                                  {formatCurrency(payroll.netPay)}
                                </div>
                                <HistoryStatus status={payroll.status} />
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="col-span-12 flex flex-col gap-2 overflow-hidden xl:col-span-7">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <PayrollMetric label="Sueldo base" value={formatCurrency(payrollDetail?.weeklySalarySnapshot ?? selectedEmployee?.weeklySalary ?? 0)} />
                <PayrollMetric label="Extra" value={formatCurrency(payrollDetail?.totalOvertimePay ?? 0)} />
                <PayrollMetric label="Descuentos" value={formatCurrency(payrollDetail?.totalDeductions ?? 0)} />
                <PayrollMetric label="Total neto" value={formatCurrency(payrollDetail?.netPay ?? payrollSummary.totalNet)} />
              </div>

              <div className="min-h-0 flex-1 overflow-hidden border border-outline-variant/10 bg-surface-container-low shadow-xl">
                <div className="border-b border-outline-variant/10 bg-surface-container-lowest px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[7px] font-black uppercase tracking-[0.18em] text-primary font-headline">
                        Visualización de nómina
                      </div>
                      <h3 className="text-[12px] font-black uppercase tracking-tight text-on-surface">
                        {selectedPayrollId ? `Nómina #${selectedPayrollId}` : 'Seleccione una nómina'}
                      </h3>
                      {payrollDetail ? (
                        <p className="mt-1 text-[7px] font-bold uppercase tracking-widest text-outline">
                          Periodo {payrollDetail.periodStart.slice(0, 10)} al {payrollDetail.periodEnd.slice(0, 10)}
                        </p>
                      ) : null}
                    </div>
                    {payrollDetail?.status !== 'PAID' ? (
                      <ActionButton
                        onClick={() => markPaidMutation.mutate(payrollDetail.id)}
                        disabled={markPaidMutation.isPending}
                        variant="secondary"
                        size="sm"
                      >
                        {markPaidMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <WalletCards className="w-3 h-3" />}
                        Marcar pagada
                      </ActionButton>
                    ) : null}
                  </div>
                </div>

                <div className="h-full overflow-y-auto p-3 custom-scrollbar">
                  {isLoadingPayrollDetail ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : !payrollDetail ? (
                    <EmptyPayrollPanel message="Selecciona una nómina para ver su desglose." />
                  ) : (
                    <div className="space-y-3">
                      <div className="grid gap-2 md:grid-cols-2">
                        <VisualLine label="Empleado" value={payrollDetail.employee.fullName} />
                        <VisualLine label="Estatus" value={payrollDetail.status} />
                        <VisualLine label="Horas trabajadas" value={String(payrollDetail.totalHoursWorked ?? 0)} />
                        <VisualLine label="Horas extra" value={String(payrollDetail.totalOvertimeHours ?? 0)} />
                      </div>

                      <div className="grid gap-2 md:grid-cols-2">
                        <VisualBox
                          title="Descuentos incluidos"
                          icon={<ReceiptText className="w-3.5 h-3.5" />}
                          emptyMessage="Sin descuentos aplicados."
                          items={payrollDetail.ledgerEntries.map((entry) => ({
                            id: entry.id,
                            title: entry.description || entry.type.replaceAll('_', ' '),
                            date: entry.entryDate.slice(0, 10),
                            amount: formatCurrency(entry.amount),
                          }))}
                        />
                        <VisualBox
                          title="Asistencias consideradas"
                          icon={<ScrollText className="w-3.5 h-3.5" />}
                          emptyMessage="Sin asistencias en esta nómina."
                          items={payrollDetail.attendanceRecords.map((record) => ({
                            id: record.id,
                            title: `Jornada ${record.hoursWorked} hrs`,
                            date: record.workDate.slice(0, 10),
                            amount: formatCurrency(record.overtimePay ?? 0),
                          }))}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function PayrollMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-l-4 border-primary bg-surface-container-low px-2 py-1.5 shadow-sm">
      <span className="mb-0.5 block text-[6px] font-bold uppercase tracking-widest text-outline">{label}</span>
      <span className="block truncate text-[11px] font-black uppercase text-on-surface font-headline">{value}</span>
    </div>
  );
}

function HistoryStatus({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'mt-1 inline-flex border px-1 py-0.5 text-[7px] font-black uppercase tracking-widest',
        status === 'PAID'
          ? 'border-primary/20 bg-primary/10 text-primary'
          : 'border-tertiary/20 bg-tertiary/10 text-tertiary',
      )}
    >
      {status === 'PAID' ? 'PAGADA' : status}
    </span>
  );
}

function VisualLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-outline-variant/10 bg-surface-container-high px-2 py-1.5">
      <div className="text-[7px] font-bold uppercase tracking-widest text-outline">{label}</div>
      <div className="mt-1 text-[9px] font-black uppercase text-on-surface">{value}</div>
    </div>
  );
}

function VisualBox({
  title,
  icon,
  emptyMessage,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  emptyMessage: string;
  items: Array<{
    id: number;
    title: string;
    date: string;
    amount: string;
  }>;
}) {
  return (
    <div className="overflow-hidden border border-outline-variant/10 bg-surface-container-high">
      <div className="flex items-center gap-2 border-b border-outline-variant/10 bg-surface-container-lowest px-2 py-1.5 text-[7px] font-black uppercase tracking-[0.18em] text-primary font-headline">
        {icon}
        <span>{title}</span>
      </div>
      <div className="space-y-1.5 p-2">
        {items.length === 0 ? (
          <p className="text-[8px] font-bold uppercase tracking-widest text-outline">{emptyMessage}</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="border border-outline-variant/10 bg-surface-container-lowest px-2 py-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[8px] font-black uppercase text-on-surface">{item.title}</div>
                  <div className="text-[7px] font-bold uppercase tracking-widest text-outline">{item.date}</div>
                </div>
                <div className="text-[8px] font-black uppercase text-primary">{item.amount}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function EmptyPayrollPanel({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center p-8 text-center">
      <WalletCards className="mb-3 h-10 w-10 text-outline/40" />
      <p className="text-[9px] font-black uppercase tracking-widest text-outline">{message}</p>
    </div>
  );
}
