import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarRange, Loader2, RefreshCw, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import ActionButton from '../../components/ui/ActionButton';
import { cn, formatCurrency } from '../../lib/utils';
import {
  closeEmployeePayroll,
  getEmployeePayrollPreview,
  getEmployees,
  getPayrollById,
  getPayrolls,
  markPayrollPaid,
} from '../../services/api';

type EmployeeRecord = {
  id: number;
  fullName: string;
  weeklySalary: number;
};

type PayrollPreview = {
  employee: {
    id: number;
    fullName: string;
    weeklySalary: number;
  };
  totalHoursWorked: number;
  totalOvertimeHours: number;
  totalOvertimePay: number;
  totalDeductions: number;
  netPay: number;
  includedEntries: Array<{
    id: number;
    type: string;
    amount: number;
    description: string;
    entryDate: string;
  }>;
  includedAttendance: Array<{
    id: number;
    workDate: string;
    hoursWorked: number;
    overtimeHours: number;
    overtimePay: number;
  }>;
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
    fullName: string;
  };
};

type PayrollDetail = PayrollRecord & {
  ledgerEntries: Array<{
    id: number;
    type: string;
    amount: number;
    description: string;
    entryDate: string;
  }>;
  attendanceRecords: Array<{
    id: number;
    workDate: string;
    hoursWorked: number;
    overtimeHours: number;
    overtimePay: number;
  }>;
};

function getCurrentPeriod() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
  };
}

const payrollFieldClassName =
  'w-full bg-surface-container-highest border border-outline-variant/20 p-2 text-[10px] font-bold text-on-surface uppercase focus:border-primary outline-none transition-colors rounded-none';

export function PayrollsScreen() {
  const queryClient = useQueryClient();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedPayrollId, setSelectedPayrollId] = useState<number | null>(null);
  const [{ periodStart, periodEnd }, setPeriod] = useState(getCurrentPeriod);

  const { data: employees = [] } = useQuery<EmployeeRecord[]>({
    queryKey: ['employees-payroll'],
    queryFn: getEmployees,
  });

  useEffect(() => {
    if (!selectedEmployeeId && employees.length > 0) {
      setSelectedEmployeeId(employees[0].id);
    }
  }, [employees, selectedEmployeeId]);

  const { data: payrolls = [], isLoading: isLoadingPayrolls } = useQuery<PayrollRecord[]>({
    queryKey: ['payroll-history'],
    queryFn: () => getPayrolls(),
  });

  useEffect(() => {
    if (!selectedPayrollId && payrolls.length > 0) {
      setSelectedPayrollId(payrolls[0].id);
    }
  }, [payrolls, selectedPayrollId]);

  const { data: preview, isLoading: isLoadingPreview, error: previewError } = useQuery<PayrollPreview>({
    queryKey: ['payroll-preview', selectedEmployeeId, periodStart, periodEnd],
    queryFn: () => getEmployeePayrollPreview(selectedEmployeeId!, { periodStart, periodEnd }),
    enabled: !!selectedEmployeeId,
    retry: false,
  });

  const { data: payrollDetail, isLoading: isLoadingDetail } = useQuery<PayrollDetail>({
    queryKey: ['payroll-detail', selectedPayrollId],
    queryFn: () => getPayrollById(selectedPayrollId!),
    enabled: !!selectedPayrollId,
  });

  const closePayrollMutation = useMutation({
    mutationFn: () => closeEmployeePayroll(selectedEmployeeId!, { periodStart, periodEnd }),
    onSuccess: (payroll: PayrollDetail) => {
      toast.success(`Nómina #${payroll.id} cerrada`);
      setSelectedPayrollId(payroll.id);
      queryClient.invalidateQueries({ queryKey: ['payroll-history'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-preview', selectedEmployeeId, periodStart, periodEnd] });
      if (selectedEmployeeId) {
        queryClient.invalidateQueries({ queryKey: ['employee-attendance', selectedEmployeeId] });
        queryClient.invalidateQueries({ queryKey: ['employee-ledger', selectedEmployeeId] });
      }
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'No se pudo cerrar la nómina');
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: (payrollId: number) => markPayrollPaid(payrollId),
    onSuccess: () => {
      toast.success('Nómina marcada como pagada');
      queryClient.invalidateQueries({ queryKey: ['payroll-history'] });
      if (selectedPayrollId) {
        queryClient.invalidateQueries({ queryKey: ['payroll-detail', selectedPayrollId] });
      }
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'No se pudo marcar como pagada');
    },
  });

  const totals = useMemo(() => {
    const generated = payrolls.filter((item) => item.status === 'GENERATED').length;
    const paid = payrolls.filter((item) => item.status === 'PAID').length;
    return { generated, paid };
  }, [payrolls]);

  return (
    <div className="h-full p-2">
      <div className="mx-auto grid h-full max-w-[1600px] grid-cols-12 gap-2 overflow-hidden">
        <div className="col-span-9 flex flex-col gap-2 overflow-hidden">
          <div className="flex justify-between items-center mb-0.5">
            <div className="text-[8px] font-bold uppercase tracking-widest text-outline">
              Previsualización, cierre y pago
            </div>
            <ActionButton
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['payroll-history'] });
                queryClient.invalidateQueries({ queryKey: ['payroll-preview', selectedEmployeeId, periodStart, periodEnd] });
              }}
              variant="secondary"
              size="sm"
            >
              <RefreshCw className="w-3 h-3" /> Sincronizar
            </ActionButton>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <PayrollMetric label="Empleado" value={employees.find((item) => item.id === selectedEmployeeId)?.fullName || 'Sin selección'} />
            <PayrollMetric label="Pago neto" value={formatCurrency(preview?.netPay ?? 0)} />
            <PayrollMetric label="Por pagar" value={totals.generated.toString().padStart(2, '0')} />
            <PayrollMetric label="Pagadas" value={totals.paid.toString().padStart(2, '0')} />
          </div>

          <div className="bg-surface-container-low overflow-hidden flex flex-col border border-outline-variant/10 shadow-xl min-h-0 flex-1">
            <div className="overflow-x-auto flex-1 custom-scrollbar">
              {isLoadingPayrolls ? (
                <div className="p-8 flex justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-container-lowest sticky top-0 z-10">
                    <tr>
                      <th className="px-2 py-1.5 text-[7px] font-bold uppercase tracking-widest text-outline font-headline">Empleado</th>
                      <th className="px-2 py-1.5 text-[7px] font-bold uppercase tracking-widest text-outline font-headline">Periodo</th>
                      <th className="px-2 py-1.5 text-[7px] font-bold uppercase tracking-widest text-outline font-headline">Neto</th>
                      <th className="px-2 py-1.5 text-[7px] font-bold uppercase tracking-widest text-outline font-headline">Estatus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/5">
                    {payrolls.map((payroll) => {
                      const isSelected = payroll.id === selectedPayrollId;
                      return (
                        <tr
                          key={payroll.id}
                          onClick={() => setSelectedPayrollId(payroll.id)}
                          className={cn(
                            'hover:bg-surface-container-high transition-colors cursor-pointer group',
                            isSelected && 'bg-surface-container-high border-l-4 border-primary',
                          )}
                        >
                          <td className="px-2 py-1.5">
                            <div className="font-bold text-[10px] text-on-surface uppercase">{payroll.employee.fullName}</div>
                            <div className="text-[7px] text-outline uppercase font-medium">Nómina #{payroll.id}</div>
                          </td>
                          <td className="px-2 py-1.5 text-[8px] font-bold uppercase text-on-surface">
                            {payroll.periodStart.slice(0, 10)} / {payroll.periodEnd.slice(0, 10)}
                          </td>
                          <td className="px-2 py-1.5 text-[9px] font-black text-primary">
                            {formatCurrency(payroll.netPay)}
                          </td>
                          <td className="px-2 py-1.5">
                            <span
                              className={cn(
                                'text-[7px] font-black uppercase tracking-wider py-0.5 px-1 border',
                                payroll.status === 'PAID'
                                  ? 'text-primary bg-primary/10 border-primary/20'
                                  : 'text-tertiary bg-tertiary/10 border-tertiary/20',
                              )}
                            >
                              {payroll.status}
                            </span>
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
          <div className="bg-surface-container-low flex flex-col h-full border border-outline-variant/10 shadow-2xl relative overflow-hidden">
            <div className="p-2 border-b border-outline-variant/10 bg-surface-container-lowest">
              <div className="flex justify-between items-start mb-1">
                <span className="text-[7px] font-bold uppercase tracking-widest text-primary font-headline">Previsualización</span>
                <span className="text-[6px] font-bold py-0.5 px-1 bg-surface-container-highest text-outline border border-outline-variant/10">
                  {selectedEmployeeId ? `EMP #${selectedEmployeeId}` : 'SIN EMP'}
                </span>
              </div>
              <h2 className="font-headline font-black text-[11px] text-on-surface uppercase tracking-tight leading-none">
                {employees.find((item) => item.id === selectedEmployeeId)?.fullName || 'Seleccione empleado'}
              </h2>
              <p className="text-outline text-[7px] font-bold uppercase flex items-center gap-1 mt-1">
                <CalendarRange className="w-2.5 h-2.5" /> {periodStart} al {periodEnd}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
              <div className="space-y-2.5">
                <Field label="Empleado">
                  <select
                    value={selectedEmployeeId ?? ''}
                    onChange={(event) => setSelectedEmployeeId(Number(event.target.value))}
                    className={payrollFieldClassName}
                  >
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.fullName}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Inicio">
                    <input
                      type="date"
                      value={periodStart}
                      onChange={(event) => setPeriod((current) => ({ ...current, periodStart: event.target.value }))}
                      className={payrollFieldClassName}
                    />
                  </Field>
                  <Field label="Fin">
                    <input
                      type="date"
                      value={periodEnd}
                      onChange={(event) => setPeriod((current) => ({ ...current, periodEnd: event.target.value }))}
                      className={payrollFieldClassName}
                    />
                  </Field>
                </div>

                {isLoadingPreview ? (
                  <div className="p-6 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : previewError ? (
                  <div className="bg-error-container/30 border border-error/20 p-3">
                    <p className="text-[8px] font-bold uppercase tracking-widest text-error">
                      {((previewError as any)?.response?.data?.message as string) || 'No se pudo calcular la nómina'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    <MiniPayrollData label="Base" value={formatCurrency(preview?.employee.weeklySalary ?? 0)} />
                    <MiniPayrollData label="Extra" value={formatCurrency(preview?.totalOvertimePay ?? 0)} />
                    <MiniPayrollData label="Descuentos" value={formatCurrency(preview?.totalDeductions ?? 0)} />
                    <MiniPayrollData label="Neto" value={formatCurrency(preview?.netPay ?? 0)} />
                  </div>
                )}

                <ActionButton
                  onClick={() => closePayrollMutation.mutate()}
                  disabled={!preview || closePayrollMutation.isPending}
                  variant="primary"
                  size="md"
                  fullWidth
                >
                  {closePayrollMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <WalletCards className="w-3 h-3" />}
                  Cerrar nómina
                </ActionButton>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-[8px] font-black text-outline uppercase tracking-[0.18em] mb-1 font-headline">
                  Detalle seleccionado
                </h3>
                {isLoadingDetail ? (
                  <div className="p-6 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : payrollDetail ? (
                  <>
                    <div className="bg-surface-container-high border border-outline-variant/5 p-2 space-y-1.5">
                      <DetailLine label="Pago neto" value={formatCurrency(payrollDetail.netPay)} />
                      <DetailLine label="Deducciones" value={formatCurrency(payrollDetail.totalDeductions)} />
                      <DetailLine label="Horas extra" value={formatCurrency(payrollDetail.totalOvertimePay)} />
                      <DetailLine label="Estatus" value={payrollDetail.status} />
                    </div>

                    <div className="space-y-1.5">
                      {payrollDetail.ledgerEntries.slice(0, 5).map((entry) => (
                        <div key={entry.id} className="bg-surface-container-high border border-outline-variant/5 p-1.5">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <p className="text-[8px] font-black uppercase text-on-surface">
                                {entry.type.replaceAll('_', ' ')}
                              </p>
                              <p className="text-[7px] uppercase font-bold text-outline tracking-widest">
                                {entry.entryDate.slice(0, 10)}
                              </p>
                            </div>
                            <span className="text-[7px] font-black text-primary">
                              {formatCurrency(entry.amount)}
                            </span>
                          </div>
                          <p className="mt-1 text-[7px] text-on-surface-variant uppercase line-clamp-2">{entry.description}</p>
                        </div>
                      ))}
                    </div>

                    {payrollDetail.status !== 'PAID' ? (
                      <ActionButton
                        onClick={() => markPaidMutation.mutate(payrollDetail.id)}
                        disabled={markPaidMutation.isPending}
                        variant="secondary"
                        size="md"
                        fullWidth
                      >
                        {markPaidMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <WalletCards className="w-3 h-3" />}
                        Marcar pagada
                      </ActionButton>
                    ) : null}
                  </>
                ) : (
                  <div className="bg-surface-container-high border border-outline-variant/5 p-4 text-center">
                    <p className="text-[8px] uppercase font-black text-outline tracking-widest">
                      Selecciona una nómina
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function PayrollMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-container-low px-2 py-1.5 border-l-4 border-primary shadow-sm min-w-0">
      <span className="block text-[7px] font-bold text-outline uppercase tracking-widest mb-0.5">{label}</span>
      <span className="block text-[12px] font-headline font-black text-on-surface uppercase truncate">{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[8px] font-bold uppercase tracking-widest text-outline mb-1 block">{label}</label>
      {children}
    </div>
  );
}

function MiniPayrollData({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-container-high border border-outline-variant/5 p-2">
      <span className="block text-[8px] font-bold text-outline uppercase tracking-widest">{label}</span>
      <span className="text-[11px] font-black text-on-surface uppercase">{value}</span>
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center border-b border-outline-variant/10 pb-1 last:border-b-0 last:pb-0">
      <span className="text-[8px] font-bold text-outline uppercase tracking-widest">{label}</span>
      <span className="text-[9px] font-black text-on-surface uppercase">{value}</span>
    </div>
  );
}
