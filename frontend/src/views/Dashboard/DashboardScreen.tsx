import React from 'react';
import { Loader2, Users, Receipt, Clock, Activity } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useQuery } from '@tanstack/react-query';
import { getOpenOrders, getUsers, getActiveShift } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { motion } from 'framer-motion';

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
    if (!canSeeShift || !activeShift?.openedAt) return '00:00';
    const start = new Date(activeShift.openedAt);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffMins = Math.floor((diffMs % 3600000) / 60000);
    return `${diffHrs.toString().padStart(2, '0')}:${diffMins.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex items-center justify-center bg-[#070707] relative overflow-hidden">
      {/* VIVID AND DYNAMIC BACKGROUND */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Animated Drifting Glow 1 (Top-Left) */}
        <motion.div
          animate={{
            x: [-40, 40, -40],
            y: [-20, 20, -20],
            scale: [0, 0.0, 0]
          }}
          transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-20%] left-[-10%] w-[80%] h-[80%] bg-primary/10 blur-[150px] rounded-full"
        />

        {/* Animated Drifting Glow 2 (Bottom-Right) */}
        <motion.div
          animate={{
            x: [50, -50, 50],
            y: [30, -30, 30],
            rotate: [99, 9.0, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-30%] right-[-80%] w-[70%] h-[90%] bg-primary/[0.06] blur-[160px] rounded-full"
        />

        {/* Base Carbon Layer */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.12] mix-blend-overlay" />

        {/* Dynamic Technical Grid (Slow Pulse) */}
        <motion.div
          animate={{ opacity: [0.15, 0.25, 0.15] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-[-100%]"
          style={{
            backgroundImage: `
              radial-gradient(circle, #555 1px, transparent 1px),
              radial-gradient(circle, #333 1px, transparent 1px)
            `,
            backgroundSize: '37px 37px, 43px 43px',
            backgroundPosition: '0 0, 15px 15px',
            transform: 'rotate(5deg)'
          }}
        />

        {/* Animated Noise Pattern */}
        <motion.div
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%'],
            opacity: [0.15, 0.25, 0.15]
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] contrast-200 brightness-150"
        />

        {/* Central Dark Gradient to Focus Content */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="relative z-10 w-full max-w-lg flex flex-col items-center"
      >
        {/* Branding Hub: Aggressively Compact and Clustered */}
        <div className="flex flex-col items-center mb-4">
          <motion.div
            animate={{
              filter: ["drop-shadow(0 0 10px rgba(255,215,0,0.2))", "drop-shadow(0 0 40px rgba(255,215,0,0.5))", "drop-shadow(0 0 10px rgba(255,215,0,0.2))"],
              scale: [1, 1.05, 1]
            }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="relative mb-1"
          >
            <img
              src="/icono.png"
              alt="Fatboy POS"
              className="h-24 w-24 object-contain relative z-10"
            />
          </motion.div>

          <div className="flex flex-col items-center text-center">
            <h2 className="text-4xl font-headline font-black text-white tracking-[-0.04em] uppercase leading-none select-none drop-shadow-md">
              FATBOY<span className="text-primary">.</span>POS
            </h2>
            <div className="mt-1 flex items-center gap-1.5 px-3 py-0.5 bg-black/60 backdrop-blur-sm rounded-full border border-white/5">
              <Activity className="w-2.5 h-2.5 text-primary" />
              <p className="text-[7px] font-black uppercase tracking-[0.4em] text-outline/80">Cardona System V1</p>
            </div>
          </div>
        </div>

        {/* Central Metric Terminal: High Density Strip */}
        <div className="w-full max-w-sm">
          {isLoading ? (
            <div className="py-4 flex items-center justify-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-[9px] font-black text-outline uppercase tracking-widest">Sincronizando...</span>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1 px-4">
              <MetricStrip
                label="Staff"
                value={canSeeUsers ? users.length.toString().padStart(2, '0') : '--'}
                icon={<Users className="w-3 h-3" />}
                variant="active"
              />
              <MetricStrip
                label="Pedidos"
                value={openOrders.length.toString().padStart(2, '0')}
                icon={<Receipt className="w-3 h-3" />}
                variant="default"
              />
              <MetricStrip
                label="Turno"
                value={getShiftDuration()}
                icon={<Clock className="w-3 h-3" />}
                variant="dim"
              />
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function MetricStrip({ label, value, icon, variant }: { label: string, value: string, icon: React.ReactNode, variant: 'active' | 'default' | 'dim' }) {
  const styles = {
    active: "text-primary border-primary/30 bg-primary/10",
    default: "text-white border-white/10 bg-[#0c0c0c]/80 backdrop-blur-md",
    dim: "text-outline/70 border-white/5 bg-[#080808]/80 backdrop-blur-md"
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={cn("flex flex-col items-center gap-0.5 p-2 rounded-[1px] border shadow-2xl transition-all", styles[variant])}
    >
      <div className="flex items-center gap-1.5 opacity-80">
        <span className="text-[7px] font-black uppercase tracking-wider">{label}</span>
        {icon}
      </div>
      <span className="text-xl font-headline font-black leading-none tracking-tighter">
        {value}
      </span>
    </motion.div>
  );
}
