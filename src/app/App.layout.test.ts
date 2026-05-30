import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('App outline layout', () => {
  const source = readFileSync(resolve(__dirname, 'App.svelte'), 'utf-8');

  it('keeps the document outline out of the document layout flow', () => {
    const documentLayouts = source.match(/<div class="document-layout">[\s\S]*?<\/div>/g) ?? [];

    expect(documentLayouts).toHaveLength(2);
    for (const layout of documentLayouts) {
      expect(layout).not.toContain('class="content-outline"');
    }
    expect(source).toMatch(/\.content-outline\s*\{[\s\S]*?position:\s*fixed;/);
    expect(source).toMatch(/\.editor-shell\s*\{[\s\S]*?container-type:\s*inline-size;/);
    expect(source).toMatch(/\.content-outline\s*\{[\s\S]*?right:\s*clamp\(32px,\s*3\.5cqw,\s*160px\);/);
    expect(source).not.toContain('7vw');
  });

  it('sizes the document content as a percentage of the editor shell', () => {
    expect(source).toContain('let contentWidthPercent = 68;');
    expect(source).toContain("{contentWidthPercent}%");
    expect(source).toMatch(/grid-template-columns:\s*minmax\(0,\s*calc\(var\(--md-editor-content-width-percent\) \* 1cqw\)\);/);
  });

  it('keeps outline navigation in the current editor mode', () => {
    const jumpStart = source.indexOf('function jumpToOutlineItem');
    const jumpEnd = source.indexOf('function updateActiveOutlineFromSourceScroll');
    const jumpSource = source.slice(jumpStart, jumpEnd);

    expect(jumpSource).not.toContain("setMode('source')");
    expect(jumpSource).toContain('activeOutlineId = item.id;');
  });

  it('renders one shared outline panel with expandable items', () => {
    expect(source.match(/<aside class="content-outline"/g)).toHaveLength(1);
    expect(source).toContain('toggleOutlineItemExpanded');
    expect(source).toContain('isOutlineItemVisible');
  });
});
