import { describe, expect, it } from 'vitest';
import { extractTechnicalBlocks } from './technicalBlocks';

describe('extractTechnicalBlocks', () => {
  it('extracts tasks, tables, math and mermaid blocks', () => {
    const blocks = extractTechnicalBlocks(`- [ ] todo\n- [x] done\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n$$\nE = mc^2\n$$\n\n\`\`\`mermaid\nflowchart TD\n  A --> B\n\`\`\``);

    expect(blocks.tasks).toHaveLength(2);
    expect(blocks.tasks[1].checked).toBe(true);
    expect(blocks.tables[0].headers).toEqual(['A', 'B']);
    expect(blocks.mathBlocks[0].tex).toBe('E = mc^2');
    expect(blocks.mermaidBlocks[0].code).toContain('flowchart');
  });
});
