import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Quick Look 扩展运行在沙盒中，无法改写自身 bundle 目录；
// 这里把 JS/CSS/字体全部内联成单个自包含 HTML，由 Swift 侧注入数据后直接用 loadHTMLString 加载。
export default defineConfig({
  base: './',
  clearScreen: false,
  plugins: [viteSingleFile()],
  build: {
    outDir: 'src-tauri/target/quicklook-renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/quicklook/index.html'),
    },
  },
});
