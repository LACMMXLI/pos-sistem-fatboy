import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { getRealtimeSocket } from '../services/realtime';
import { isDesktopRuntime, printDesktopOrderReceipt } from '../lib/runtime';

type PrintJobPayload = {
  jobId?: string;
  orderId: number;
  type?: 'CLIENT' | 'KITCHEN';
  printerName?: string;
  paperWidth?: '58' | '80';
  copies?: number;
  openDrawer?: boolean;
  source?: string;
};

export function useDesktopPrintDispatcher(enabled: boolean) {
  const seenJobsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!enabled || !isDesktopRuntime()) {
      return;
    }

    const socket = getRealtimeSocket();

    const rememberJob = (jobId: string) => {
      seenJobsRef.current.push(jobId);
      if (seenJobsRef.current.length > 200) {
        seenJobsRef.current.splice(0, seenJobsRef.current.length - 200);
      }
    };

    const hasSeenJob = (jobId: string) => seenJobsRef.current.includes(jobId);

    const handlePrintJob = async (payload: PrintJobPayload) => {
      const token = localStorage.getItem('token');
      if (!token || !payload?.orderId) {
        return;
      }

      const jobId =
        payload.jobId ||
        `${payload.source || 'print-job'}:${payload.orderId}:${payload.type || 'CLIENT'}`;

      if (hasSeenJob(jobId)) {
        return;
      }

      rememberJob(jobId);

      try {
        await printDesktopOrderReceipt({
          token,
          orderId: payload.orderId,
          type: payload.type || 'CLIENT',
          printerName: payload.printerName,
          paperWidth: payload.paperWidth,
          copies: payload.copies,
          openDrawer: payload.openDrawer,
          jobId,
          source: payload.source || 'realtime',
        });
      } catch (error: any) {
        const message =
          error?.response?.data?.message ||
          error?.message ||
          'No se pudo imprimir el ticket en la computadora principal';
        toast.error(message);
      }
    };

    socket.on('print.job', handlePrintJob);

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off('print.job', handlePrintJob);
    };
  }, [enabled]);
}
