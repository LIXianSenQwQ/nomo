import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('App outline layout', () => {
  const appSource = readFileSync(resolve(__dirname, 'App.svelte'), 'utf-8');
  const editorSource = readFileSync(resolve(__dirname, 'components/EditorWorkspace.svelte'), 'utf-8');
  const styles = readFileSync(resolve(__dirname, 'styles/app.css'), 'utf-8');

  it('keeps the document outline out of the document layout flow', () => {
    const documentLayouts = editorSource.match(/<div class="document-layout">[\s\S]*?<\/div>/g) ?? [];

    expect(documentLayouts).toHaveLength(2);
    for (const layout of documentLayouts) {
      expect(layout).not.toContain('class="content-outline"');
    }
    expect(styles).toMatch(/\.content-outline\s*\{[\s\S]*?position:\s*fixed;/);
    expect(styles).toMatch(/\.editor-shell\s*\{[\s\S]*?container-type:\s*inline-size;/);
    expect(styles).toMatch(/\.content-outline\s*\{[\s\S]*?right:\s*clamp\(32px,\s*3\.5cqw,\s*160px\);/);
    expect(styles).not.toContain('7vw');
  });

  it('sizes the document content as a percentage of the editor shell', () => {
    expect(appSource).toContain('let contentWidthPercent = 68;');
    expect(appSource).toContain('{contentWidthPercent}');
    expect(styles).toMatch(/grid-template-columns:\s*minmax\(0,\s*calc\(var\(--md-editor-content-width-percent\) \* 1cqw\)\);/);
  });

  it('keeps outline navigation in the current editor mode', () => {
    const jumpStart = appSource.indexOf('function jumpToOutlineItem');
    const jumpEnd = appSource.indexOf('function updateActiveOutlineFromSourceScroll');
    const jumpSource = appSource.slice(jumpStart, jumpEnd);

    expect(jumpSource).not.toContain("setMode('source')");
    expect(jumpSource).toContain('activeOutlineId = item.id;');
    expect(jumpSource).toContain('scrollSemanticToAnchor(outline, semanticPane');
  });

  it('keeps source typing from normalizing content or resetting scroll', () => {
    const updateStart = appSource.indexOf('function updateMarkdown');
    const updateEnd = appSource.indexOf('function runCommand');
    const updateSource = appSource.slice(updateStart, updateEnd);

    expect(updateSource).not.toContain('normalizeMarkdownForSave');
    expect(updateSource).toContain('pendingSourceScrollTop = sourcePane?.scrollTop ?? null;');
    expect(updateSource).toContain('editor.setMarkdown((event.currentTarget as HTMLTextAreaElement).value);');
    expect(appSource).toContain('sourcePane.scrollTop = restoreScrollTop;');
  });

  it('renders one shared outline panel with expandable items', () => {
    expect(editorSource.match(/<aside class="content-outline"/g)).toHaveLength(1);
    expect(editorSource).toContain('export let collapsedOutlineIds');
    expect(editorSource).toContain('export let visibleOutlineIds');
    expect(appSource).toContain('{collapsedOutlineIds}');
    expect(appSource).toContain('{visibleOutlineIds}');
    expect(editorSource).toContain('toggleOutlineItemExpanded');
    expect(editorSource).toContain('visibleOutlineIds.has(item.id)');
    expect(editorSource).toContain('handleOutlineToggle(event, item)');
    expect(editorSource).toContain('{#each outline as item, index (item.id)}');
  });
});
