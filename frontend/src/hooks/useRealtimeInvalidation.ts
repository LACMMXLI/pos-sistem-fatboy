import { useEffect } from 'react';
import { queryClient } from '../lib/queryClient';
import { queryKeys } from '../lib/queryKeys';
import { getRealtimeSocket } from '../services/realtime';

const invalidateOperationalData = () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.orders });
  queryClient.invalidateQueries({ queryKey: queryKeys.kitchenOrders });
  queryClient.invalidateQueries({ queryKey: queryKeys.tables });
  queryClient.invalidateQueries({ queryKey: queryKeys.tablesList });
  queryClient.invalidateQueries({ queryKey: queryKeys.deliveries });
  queryClient.invalidateQueries({ queryKey: queryKeys.activeShift });
  queryClient.invalidateQueries({ queryKey: queryKeys.activeShiftSummary });
};

export function useRealtimeInvalidation(enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const socket = getRealtimeSocket();
    const handleOperationalUpdate = () => invalidateOperationalData();

    socket.on('order.created', handleOperationalUpdate);
    socket.on('order.updated', handleOperationalUpdate);
    socket.on('payment.created', handleOperationalUpdate);
    socket.on('table.updated', handleOperationalUpdate);

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off('order.created', handleOperationalUpdate);
      socket.off('order.updated', handleOperationalUpdate);
      socket.off('payment.created', handleOperationalUpdate);
      socket.off('table.updated', handleOperationalUpdate);
      socket.disconnect();
    };
  }, [enabled]);
}
