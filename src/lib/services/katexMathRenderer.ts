import katex from 'katex';
import type { MathRenderer } from './render';

export function createKatexMathRenderer(): MathRenderer {
  return {
    async render(tex, options) {
      try {
        return {
          html: katex.renderToString(tex, {
            displayMode: options.displayMode,
            throwOnError: false,
            strict: 'ignore'
          })
        };
      } catch (error) {
        return {
          html: '',
          error: error instanceof Error ? error.message : '公式渲染失败'
        };
      }
    }
  };
}
