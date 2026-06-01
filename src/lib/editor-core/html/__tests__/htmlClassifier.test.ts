import { describe, expect, it } from 'vitest';
import { classifyHtmlBlock, extractInlineAttrs } from '../htmlClassifier';

describe('htmlClassifier', () => {
  describe('classifyHtmlBlock — editable', () => {
    it('识别 section 为可编辑块', () => {
      const result = classifyHtmlBlock('<section class="demo">Hello</section>');
      expect(result.editable).toBe(true);
      expect(result.tag).toBe('section');
      expect(result.innerHTML).toBe('Hello');
      expect(result.attrs?.class).toBe('demo');
    });

    it('识别 div 为可编辑块', () => {
      const result = classifyHtmlBlock('<div id="main">Content here</div>');
      expect(result.editable).toBe(true);
      expect(result.tag).toBe('div');
      expect(result.innerHTML).toBe('Content here');
      expect(result.attrs?.id).toBe('main');
    });

    it('识别带 class 和 id 的块', () => {
      const result = classifyHtmlBlock('<section class="demo" id="hero">Text</section>');
      expect(result.editable).toBe(true);
      expect(result.attrs?.class).toBe('demo');
      expect(result.attrs?.id).toBe('hero');
    });

    it('识别带允许内联标签的块', () => {
      const result = classifyHtmlBlock('<section><strong>bold</strong> text</section>');
      expect(result.editable).toBe(true);
      expect(result.innerHTML).toContain('<strong>bold</strong>');
    });

    it('识别嵌套内联标签', () => {
      const result = classifyHtmlBlock('<div><em><strong>bold italic</strong></em></div>');
      expect(result.editable).toBe(true);
    });

    it('识别带 a 标签的块', () => {
      const result = classifyHtmlBlock('<div><a href="https://example.com">link</a></div>');
      expect(result.editable).toBe(true);
    });

    it('识别带 code 标签的块', () => {
      const result = classifyHtmlBlock('<section><code>var x = 1;</code></section>');
      expect(result.editable).toBe(true);
    });

    it('识别带 span 标签的块', () => {
      const result = classifyHtmlBlock('<section><span class="hi">text</span></section>');
      expect(result.editable).toBe(true);
    });

    it('识别空块', () => {
      const result = classifyHtmlBlock('<section></section>');
      expect(result.editable).toBe(true);
      expect(result.innerHTML).toBe('');
    });
  });

  describe('classifyHtmlBlock — fallback', () => {
    it('script 标签不可编辑', () => {
      const result = classifyHtmlBlock('<script>alert(1)</script>');
      expect(result.editable).toBe(false);
    });

    it('iframe 标签不可编辑', () => {
      const result = classifyHtmlBlock('<iframe src="x"></iframe>');
      expect(result.editable).toBe(false);
    });

    it('style 标签不可编辑', () => {
      const result = classifyHtmlBlock('<style>body{}</style>');
      expect(result.editable).toBe(false);
    });

    it('form 标签不可编辑', () => {
      const result = classifyHtmlBlock('<form><input/></form>');
      expect(result.editable).toBe(false);
    });

    it('input 标签不可编辑', () => {
      const result = classifyHtmlBlock('<div><input type="text"/></div>');
      expect(result.editable).toBe(false);
    });

    it('button 标签不可编辑', () => {
      const result = classifyHtmlBlock('<div><button>click</button></div>');
      expect(result.editable).toBe(false);
    });

    it('svg 标签不可编辑', () => {
      const result = classifyHtmlBlock('<section><svg></svg></section>');
      expect(result.editable).toBe(false);
    });

    it('on* 属性不可编辑', () => {
      const result = classifyHtmlBlock('<div onclick="alert(1)">x</div>');
      expect(result.editable).toBe(false);
    });

    it('javascript: 协议不可编辑', () => {
      const result = classifyHtmlBlock('<div><a href="javascript:alert(1)">x</a></div>');
      expect(result.editable).toBe(false);
    });

    it('未知内联标签导致 fallback', () => {
      const result = classifyHtmlBlock('<div><unknown-tag>content</unknown-tag></div>');
      expect(result.editable).toBe(false);
    });

    it('p 标签（非允许块标签）不可编辑', () => {
      const result = classifyHtmlBlock('<p>paragraph</p>');
      expect(result.editable).toBe(false);
    });

    it('article 标签（CommonMark 块标签但不在允许列表）不可编辑', () => {
      const result = classifyHtmlBlock('<article>content</article>');
      expect(result.editable).toBe(false);
    });

    it('table 标签不可编辑', () => {
      const result = classifyHtmlBlock('<table><tr><td>1</td></tr></table>');
      expect(result.editable).toBe(false);
    });

    it('空字符串不可编辑', () => {
      const result = classifyHtmlBlock('');
      expect(result.editable).toBe(false);
    });

    it('无闭标签不可编辑', () => {
      const result = classifyHtmlBlock('<div>unclosed');
      expect(result.editable).toBe(false);
    });
  });

  describe('extractInlineAttrs', () => {
    it('提取 href 属性', () => {
      const attrs = extractInlineAttrs('<a href="https://example.com">', 'a');
      expect(attrs.href).toBe('https://example.com');
    });

    it('提取 title 属性', () => {
      const attrs = extractInlineAttrs('<a href="/" title="Home">', 'a');
      expect(attrs.title).toBe('Home');
    });

    it('提取 class 和 id', () => {
      const attrs = extractInlineAttrs('<span class="highlight" id="s1">', 'span');
      expect(attrs.class).toBe('highlight');
      expect(attrs.id).toBe('s1');
    });
  });
});
