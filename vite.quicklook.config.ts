import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  clearScreen: false,
  build: {
    outDir: 'src-tauri/target/quicklook-renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/quicklook/index.html'),
    },
  },
});
