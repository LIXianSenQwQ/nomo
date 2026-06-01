import { describe, expect, it } from 'vitest';
import { parseMarkdown, serializeMarkdown } from './markdown';

describe('table Markdown editing', () => {
  it('round-trips GFM table alignment markers', () => {
    const markdown = '| A | B | C |\n| :--- | :---: | ---: |\n| x | y | z |';

    expect(serializeMarkdown(parseMarkdown(markdown))).toContain('| :--- | :---: | ---: |');
  });

  it('keeps table cell text during Markdown serialization', () => {
    const markdown = '| A | B |\n| :--- | :--- |\n| strong | code |';

    const serialized = serializeMarkdown(parseMarkdown(markdown));

    expect(serialized).toContain('| strong | code |');
  });
});
