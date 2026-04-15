import { io, Socket } from 'socket.io-client';
import { getSocketUrl } from '../lib/runtime';
import { isDesktopRuntime } from '../lib/runtime';

let socket: Socket | null = null;

export const getRealtimeSocket = () => {
  if (!socket) {
    socket = io(getSocketUrl(), {
      path: '/socket.io',
      autoConnect: false,
    });
  }

  const token = localStorage.getItem('token');
  socket.auth = {
    token: token ?? undefined,
    clientType: isDesktopRuntime() ? 'desktop' : 'app',
  };

  return socket;
};
