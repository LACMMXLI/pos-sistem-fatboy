import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock3, Delete, KeyRound, LogIn, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import ActionButton from '../../components/ui/ActionButton';
import { cn } from '../../lib/utils';
import { getEmployeesBasicList } from '../../services/api';

type EmployeeRecord = {
  id: number;
  fullName: string;
  employeeCode: string;
  isActive: boolean;
};

type ClockMode = 'entry' | 'exit';

type ClockEvent = {
  employeeId: number;
  employeeName: string;
  employeeCode: string;
  mode: ClockMode;
  timestamp: string;
};

const keypadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'backspace'] as const;

export function DigitalTimeClockScreen() {
  const [now, setNow] = useState(() => new Date());
  const [employeeCode, setEmployeeCode] = useState('');
  const [mode, setMode] = useState<ClockMode>('entry');
  const [recentEvents, setRecentEvents] = useState<ClockEvent[]>([]);

  const { data: employees = [], isLoading } = useQuery<EmployeeRecord[]>({
    queryKey: ['employees-digital-clock'],
    queryFn: getEmployeesBasicList,
  });

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timerId);
  }, []);

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.isActive),
    [employees],
  );

  const matchedEmployee = useMemo(
    () => activeEmployees.find((employee) => employee.employeeCode === employeeCode),
    [activeEmployees, employeeCode],
  );

  const formattedTime = now.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const formattedDate = now.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const appendDigit = (digit: string) => {
    setEmployeeCode((current) => (current.length >= 4 ? current : `${current}${digit}`));
  };

  const handleKeyPress = (key: (typeof keypadKeys)[number]) => {
    if (key === 'clear') {
      setEmployeeCode('');
      return;
    }

    if (key === 'backspace') {
      setEmployeeCode((current) => current.slice(0, -1));
      return;
    }

    appendDigit(key);
  };

  const handleClockAction = () => {
    if (employeeCode.length !== 4) {
      toast.error('Ingresa la clave completa de 4 dígitos');
      return;
    }

    if (!matchedEmployee) {
      toast.error('La clave no coincide con un empleado activo');
      return;
    }

    const event: ClockEvent = {
      employeeId: matchedEmployee.id,
      employeeName: matchedEmployee.fullName,
      employeeCode: matchedEmployee.employeeCode,
      mode,
      timestamp: new Date().toISOString(),
    };

    setRecentEvents((current) => [event, ...current].slice(0, 6));
    toast.success(
      `${mode === 'entry' ? 'Entrada' : 'Salida'} registrada para ${matchedEmployee.fullName}`,
    );
    setEmployeeCode('');
  };

  return (
    <div className="admin-shell h-full overflow-hidden px-3 py-3 pb-6">
      <div className="mx-auto flex h-full max-w-[1120px] flex-col justify-center overflow-hidden">
        <div className="mb-3 text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary/85">
            Reloj checador
          </p>
        </div>

        <div className="mx-auto grid min-h-0 w-full max-w-[1040px] flex-1 content-center grid-cols-1 gap-3 xl:grid-cols-[0.92fr_1.08fr]">
          <section className="admin-panel flex min-h-0 flex-col justify-between px-3 py-3 md:px-4 md:py-4">
            <div className="admin-card px-3 py-4 text-center md:px-4 md:py-4.5">
              <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                <Clock3 className="h-3.5 w-3.5" />
              </div>
              <div className="font-headline text-[2.5rem] font-black leading-none tracking-[0.05em] text-on-surface md:text-[3rem]">
                {formattedTime}
              </div>
              <div className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-outline md:text-[10px]">
                {formattedDate}
              </div>
            </div>

            <div className="admin-card-muted mt-3 p-3 md:p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">
                    Código del empleado
                  </p>
                  <p className="mt-1 text-[10px] font-medium text-on-surface-variant">
                    Captura la clave de 4 dígitos
                  </p>
                </div>
                <div className="flex h-8.5 w-8.5 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-primary">
                  <KeyRound className="h-3 w-3" />
                </div>
              </div>

              <div className="mt-2.5 rounded-[0.8rem] border border-white/10 bg-black/24 px-3 py-3 text-center md:py-4">
                <div className="font-headline text-[2rem] font-black leading-none tracking-[0.22em] text-on-surface md:text-[2.45rem]">
                  {employeeCode.padEnd(4, '•')}
                </div>
              </div>

              <div className="mt-2.5 min-h-12 rounded-[0.8rem] border border-white/8 bg-white/[0.04] px-3 py-2.5">
                {employeeCode.length === 0 ? (
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-outline">
                    Esperando captura
                  </p>
                ) : matchedEmployee ? (
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-primary">
                      Empleado detectado
                    </p>
                    <p className="mt-1 text-[15px] font-black uppercase tracking-[0.03em] text-on-surface md:text-[16px]">
                      {matchedEmployee.fullName}
                    </p>
                  </div>
                ) : (
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-red-400">
                    Clave no encontrada
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="admin-panel flex min-h-0 flex-col px-3 py-3 md:px-4 md:py-4">
            <div className="mb-2 text-center">
              <h2 className="text-[10px] font-black uppercase tracking-[0.16em] text-on-surface">
                Teclado numérico
              </h2>
            </div>

            <div className="grid flex-1 grid-cols-3 gap-2">
              {keypadKeys.map((key) => {
                const isClear = key === 'clear';
                const isBackspace = key === 'backspace';

                return (
                  <button
                    key={key}
                    onClick={() => handleKeyPress(key)}
                    className={cn(
                      'flex min-h-[56px] items-center justify-center rounded-[0.9rem] border text-center transition-all active:scale-[0.98] md:min-h-[62px]',
                      isClear
                        ? 'border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/16'
                        : isBackspace
                          ? 'border-white/10 bg-white/[0.04] text-outline hover:text-on-surface'
                          : 'border-white/10 bg-black/20 text-on-surface hover:border-primary/30 hover:text-primary hover:shadow-[0_14px_30px_rgba(255,215,0,0.08)]',
                    )}
                    aria-label={
                      key === 'clear'
                        ? 'Limpiar código'
                        : key === 'backspace'
                          ? 'Borrar último dígito'
                          : `Ingresar ${key}`
                    }
                  >
                    {isBackspace ? (
                      <Delete className="h-4.5 w-4.5" />
                    ) : (
                      <span className="font-headline text-[1.5rem] font-black uppercase leading-none tracking-[0.03em] md:text-[1.7rem]">
                        {isClear ? 'C' : key}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <div className="mx-auto mt-3 flex w-full max-w-[1040px] flex-wrap items-center justify-center gap-2.5 px-1 pb-10 md:pb-12">
          <button
            onClick={() => setMode('entry')}
            className={cn(
              'flex min-w-32 items-center justify-center gap-2 rounded-full border px-4 py-2.5 transition-all active:scale-[0.99]',
              mode === 'entry'
                ? 'border-primary/25 bg-primary text-on-primary shadow-[0_18px_36px_rgba(255,215,0,0.16)]'
                : 'border-white/10 bg-white/[0.05] text-outline hover:text-on-surface',
            )}
            aria-pressed={mode === 'entry'}
          >
            <LogIn className="h-3.5 w-3.5" />
            <span className="text-[10px] font-black uppercase tracking-[0.12em]">
              Entrada
            </span>
          </button>

          <button
            onClick={() => setMode('exit')}
            className={cn(
              'flex min-w-32 items-center justify-center gap-2 rounded-full border px-4 py-2.5 transition-all active:scale-[0.99]',
              mode === 'exit'
                ? 'border-primary/25 bg-primary text-on-primary shadow-[0_18px_36px_rgba(255,215,0,0.16)]'
                : 'border-white/10 bg-white/[0.05] text-outline hover:text-on-surface',
            )}
            aria-pressed={mode === 'exit'}
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="text-[10px] font-black uppercase tracking-[0.12em]">
              Salida
            </span>
          </button>

          <ActionButton
            variant="primary"
            size="lg"
            onClick={handleClockAction}
            disabled={employeeCode.length !== 4 || !matchedEmployee || isLoading}
            className="h-9 min-w-40 px-4 text-[8px] md:min-w-44"
          >
            {mode === 'entry' ? 'Registrar entrada' : 'Registrar salida'}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
