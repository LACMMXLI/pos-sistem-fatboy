import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useQuery } from '@tanstack/react-query';
import { getOpenOrders, getUsers, getActiveShift } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export function DashboardScreen() {
  const { user } = useAuthStore();
  const role = user?.role ?? '';
  const canSeeUsers = role === 'ADMIN' || role === 'SUPERVISOR';
  const canSeeShift = role === 'ADMIN' || role === 'SUPERVISOR' || role === 'CAJERO';

  const { data: openOrders = [], isLoading: isLoadingOrders } = useQuery({
    queryKey: ['open-orders-count'],
    queryFn: () => getOpenOrders(),
    refetchInterval: 30000,
  });

  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['active-users'],
    queryFn: () => getUsers(),
    enabled: canSeeUsers,
  });

  const { data: activeShift, isLoading: isLoadingShift } = useQuery({
    queryKey: ['active-shift-dashboard'],
    queryFn: getActiveShift,
    enabled: canSeeShift,
  });

  const isLoading =
    isLoadingOrders ||
    (canSeeUsers && isLoadingUsers) ||
    (canSeeShift && isLoadingShift);

  const getShiftDuration = () => {
    if (!canSeeShift || !activeShift?.openedAt) return '--:--';
    const start = new Date(activeShift.openedAt);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffMins = Math.floor((diffMs % 3600000) / 60000);
    return `${diffHrs.toString().padStart(2, '0')}:${diffMins.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col items-center justify-center relative bg-surface-dim">
      <div className="absolute inset-0 z-0 flex items-center justify-center opacity-20 pointer-events-none">
        <div className="w-[400px] h-[400px] bg-primary/10 blur-[80px]"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-0 flex flex-col items-center">
          <div className="mb-1 flex h-64 w-64 items-center justify-center">
            <img
              src="/icono.png"
              alt="Fatboy POS"
              className="h-full w-full object-contain drop-shadow-[0_0_36px_rgba(255,215,0,0.36)]"
            />
          </div>
          <h2 className="text-5xl font-black text-white tracking-tighter font-headline uppercase select-none leading-none">
            FATBOY<span className="text-primary">.</span>POS
          </h2>
          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.5em] text-outline font-label">Heavyweight System v5.0.0</p>
        </div>

        {isLoading ? (
          <div className="-mt-4 flex flex-col items-center gap-1">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-[8px] font-bold text-outline uppercase tracking-widest">Sincronizando...</span>
          </div>
        ) : (
          <div className="-mt-4 grid w-full max-w-xl grid-cols-3 gap-1.5 px-2">
            <StatusCard
              label="Usuarios Activos"
              value={canSeeUsers ? users.length.toString().padStart(2, '0') : '--'}
              status={canSeeUsers ? 'Online' : 'Sin Acceso'}
              color="primary"
            />
            <StatusCard
              label="Órdenes Abiertas"
              value={openOrders.length.toString().padStart(2, '0')}
              status="En Proceso"
              color="tertiary"
            />
            <StatusCard
              label="Tiempo de Turno"
              value={getShiftDuration()}
              status={canSeeShift ? 'H/M' : 'Sin Turno'}
              color="secondary"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function StatusCard({ label, value, status, color }: { label: string, value: string, status: string, color: string }) {
  const borderColors: Record<string, string> = {
    primary: "border-primary/40",
    tertiary: "border-tertiary/40",
    secondary: "border-secondary/40",
  };
  const textColors: Record<string, string> = {
    primary: "text-primary",
    tertiary: "text-tertiary",
    secondary: "text-outline",
  };

  return (
    <div className={cn("bg-surface-container-low p-2 flex flex-col justify-between h-16 border-l-4", borderColors[color])}>
      <span className="text-outline text-[7px] font-bold uppercase tracking-widest">{label}</span>
      <div className="flex items-end justify-between">
        <span className="text-xl font-headline font-bold text-on-surface">{value}</span>
        <span className={cn("text-[7px] font-bold uppercase", textColors[color])}>{status}</span>
      </div>
    </div>
  );
}
