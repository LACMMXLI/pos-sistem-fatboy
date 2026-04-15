import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return;
          }

          const normalizedId = id.replace(/\\/g, '/');

          if (
            normalizedId.includes('/react/') ||
            normalizedId.includes('/react-dom/') ||
            normalizedId.includes('/scheduler/') ||
            normalizedId.includes('/react-router/') ||
            normalizedId.includes('/react-router-dom/')
          ) {
            return 'react-vendor';
          }

          if (normalizedId.includes('/@tanstack/react-query/')) {
            return 'react-query';
          }

          if (
            normalizedId.includes('/framer-motion/') ||
            normalizedId.includes('/motion/') ||
            normalizedId.includes('/lucide-react/') ||
            normalizedId.includes('/sonner/')
          ) {
            return 'ui-vendor';
          }

          if (
            normalizedId.includes('/axios/') ||
            normalizedId.includes('/socket.io-client/') ||
            normalizedId.includes('/engine.io-client/')
          ) {
            return 'network-vendor';
          }

          if (
            normalizedId.includes('/zustand/') ||
            normalizedId.includes('/zod/') ||
            normalizedId.includes('/date-fns/') ||
            normalizedId.includes('/clsx/') ||
            normalizedId.includes('/tailwind-merge/')
          ) {
            return 'app-vendor';
          }

          return 'vendor';
        },
      },
    },
  },
});
