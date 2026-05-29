import { describe, expect, it } from 'vitest';
import { createKatexMathRenderer } from './katexMathRenderer';

describe('createKatexMathRenderer', () => {
  it('renders valid TeX to KaTeX HTML', async () => {
    const renderer = createKatexMathRenderer();

    const result = await renderer.render('E = mc^2', { displayMode: true });

    expect(result.error).toBeUndefined();
    expect(result.html).toContain('katex');
  });
});
