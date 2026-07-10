import { describe, expect, it, vi } from 'vitest';
import { openDocumentByPath } from './documentRouter';

describe('openDocumentByPath', () => {
  it.each(['note.md', 'note.markdown'])('opens %s only through the Markdown port', async (path) => {
    const openMarkdown = vi.fn().mockResolvedValue({ markdown: '# note' });
    const openSegmented = vi.fn();

    const result = await openDocumentByPath(path, { openMarkdown, openSegmented });

    expect(result).toEqual({ documentKind: 'markdown', value: { markdown: '# note' } });
    expect(openMarkdown).toHaveBeenCalledWith(path);
    expect(openSegmented).not.toHaveBeenCalled();
  });

  it.each([
    ['large.txt', 'text'],
    ['data.JSON', 'json'],
  ] as const)('opens %s only through the segmented port', async (path, documentKind) => {
    const openMarkdown = vi.fn();
    const openSegmented = vi.fn().mockResolvedValue({ sessionId: 'session-1' });

    const result = await openDocumentByPath(path, { openMarkdown, openSegmented });

    expect(result).toEqual({ documentKind, value: { sessionId: 'session-1' } });
    expect(openMarkdown).not.toHaveBeenCalled();
    expect(openSegmented).toHaveBeenCalledWith(path, documentKind);
  });

  it('rejects unsupported files before either storage port runs', async () => {
    const ports = { openMarkdown: vi.fn(), openSegmented: vi.fn() };

    await expect(openDocumentByPath('table.csv', ports)).rejects.toThrow(/unsupported/i);
    expect(ports.openMarkdown).not.toHaveBeenCalled();
    expect(ports.openSegmented).not.toHaveBeenCalled();
  });
});
