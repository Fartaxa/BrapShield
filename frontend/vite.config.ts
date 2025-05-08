import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
  server: {
    host: '0.0.0.0', // Explicitly listen on all network interfaces
    port: 5173,
    strictPort: true,
    allowedHosts: ['brapshield.fartaxa.com'],
    hmr: {
      host: 'brapshield.fartaxa.com',
      protocol: 'wss'
    },
  },
});