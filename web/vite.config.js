import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: app served by Vite at /panel/. Production: Django serves index.html at
// /panel/ while the hashed assets are collected to /static/panel/ (WhiteNoise),
// so the build must reference assets from /static/panel/.
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/static/panel/' : '/panel/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Forward API calls to Django in development so the SPA stays same-origin.
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
}));
