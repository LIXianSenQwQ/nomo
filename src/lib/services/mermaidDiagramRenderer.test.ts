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

    await renderer.renderMermaid('flowchart TD\n  A --> B', { theme: { theme: 'default' } });
    await renderer.renderMermaid('flowchart TD\n  B --> C', { theme: { theme: 'default' } });
    await renderer.renderMermaid('flowchart TD\n  C --> D', { theme: { theme: 'dark' } });

    expect(mermaidMock.initialize).toHaveBeenCalledTimes(2);
    expect(mermaidMock.initialize).toHaveBeenNthCalledWith(1, {
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'default',
      themeVariables: undefined,
    });
    expect(mermaidMock.initialize).toHaveBeenNthCalledWith(2, {
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'dark',
      themeVariables: undefined,
    });
    expect(mermaidMock.render).toHaveBeenCalledTimes(3);
    const renderIds = mermaidMock.render.mock.calls.map(([id]) => id);
    expect(new Set(renderIds).size).toBe(3);
  });
});
