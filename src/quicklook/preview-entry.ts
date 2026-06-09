import 'katex/dist/katex.min.css';
import './preview.css';
import { renderMarkdownPreview, type QuickLookPreviewPayload } from './preview';

declare global {
  interface Window {
    __NOMO_QUICKLOOK_PAYLOAD__?: QuickLookPreviewPayload | null;
  }
}

function mountQuickLookPreview() {
  const root = document.getElementById('quicklook-root');
  if (!root) return;

  const payload = window.__NOMO_QUICKLOOK_PAYLOAD__;
  if (!payload?.markdown) {
    root.innerHTML = `
      <section class="quicklook-empty">
        <strong>无法生成预览</strong>
        <span>Quick Look 没有收到可渲染的 Markdown 内容。</span>
      </section>
    `;
    return;
  }

  root.innerHTML = renderMarkdownPreview(payload.markdown, {
    fileName: payload.fileName,
    documentDirectory: payload.documentDirectory,
  });
}

mountQuickLookPreview();
