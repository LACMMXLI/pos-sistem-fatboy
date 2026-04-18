import { io, Socket } from 'socket.io-client';
import { getSocketUrl } from '../lib/runtime';
import { isDesktopRuntime } from '../lib/runtime';
import { useAuthStore } from '../store/authStore';

let socket: Socket | null = null;
let socketTargetUrl: string | null = null;

export const getRealtimeSocket = () => {
  const targetUrl = getSocketUrl();

  if (socket && socketTargetUrl !== targetUrl) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    socketTargetUrl = null;
  }

  if (!socket) {
    socket = io(targetUrl, {
      path: '/socket.io',
      autoConnect: false,
    });
    socketTargetUrl = targetUrl;
  }

  const token = isDesktopRuntime()
    ? useAuthStore.getState().token || localStorage.getItem('token')
    : localStorage.getItem('token');
  socket.auth = {
    token: token ?? undefined,
    clientType: isDesktopRuntime() ? 'desktop' : 'app',
  };

  return socket;
};
