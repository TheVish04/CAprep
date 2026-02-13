import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // Vite copies public/ to dist/ by default - sw.js and manifest.json are included
  publicDir: 'public',
});