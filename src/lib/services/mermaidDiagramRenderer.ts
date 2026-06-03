import type { DiagramRenderer } from './render';

export function createMermaidDiagramRenderer(): DiagramRenderer {
  return {
    async renderMermaid(code, options) {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: options.theme === 'dark' ? 'dark' : 'default',
        });
        const id = `newmd-${hashText(code)}`;
        const result = await mermaid.render(id, code);
        return { svg: result.svg };
      } catch (error) {
        return {
          svg: '',
          error: error instanceof Error ? error.message : 'Mermaid 渲染失败',
        };
      }
    },
  };
}

function hashText(text: string): string {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}
