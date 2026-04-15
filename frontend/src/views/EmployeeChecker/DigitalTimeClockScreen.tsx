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
    hour12: false,
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
    <div className="h-full overflow-hidden bg-surface px-6 py-4">
      <div className="mx-auto flex h-full max-w-[1400px] flex-col overflow-hidden">
        <div className="mb-3 px-1 text-center">
          <p className="text-[8px] font-black uppercase tracking-[0.28em] text-primary">
            Checador digital
          </p>
          <h1 className="mt-1 font-headline text-lg font-black uppercase tracking-[0.12em] text-on-surface">
            Registro rápido
          </h1>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-2 gap-4">
          <section className="flex min-h-0 flex-col justify-between border border-outline-variant/10 bg-surface-container-low px-5 py-4 shadow-2xl">
            <div className="border border-outline-variant/10 bg-surface-container-lowest px-4 py-5 text-center shadow-inner">
              <div className="mb-2 inline-flex h-9 w-9 items-center justify-center border border-primary/20 bg-primary/10 text-primary">
                <Clock3 className="h-4 w-4" />
              </div>
              <div className="font-headline text-[3.25rem] font-black tracking-[0.1em] leading-none text-on-surface">
                {formattedTime}
              </div>
              <div className="mt-2 text-[8px] font-bold uppercase tracking-[0.16em] text-outline">
                {formattedDate}
              </div>
            </div>

            <div className="mt-4 border border-outline-variant/10 bg-surface-container-lowest p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.2em] text-primary">
                    Código del empleado
                  </p>
                  <p className="mt-1 text-[7px] font-bold uppercase tracking-[0.12em] text-outline">
                    Captura la clave de 4 dígitos
                  </p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center border border-outline-variant/10 bg-surface-container-high text-primary">
                  <KeyRound className="h-4 w-4" />
                </div>
              </div>

              <div className="mt-3 border border-outline-variant/10 bg-surface px-3 py-4 text-center">
                <div className="font-headline text-4xl font-black tracking-[0.34em] leading-none text-on-surface">
                  {employeeCode.padEnd(4, '•')}
                </div>
              </div>

              <div className="mt-3 min-h-10 border border-outline-variant/10 bg-surface-container-high px-3 py-2">
                {employeeCode.length === 0 ? (
                  <p className="text-[7px] font-bold uppercase tracking-[0.12em] text-outline">
                    Esperando captura
                  </p>
                ) : matchedEmployee ? (
                  <div>
                    <p className="text-[7px] font-black uppercase tracking-[0.16em] text-primary">
                      Empleado detectado
                    </p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-[0.06em] text-on-surface">
                      {matchedEmployee.fullName}
                    </p>
                  </div>
                ) : (
                  <p className="text-[7px] font-black uppercase tracking-[0.12em] text-red-400">
                    Clave no encontrada
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="flex min-h-0 flex-col border border-outline-variant/10 bg-surface-container-low px-5 py-4 shadow-2xl">
            <div className="mb-3 text-center">
              <h2 className="text-[8px] font-black uppercase tracking-[0.2em] text-on-surface">
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
                      'flex min-h-0 items-center justify-center border text-center transition-all active:scale-[0.98]',
                      isClear
                        ? 'border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/15'
                        : isBackspace
                          ? 'border-outline-variant/10 bg-surface-container-high text-outline hover:text-on-surface'
                          : 'border-outline-variant/10 bg-surface-container-lowest text-on-surface hover:border-primary/30 hover:text-primary',
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
                      <Delete className="h-4 w-4" />
                    ) : (
                      <span className="font-headline text-[1.75rem] font-black uppercase leading-none tracking-[0.04em]">
                        {isClear ? 'C' : key}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <div className="mt-4 flex items-center justify-center gap-3 px-8">
          <button
            onClick={() => setMode('entry')}
            className={cn(
              'flex min-w-40 items-center justify-center gap-2 border px-4 py-3 transition-all active:scale-[0.99]',
              mode === 'entry'
                ? 'border-primary bg-primary text-on-primary shadow-lg shadow-primary/10'
                : 'border-outline-variant/10 bg-surface-container-high text-outline hover:text-on-surface',
            )}
            aria-pressed={mode === 'entry'}
          >
            <LogIn className="h-4 w-4" />
            <span className="text-[9px] font-black uppercase tracking-[0.16em]">
              Entrada
            </span>
          </button>

          <button
            onClick={() => setMode('exit')}
            className={cn(
              'flex min-w-40 items-center justify-center gap-2 border px-4 py-3 transition-all active:scale-[0.99]',
              mode === 'exit'
                ? 'border-primary bg-primary text-on-primary shadow-lg shadow-primary/10'
                : 'border-outline-variant/10 bg-surface-container-high text-outline hover:text-on-surface',
            )}
            aria-pressed={mode === 'exit'}
          >
            <LogOut className="h-4 w-4" />
            <span className="text-[9px] font-black uppercase tracking-[0.16em]">
              Salida
            </span>
          </button>

          <ActionButton
            variant="primary"
            size="lg"
            onClick={handleClockAction}
            disabled={employeeCode.length !== 4 || !matchedEmployee || isLoading}
            className="h-11 min-w-56 px-6 text-[9px]"
          >
            {mode === 'entry' ? 'Registrar entrada' : 'Registrar salida'}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
