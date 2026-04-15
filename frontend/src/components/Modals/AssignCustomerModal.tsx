import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Search, UserRound, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { findOrCreateCustomer } from '../../services/api';
import { queryKeys } from '../../lib/queryKeys';
import { AssignedCustomer } from '../../store/cartStore';

interface AssignCustomerModalProps {
  onClose: () => void;
  onAssigned: (customer: AssignedCustomer) => void;
}

export function AssignCustomerModal({ onClose, onAssigned }: AssignCustomerModalProps) {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      findOrCreateCustomer({
        phone,
        name: name.trim() || undefined,
      }),
    onSuccess: (customer) => {
      onAssigned({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        loyaltyPoints: customer.loyaltyPoints ?? 0,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers });
      toast.success('Cliente asignado al carrito');
      onClose();
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message;
      toast.error(`No se pudo asignar el cliente: ${message}`);
    },
  });

  const normalizedPhone = phone.replace(/\D/g, '');
  const canSubmit = normalizedPhone.length >= 7 && !mutation.isPending;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-stone-950/80 backdrop-blur-sm px-4"
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="w-full max-w-md border border-outline-variant/10 bg-surface-container-low shadow-[0_20px_40px_rgba(0,0,0,0.55)]"
      >
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.28em] text-primary">Fidelizacion</p>
            <h2 className="mt-1 font-headline text-lg font-black uppercase tracking-tight text-white">
              Asignar cliente
            </h2>
          </div>
          <button onClick={onClose} className="text-outline transition-colors hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div className="border border-outline-variant/10 bg-surface-container-highest px-3 py-3">
            <label className="block text-[8px] font-bold uppercase tracking-widest text-outline">
              Telefono
            </label>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="6641234567"
              className="mt-2 w-full bg-transparent text-lg font-headline font-black text-white outline-none"
            />
            <p className="mt-1 text-[8px] font-bold uppercase tracking-widest text-outline">
              Si existe lo reutilizamos. Si no, se crea sin afectar el flujo de venta.
            </p>
          </div>

          <div className="border border-outline-variant/10 bg-surface-container-highest px-3 py-3">
            <label className="block text-[8px] font-bold uppercase tracking-widest text-outline">
              Nombre opcional
            </label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Cliente frecuente"
              className="mt-2 w-full bg-transparent text-base font-bold text-white outline-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 border border-outline-variant/10 bg-surface-container-high px-3 py-3 text-[9px] font-headline font-black uppercase tracking-widest text-outline transition-colors hover:text-white"
            >
              Cancelar
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={!canSubmit}
              className="flex flex-1 items-center justify-center gap-2 bg-primary px-3 py-3 text-[9px] font-headline font-black uppercase tracking-widest text-on-primary transition-all disabled:opacity-50"
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar o crear
            </button>
          </div>

          <div className="flex items-start gap-3 border border-primary/10 bg-primary/5 px-3 py-3">
            <UserRound className="mt-0.5 h-4 w-4 text-primary" />
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest text-primary">
                Cliente opcional
              </p>
              <p className="mt-1 text-[8px] font-bold uppercase tracking-widest text-outline">
                Si no asignas cliente, la venta sigue exactamente igual que hoy.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
