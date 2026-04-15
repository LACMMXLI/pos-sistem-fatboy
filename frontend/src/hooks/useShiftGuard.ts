import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShiftStore } from '@/store/shiftStore';
import { toast } from 'sonner';

export const useShiftGuard = () => {
  const navigate = useNavigate();
  const { activeShift, checkActiveShift } = useShiftStore();

  const requireShift = useCallback((redirectTo = '/shifts', showToast = true) => {
    if (!activeShift) {
      if (showToast) {
        toast.error('Necesitas abrir un turno de caja para continuar');
      }
      navigate(redirectTo);
      return false;
    }
    return true;
  }, [activeShift, navigate]);

  const requireNoShift = useCallback((showToast = false) => {
    if (activeShift) {
      if (showToast) {
        toast.warning('Ya tienes un turno de caja abierto');
      }
      return false;
    }
    return true;
  }, [activeShift]);

  return {
    activeShift,
    hasActiveShift: !!activeShift,
    checkActiveShift,
    requireShift,
    requireNoShift,
  };
};
