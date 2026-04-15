import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Banknote, Receipt, CheckCircle2 } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { cn } from '../../lib/utils';

export function ChangeOverlay() {
  const { changeModal, setChangeModal } = useUIStore();
  const [timeLeft, setTimeLeft] = useState(6);

  useEffect(() => {
    if (changeModal?.show) {
      setTimeLeft(6);
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setChangeModal(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [changeModal?.show, setChangeModal]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && changeModal?.show) {
        setChangeModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [changeModal?.show, setChangeModal]);

  if (!changeModal?.show) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-8 pointer-events-none">
        {/* Subtle Backdrop with fast fade */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto"
          onClick={() => setChangeModal(null)}
        />
        
        <motion.div
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           exit={{ opacity: 0, scale: 0.95 }}
           transition={{ duration: 0.15, ease: "easeOut" }}
          className="relative w-full max-w-[500px] pointer-events-auto"
        >
          {/* Mustard / High-Visibility Block */}
          <div className="relative w-full bg-amber-400 py-16 rounded-[40px] border-[6px] border-amber-600 shadow-2xl overflow-hidden">
             {/* Subtle internal depth */}
             <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
             
             <div className="flex flex-col items-center relative z-10">
                <span className="text-black/60 font-black uppercase tracking-[0.4em] text-[12px] mb-4">Entregar Cambio:</span>
                <span className="text-[100px] font-black text-emerald-800 font-headline tracking-tighter block leading-none drop-shadow-sm">
                  ${changeModal.amount.toFixed(2)}
                </span>
             </div>

             {/* Closing hint */}
             <div className="mt-8 text-black/40 text-[10px] font-black uppercase tracking-[0.2em] text-center">
               Cerrar Ventana (ESC)
             </div>
             
             {/* Bottom visual accent */}
             <div className="absolute bottom-0 left-0 right-0 h-3 bg-amber-600" />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
