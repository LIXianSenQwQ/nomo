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

  it('cleanEditorArtifacts 将 .image-node 的对齐样式迁移到 <img>', () => {
    const input = `
      <div class="image-node" style="display: block; margin-left: auto; margin-right: auto;">
        <img src="./a.png" alt="居中" style="width: 400px;" />
      </div>
      <div class="image-node" style="display: block; margin-left: auto; margin-right: 0px;">
        <img src="./b.png" alt="右对齐" />
      </div>
      <div class="image-node">
        <img src="./c.png" alt="无对齐" />
      </div>
    `;
    const output = cleanEditorArtifacts(input);

    // 居中图片：margin-left/margin-right 应为 auto（style 顺序由浏览器决定，分别断言）
    expect(output).toContain('margin-left: auto');
    expect(output).toContain('margin-right: auto');
    expect(output).toContain('width: 400px;');

    // 右对齐图片：margin-left 应为 auto
    expect(output).toContain('margin-left: auto; margin-right: 0px;');

    // 无对齐图片：不应有额外的 margin 样式
    expect(output).toContain('<img src="./c.png" alt="无对齐">');

    // 不应残留 .image-node wrapper
    expect(output).not.toContain('image-node');
  });

  it('inlineLocalImages 保留 data/blob 图片链接，对 http/https 尝试转 base64', async () => {
    const originalFetch = globalThis.fetch;
    // 模拟 fetch 返回图片 blob
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () =>
        Promise.resolve(new Blob(['fake-png'], { type: 'image/png' })),
    });

    try {
      const html = `
        <img src="https://example.com/a.png" />
        <img src="data:image/png;base64,ABC" />
        <img src="blob:abc" />
      `;
      const { html: result, warnings } = await inlineLocalImages(html, null);
      // data: 和 blob: 保持原样
      expect(result).toContain('data:image/png;base64,ABC');
      expect(result).toContain('blob:abc');
      // https:// 远程图片被转换为 base64 data URL
      expect(result).toContain('data:');
      expect(result).not.toContain('https://example.com/a.png');
      expect(warnings).toEqual([]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('inlineLocalImages 对未保存文档的相对路径给出 warning', async () => {
    const html = '<img src="./images/a.png" />';
    const { html: result, warnings } = await inlineLocalImages(html, null);
    expect(result).toContain('./images/a.png');
    expect(warnings.length).toBeGreaterThan(0);
  });
});
