import type { DiagramRenderer } from './render';

type MermaidApi = typeof import('mermaid').default;

let mermaidPromise: Promise<MermaidApi> | null = null;
let initializedTheme: 'default' | 'dark' | null = null;

export function createMermaidDiagramRenderer(): DiagramRenderer {
  return {
    async renderMermaid(code, options) {
      try {
        const mermaid = await loadMermaid(options.theme === 'dark' ? 'dark' : 'default');
        const id = `nomo-${hashText(code)}`;
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

async function loadMermaid(theme: 'default' | 'dark'): Promise<MermaidApi> {
  mermaidPromise ??= import('mermaid').then((module) => module.default);
  const mermaid = await mermaidPromise;
  if (initializedTheme !== theme) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme,
    });
    initializedTheme = theme;
  }
  return mermaid;
}

function hashText(text: string): string {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}
