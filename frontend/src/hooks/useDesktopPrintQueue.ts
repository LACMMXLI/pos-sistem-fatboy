import { useEffect, useState } from 'react';
import {
  DesktopPrintQueueEntry,
  getDesktopPrintQueue,
  isDesktopRuntime,
  subscribeDesktopPrintQueue,
} from '../lib/runtime';

export function useDesktopPrintQueue(enabled: boolean) {
  const [queue, setQueue] = useState<DesktopPrintQueueEntry[]>([]);
  const [loading, setLoading] = useState(enabled && isDesktopRuntime());

  useEffect(() => {
    if (!enabled || !isDesktopRuntime()) {
      setQueue([]);
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadQueue = async () => {
      setLoading(true);
      const snapshot = await getDesktopPrintQueue();
      if (mounted) {
        setQueue(snapshot);
        setLoading(false);
      }
    };

    void loadQueue();
    const unsubscribe = subscribeDesktopPrintQueue((snapshot) => {
      if (mounted) {
        setQueue(snapshot);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [enabled]);

  return { queue, loading };
}
