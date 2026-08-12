import { describe, expect, it } from 'vitest';
import { extractOutline } from './outlineService';
import { reorderOutlineSection } from './outlineReorder';

describe('reorderOutlineSection', () => {
  it('moves a whole subtree inside the target and adjusts every heading level', () => {
    const markdown = [
      '# Alpha',
      'alpha body',
      '## Alpha child',
      'child body',
      '# Beta',
      'beta body',
      '',
    ].join('\n');

    const result = reorderOutlineSection(markdown, extractOutline(markdown), {
      sourceIndex: 0,
      targetIndex: 2,
      placement: 'inside',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.markdown).toBe(
      ['# Beta', 'beta body', '## Alpha', 'alpha body', '### Alpha child', 'child body', ''].join(
        '\n',
      ),
    );
    expect(result.movedHeadingIndex).toBe(1);
  });

  it('moves sibling sections before and after regardless of source direction', () => {
    const markdown = '# One\none\n# Two\ntwo\n# Three\nthree\n';
    const outline = extractOutline(markdown);

    const after = reorderOutlineSection(markdown, outline, {
      sourceIndex: 0,
      targetIndex: 2,
      placement: 'after',
    });
    expect(after.ok && after.markdown).toBe('# Two\ntwo\n# Three\nthree\n# One\none\n');

    const before = reorderOutlineSection(markdown, outline, {
      sourceIndex: 2,
      targetIndex: 0,
      placement: 'before',
    });
    expect(before.ok && before.markdown).toBe('# Three\nthree\n# One\none\n# Two\ntwo\n');
  });

  it('preserves front matter, preamble, fenced pseudo headings, CRLF, handwritten numbers and EOF', () => {
    const markdown = [
      '---',
      'title: Sample',
      '---',
      'Preamble',
      '# 1. First',
      '```md',
      '# not a heading',
      '```',
      '# 2. Second',
      'last line',
    ].join('\r\n');
    const outline = extractOutline(markdown);
    const result = reorderOutlineSection(markdown, outline, {
      sourceIndex: 1,
      targetIndex: 0,
      placement: 'before',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.markdown).toBe(
      [
        '---',
        'title: Sample',
        '---',
        'Preamble',
        '# 2. Second',
        'last line',
        '# 1. First',
        '```md',
        '# not a heading',
        '```',
      ].join('\r\n'),
    );
    expect(result.markdown.endsWith('\r\n')).toBe(false);
  });

  it('returns an original-to-new index mapping for duplicate headings', () => {
    const markdown = '# Same\na\n# Same\nb\n# Same\nc\n';
    const result = reorderOutlineSection(markdown, extractOutline(markdown), {
      sourceIndex: 2,
      targetIndex: 0,
      placement: 'before',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.indexMap).toEqual([1, 2, 0]);
    expect(result.movedHeadingIndex).toBe(0);
  });

  it.each([
    [{ sourceIndex: 0, targetIndex: 0, placement: 'inside' as const }, 'self-or-descendant'],
    [{ sourceIndex: 0, targetIndex: 1, placement: 'after' as const }, 'self-or-descendant'],
    [{ sourceIndex: -1, targetIndex: 0, placement: 'before' as const }, 'invalid-index'],
  ])('rejects invalid move %o', (request, reason) => {
    const markdown = '# Parent\n## Child\n';
    expect(reorderOutlineSection(markdown, extractOutline(markdown), request)).toEqual({
      ok: false,
      reason,
    });
  });

  it('rejects H6 overflow and structural no-op moves', () => {
    const overflow = '##### Target\n##### Source\n###### Child\n';
    expect(
      reorderOutlineSection(overflow, extractOutline(overflow), {
        sourceIndex: 1,
        targetIndex: 0,
        placement: 'inside',
      }),
    ).toEqual({ ok: false, reason: 'heading-level-overflow' });

    const noChange = '# One\none\n# Two\ntwo\n';
    expect(
      reorderOutlineSection(noChange, extractOutline(noChange), {
        sourceIndex: 0,
        targetIndex: 1,
        placement: 'before',
      }),
    ).toEqual({ ok: false, reason: 'no-change' });
  });
});
