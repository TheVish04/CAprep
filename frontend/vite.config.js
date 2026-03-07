import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [
    react(),
  ],
  // Vite copies public/ to dist/ by default - sw.js and manifest.json are included
  publicDir: 'public',
});