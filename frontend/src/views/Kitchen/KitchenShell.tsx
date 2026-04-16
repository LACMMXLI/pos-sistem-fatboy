import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, UserRound, ChevronRight, LogOut, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { waiterPinLogin } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { KitchenScreen } from './KitchenScreen';

const keypadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'delete'] as const;

export function KitchenShell() {
  const user = useAuthStore((state) => state.user);
  const canSeeKitchen = user && ['ADMIN', 'SUPERVISOR', 'COCINA'].includes(user.role);

  if (!canSeeKitchen) {
    return <KitchenPinLogin />;
  }

  return <KitchenScreen surfaceMode />;
}

function KitchenPinLogin() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const [pin, setPin] = useState('');

  const loginMutation = useMutation({
    mutationFn: () => waiterPinLogin(pin),
    onSuccess: (response) => {
      setAuth(
        {
          ...response.user,
          id: String(response.user.id),
        } as any,
        response.access_token,
      );
      toast.success(`Monitor KDS activado para ${response.user.name}`);
      setPin('');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'PIN inválido para Cocina');
    },
  });

  const handleKeyPress = (key: (typeof keypadKeys)[number]) => {
    if (key === 'clear') {
      setPin('');
      return;
    }
    if (key === 'delete') {
      setPin((current) => current.slice(0, -1));
      return;
    }
    setPin((current) => (current.length >= 4 ? current : `${current}${key}`));
  };

  return (
    <div className="flex h-screen flex-col bg-[#0f1113] px-6 py-5">
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col justify-between">
        <div className="text-center">
          <div className="inline-flex h-1.5 w-24 bg-primary/20 mb-6 overflow-hidden">
             <div className="h-full w-1/2 bg-primary animate-pulse" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/80">
            Kitchen Display System
          </p>
          <h1 className="mt-2 font-headline text-5xl font-black uppercase tracking-[0.05em] text-white">
            Producción
          </h1>
          <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-outline/60">
            Terminal de Cocina • Identificación requerida
          </p>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[1fr_1.1fr] gap-8 py-10">
          <section className="flex flex-col justify-center gap-8">
            <div className="space-y-6">
                <div className="flex items-center gap-4 border-l-4 border-primary bg-primary/5 p-5">
                    <UserRound className="h-8 w-8 text-primary" />
                    <div>
                        <h2 className="font-headline text-xl font-black uppercase tracking-wider text-white">Monitor KDS</h2>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-outline">Acceso a producción</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                    <FeatureItem label="Visibilidad Total" />
                    <FeatureItem label="Control de Tiempos" />
                    <FeatureItem label="Alertas Críticas" />
                </div>
            </div>

            <div className="bg-[#171a1d] border border-white/5 p-8 shadow-2xl">
              <div className="text-center">
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-primary/70 mb-4">
                  PIN Operativo
                </p>
                <div className="flex justify-center gap-4">
                  {[...Array(4)].map((_, i) => (
                    <div 
                      key={i}
                      className={cn(
                        "h-14 w-14 border-2 flex items-center justify-center transition-all duration-300",
                        pin.length > i 
                          ? "border-primary bg-primary/10 scale-110 shadow-[0_0_20px_rgba(255,191,0,0.2)]" 
                          : "border-white/10 bg-white/5"
                      )}
                    >
                      {pin.length > i && <div className="h-3 w-3 bg-primary rounded-full shadow-[0_0_10px_rgba(255,191,0,0.8)]" />}
                    </div>
                  ))}
                </div>
                
                <button
                  onClick={() => loginMutation.mutate()}
                  disabled={pin.length !== 4 || loginMutation.isPending}
                  className="mt-10 flex w-full items-center justify-center gap-3 bg-primary px-4 py-5 text-[12px] font-black uppercase tracking-[0.2em] text-black transition-all active:scale-[0.98] disabled:opacity-20 hover:brightness-110"
                >
                  {loginMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <span>Acceder a Cocina</span>
                      <ChevronRight className="h-5 w-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-3 gap-3">
            {keypadKeys.map((key) => {
              const isClear = key === 'clear';
              const isDelete = key === 'delete';

              return (
                <button
                  key={key}
                  onClick={() => handleKeyPress(key)}
                  className={cn(
                    'flex items-center justify-center border text-center transition-all active:scale-[0.95] duration-150',
                    isClear
                      ? 'border-red-500/20 bg-red-500/5 text-red-500 hover:bg-red-500/10'
                      : isDelete
                        ? 'border-white/10 bg-white/5 text-outline hover:bg-white/10'
                        : 'border-white/10 bg-white/5 text-white hover:border-primary/50 hover:bg-primary/5 hover:text-primary',
                  )}
                >
                  <span className="font-headline text-4xl font-black">
                    {isClear ? 'C' : isDelete ? '←' : key}
                  </span>
                </button>
              );
            })}
          </section>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ label }: { label: string }) {
    return (
        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.15em] text-outline/80">
            <CheckCircle2 className="h-4 w-4 text-primary/40" />
            {label}
        </div>
    );
}
