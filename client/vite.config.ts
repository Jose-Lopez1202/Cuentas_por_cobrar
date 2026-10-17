import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // El cliente usa el código fuente (ESM) de @erp/contracts en vez de su build CommonJS:
      // así Vite ve todas las constantes/funciones exportadas y no hay que re-exportarlas a mano.
      '@erp/contracts': fileURLToPath(new URL('../packages/contracts/src/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
});
