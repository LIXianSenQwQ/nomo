import { describe, expect, it } from 'vitest';
import { createMarkdownBridge } from './MarkdownBridge';

describe('MarkdownBridge', () => {
  it('round trips plain Markdown unchanged', () => {
    const bridge = createMarkdownBridge();
    const markdown = '# 标题\n\n- item';

    expect(bridge.serialize(bridge.parse(markdown))).toBe(markdown);
  });

  it('keeps front matter outside the editable body', () => {
    const bridge = createMarkdownBridge();
    const document = bridge.parse('---\ntitle: Demo\n---\n# Body');

    expect(document.frontMatter).toBe('---\ntitle: Demo\n---\n');
    expect(document.markdown).toBe('# Body');
    expect(bridge.serialize(document)).toBe('---\ntitle: Demo\n---\n# Body');
  });
});
