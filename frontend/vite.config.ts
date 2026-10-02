import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Forward API calls to the backend during development (npm run dev in backend/).
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
