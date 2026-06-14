import { describe, expect, it, vi } from 'vitest';
import {
  cleanEditorArtifacts,
  createExportHtmlDocument,
  inlineLocalImages,
} from './exportService';

// 模拟 tauriStorage 的 readFileAsBase64，避免在单元测试中调用 Tauri。
vi.mock('../../lib/desktop/tauriStorage', () => ({
  exportHtmlFile: vi.fn(),
  exportPdfFromHtml: vi.fn(),
  readFileAsBase64: vi.fn().mockResolvedValue({
    data_url: 'data:image/png;base64,MOCK',
    mime_type: 'image/png',
  }),
}));

describe('exportService', () => {
  it('createExportHtmlDocument 生成完整独立 HTML', () => {
    const html = createExportHtmlDocument('<p>hello</p>', 'Test', 'body{}');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>Test</title>');
    expect(html).toContain('body{}');
    expect(html).toContain('<p>hello</p>');
    expect(html).toContain('nomo-export');
  });

  it('createExportHtmlDocument 对标题进行 HTML 转义', () => {
    const html = createExportHtmlDocument('<p></p>', '<script>alert(1)</script>', '');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('cleanEditorArtifacts 移除图片全屏按钮和代码复制按钮', () => {
    const input = `
      <div class="prosemirror-host">
        <p>正文</p>
        <div class="image-node">
          <img src="./a.png" alt="a" />
          <button class="image-node-fullscreen-button">全屏</button>
        </div>
        <div class="code-card">
          <header>
            <span>ts</span>
            <button class="code-copy-button">复制</button>
          </header>
          <pre><code>const x = 1;</code></pre>
        </div>
      </div>
    `;
    const output = cleanEditorArtifacts(input);
    expect(output).toContain('正文');
    expect(output).toContain('<img');
    expect(output).not.toContain('image-node-fullscreen-button');
    expect(output).not.toContain('code-copy-button');
  });

  it('inlineLocalImages 保留 http/https/data 图片链接', async () => {
    const html = `
      <img src="https://example.com/a.png" />
      <img src="data:image/png;base64,ABC" />
      <img src="blob:abc" />
    `;
    const { html: result, warnings } = await inlineLocalImages(html, null);
    expect(result).toContain('https://example.com/a.png');
    expect(result).toContain('data:image/png;base64,ABC');
    expect(result).toContain('blob:abc');
    expect(warnings).toEqual([]);
  });

  it('inlineLocalImages 对未保存文档的相对路径给出 warning', async () => {
    const html = '<img src="./images/a.png" />';
    const { html: result, warnings } = await inlineLocalImages(html, null);
    expect(result).toContain('./images/a.png');
    expect(warnings.length).toBeGreaterThan(0);
  });
});
