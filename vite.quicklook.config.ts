import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Quick Look 扩展运行在沙盒中，无法改写自身 bundle 目录；
// 这里把 JS/CSS/字体和 Mermaid 图表模块全部内联成单个自包含 HTML，Swift 从签名 bundle
// 直接加载该静态文件，再通过 WebKit 结构化参数桥传入 Markdown，避免运行时外部资源依赖。
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
