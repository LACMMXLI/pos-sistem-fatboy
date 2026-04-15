import { useState } from 'react';
import { Loader2, ShieldAlert, X } from 'lucide-react';

interface AdminPasswordModalProps {
  title?: string;
  description?: string;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void;
}

export function AdminPasswordModal({
  title = 'Autorización de administrador',
  description = 'Ingresa la contraseña del administrador para confirmar esta acción.',
  isSubmitting = false,
  onClose,
  onConfirm,
}: AdminPasswordModalProps) {
  const [password, setPassword] = useState('');

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden border border-outline-variant/10 bg-surface-container-low shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/5 bg-surface-container-high px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-error" />
            <h2 className="text-sm font-black uppercase tracking-widest text-on-surface font-headline">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-highest text-outline transition-colors hover:text-white disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-outline">
            {description}
          </p>

          <div className="space-y-2">
            <label className="block text-[8px] font-black uppercase tracking-widest text-outline">
              Contraseña de administrador
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoFocus
              className="w-full border border-outline-variant/10 bg-surface-container-high px-4 py-3 text-sm font-black text-white outline-none"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && password.trim() && !isSubmitting) {
                  onConfirm(password.trim());
                }
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="py-3 text-[9px] font-black uppercase tracking-widest text-outline border border-outline-variant/20 bg-surface-container-highest disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              onClick={() => onConfirm(password.trim())}
              disabled={!password.trim() || isSubmitting}
              className="flex items-center justify-center gap-2 py-3 text-[9px] font-black uppercase tracking-widest text-on-primary bg-primary disabled:opacity-40"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
