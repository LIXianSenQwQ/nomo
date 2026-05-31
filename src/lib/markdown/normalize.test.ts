import { describe, expect, it } from 'vitest';
import { normalizeMarkdownForSave } from './normalize';

describe('normalizeMarkdownForSave', () => {
  it('保持已有尾空行不变', () => {
    const input = '# 标题\n\n正文\n\n';
    expect(normalizeMarkdownForSave(input)).toBe(input);
  });

  it('给单换行结尾补全为双换行', () => {
    const input = '# 标题\n\n正文\n';
    expect(normalizeMarkdownForSave(input)).toBe('# 标题\n\n正文\n\n');
  });

  it('给无换行结尾补全为双换行', () => {
    const input = '# 标题';
    expect(normalizeMarkdownForSave(input)).toBe('# 标题\n\n');
  });

  it('给尾部空格结尾补全为双换行', () => {
    const input = '# 标题    ';
    expect(normalizeMarkdownForSave(input)).toBe('# 标题\n\n');
  });

  it('已有双换行尾空行时保持原样', () => {
    const input = '# 标题\n\n正文\n\n\n\n';
    expect(normalizeMarkdownForSave(input)).toBe(input);
  });

  it('空字符串补全为双换行', () => {
    expect(normalizeMarkdownForSave('')).toBe('\n\n');
  });

  it('复杂 Markdown 文档补全尾空行', () => {
    const input = '---\ntitle: Test\n---\n\n# 标题\n\n段落内容\n\n```js\nconst x = 1;\n```';
    expect(normalizeMarkdownForSave(input)).toBe(input + '\n\n');
  });
});
