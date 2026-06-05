import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './renderer'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, './renderer/dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, './renderer/index.html'),
      },
    },
  },
  server: {
    port: 5173,
    open: false,
    cors: true,
  },
});