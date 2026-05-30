import { describe, expect, it } from 'vitest';
import { createRichMarkdownSample, ensureEditableTrailingBlankLine, parseRichMarkdown } from './richMarkdown';

describe('rich markdown semantic rendering model', () => {
  it('parses the Markdown types required by the semantic renderer', () => {
    const blocks = parseRichMarkdown(createRichMarkdownSample());

    expect(blocks.some((block) => block.type === 'task' && block.checked)).toBe(true);
    expect(blocks.some((block) => block.type === 'task' && !block.checked)).toBe(true);
    expect(blocks.some((block) => block.type === 'table')).toBe(true);
    expect(blocks.some((block) => block.type === 'blockquote')).toBe(true);
    expect(blocks.some((block) => block.type === 'html')).toBe(true);
    expect(blocks.some((block) => block.type === 'paragraph' && block.text.includes('$a^2 + b^2 = c^2$'))).toBe(true);
    expect(blocks.some((block) => block.type === 'math')).toBe(true);
    expect(blocks.filter((block) => block.type === 'mermaid')).toHaveLength(2);
    expect(blocks.some((block) => block.type === 'code' && block.title === 'src/example.ts')).toBe(true);
    expect(blocks.some((block) => block.type === 'code' && block.isDiff)).toBe(true);
  });

  it('keeps a trailing blank line so a final code block never traps input', () => {
    expect(ensureEditableTrailingBlankLine('```ts\nconsole.log(1)\n```')).toBe('```ts\nconsole.log(1)\n```\n\n');
    expect(createRichMarkdownSample().endsWith('\n\n')).toBe(true);
  });
});
