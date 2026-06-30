import { describe, expect, it, vi } from 'vitest';
import { createMermaidDiagramRenderer } from './mermaidDiagramRenderer';

const mermaidMock = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(async (_id: string, code: string) => ({ svg: `<svg>${code}</svg>` })),
}));

vi.mock('mermaid', () => ({
  default: mermaidMock,
}));

describe('createMermaidDiagramRenderer', () => {
  it('reuses Mermaid initialization for the same theme and reinitializes on theme changes', async () => {
    const renderer = createMermaidDiagramRenderer();

    await renderer.renderMermaid('flowchart TD\n  A --> B', { theme: 'light' });
    await renderer.renderMermaid('flowchart TD\n  B --> C', { theme: 'light' });
    await renderer.renderMermaid('flowchart TD\n  C --> D', { theme: 'dark' });

    expect(mermaidMock.initialize).toHaveBeenCalledTimes(2);
    expect(mermaidMock.initialize).toHaveBeenNthCalledWith(1, {
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'default',
    });
    expect(mermaidMock.initialize).toHaveBeenNthCalledWith(2, {
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'dark',
    });
    expect(mermaidMock.render).toHaveBeenCalledTimes(3);
  });
});
