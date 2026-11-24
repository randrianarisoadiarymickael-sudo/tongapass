/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: process.env.VITE_DEV_API_TARGET ?? 'http://localhost:4100', changeOrigin: true } },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Découpage : bibliothèques stables en cache longue durée, code applicatif à part
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (/\/(react|react-dom|react-router|scheduler)\//.test(id)) return 'react';
          if (/\/(@tanstack|keycloak-js)\//.test(id)) return 'data';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
