import type { ReactNode } from 'react';
import { Clock3, Loader2, Printer, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { DesktopPrintQueueEntry } from '../../lib/runtime';
import { cn } from '../../lib/utils';

type Props = {
  queue: DesktopPrintQueueEntry[];
  loading?: boolean;
};

const statusMeta: Record<DesktopPrintQueueEntry['status'], { label: string; tone: string; icon: ReactNode }> = {
  queued: {
    label: 'En cola',
    tone: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
    icon: <Clock3 className="w-3 h-3" />,
  },
  pending: {
    label: 'Pendiente',
    tone: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
    icon: <Clock3 className="w-3 h-3" />,
  },
  printing: {
    label: 'Imprimiendo',
    tone: 'border-sky-400/20 bg-sky-400/10 text-sky-100',
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  processing: {
    label: 'Procesando',
    tone: 'border-sky-400/20 bg-sky-400/10 text-sky-100',
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  printed: {
    label: 'Impreso',
    tone: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  failed: {
    label: 'Error',
    tone: 'border-red-400/20 bg-red-400/10 text-red-100',
    icon: <AlertTriangle className="w-3 h-3" />,
  },
  cancelled: {
    label: 'Cancelado',
    tone: 'border-zinc-400/20 bg-zinc-400/10 text-zinc-100',
    icon: <AlertTriangle className="w-3 h-3" />,
  },
};

export function DesktopPrintQueueCard({ queue, loading = false }: Props) {
  const queuedCount = queue.filter((job) => ['queued', 'pending', 'printing', 'processing'].includes(job.status)).length;
  const failedCount = queue.filter((job) => job.status === 'failed').length;
  const recentJobs = queue.slice(0, 8);

  return (
    <div className="border border-outline-variant/10 bg-surface-container-high p-3 space-y-3">
      <div className="flex items-start gap-3">
        <div className="border border-primary/20 bg-primary/10 p-2 text-primary">
          <Printer className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-on-surface">Cola de impresión</p>
          <p className="mt-1 text-[7px] font-bold uppercase tracking-[0.12em] text-outline">
            Visible solo en la computadora principal con Electron abierto
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <QueueMetric label="Pendientes" value={String(queuedCount).padStart(2, '0')} />
        <QueueMetric label="Errores" value={String(failedCount).padStart(2, '0')} />
        <QueueMetric label="Historial" value={String(queue.length).padStart(2, '0')} />
      </div>

      <div className="border border-outline-variant/10 bg-surface-container-lowest">
        <div className="border-b border-outline-variant/10 px-3 py-2 text-[7px] font-black uppercase tracking-[0.16em] text-outline">
          {loading ? 'Sincronizando cola...' : 'Últimos trabajos'}
        </div>
        <div className="max-h-[320px] overflow-auto custom-scrollbar">
          {recentJobs.length === 0 ? (
            <div className="px-3 py-6 text-center text-[7px] font-bold uppercase tracking-[0.14em] text-outline">
              No hay trabajos registrados todavía.
            </div>
          ) : (
            recentJobs.map((job) => {
              const meta = statusMeta[job.status];
              return (
                <div key={job.id} className="border-b border-outline-variant/10 px-3 py-2 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-on-surface">
                        {job.documentType || `Orden #${job.orderId}`} · {job.type === 'KITCHEN' ? 'Cocina' : 'Cliente'}
                      </p>
                      <p className="mt-1 text-[7px] font-bold uppercase tracking-[0.12em] text-outline">
                        {job.source || 'desktop'} · {job.printerName || 'Impresora por ajuste'}
                      </p>
                      <p className="mt-1 text-[7px] font-bold uppercase tracking-[0.12em] text-outline">
                        {formatJobTime(job.updatedAt)}
                      </p>
                      {job.error ? (
                        <p className="mt-1 text-[7px] font-bold uppercase tracking-[0.1em] text-red-200">
                          {job.error}
                        </p>
                      ) : null}
                    </div>
                    <span className={cn('inline-flex items-center gap-1 border px-2 py-1 text-[7px] font-black uppercase tracking-[0.14em]', meta.tone)}>
                      {meta.icon}
                      {meta.label}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function QueueMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-outline-variant/10 bg-surface-container-lowest px-2.5 py-2">
      <span className="block text-[6px] font-black uppercase tracking-[0.1em] text-outline">{label}</span>
      <span className="mt-0.5 block text-[11px] font-headline font-black uppercase text-on-surface">{value}</span>
    </div>
  );
}

function formatJobTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Sin fecha';
  }

  return parsed.toLocaleString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}
