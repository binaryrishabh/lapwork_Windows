
import path from 'path';
import { fileURLToPath } from 'url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: 'src',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // Explicitly point to the src folder using absolute paths
        main: path.resolve(__dirname, 'src/index.html'),
        mini: path.resolve(__dirname, 'src/mini.html'),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});