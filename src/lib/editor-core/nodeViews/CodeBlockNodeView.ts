import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { DecorationSet } from 'prosemirror-view';
import type { EditorView } from 'prosemirror-view';
import { buildCodeDecorations, codeHighlightKey } from '../plugins/codeHighlight';
import { getCodeTokenizer, getDiagramRenderer } from '../renderers';
import { escapeHtml } from '../utils/html';

export class CodeBlockNodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private node: ProseMirrorNode;
  private view: EditorView;
  private getPos: () => number;
  private language: string;
  private langLabel: HTMLElement;
  private diagramContainer: HTMLElement | null = null;
  private previewBtn: HTMLButtonElement | null = null;
  private previewVisible = false;
  private codePre: HTMLElement;
  private lineNumbersGutter: HTMLElement;
  private codeBody: HTMLElement;

  constructor(node: ProseMirrorNode, view: EditorView, getPos: () => number) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;
    this.language = node.attrs.params ?? '';

    this.dom = document.createElement('section');
    this.dom.className = 'code-card';

    const header = document.createElement('header');
    this.langLabel = document.createElement('span');
    this.langLabel.textContent = this.language || 'code';
    header.appendChild(this.langLabel);

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '6px';

    if (this.language === 'mermaid') {
      this.previewBtn = document.createElement('button');
      this.previewBtn.type = 'button';
      this.previewBtn.title = '切换图表预览';
      this.previewBtn.textContent = '预览';
      this.previewBtn.addEventListener('click', (event) => { event.stopPropagation(); this.togglePreview(); });
      actions.appendChild(this.previewBtn);
    }

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.title = '复制代码';
    copyBtn.textContent = '复制';
    copyBtn.addEventListener('click', (event) => { event.stopPropagation(); this.copyCode(); });
    actions.appendChild(copyBtn);
    header.appendChild(actions);
    this.dom.appendChild(header);

    this.codeBody = document.createElement('div');
    this.codeBody.className = 'code-body';

    this.lineNumbersGutter = document.createElement('div');
    this.lineNumbersGutter.className = 'line-numbers-gutter';
    this.codeBody.appendChild(this.lineNumbersGutter);

    this.codePre = document.createElement('pre');
    this.codePre.className = 'code-content';
    this.contentDOM = document.createElement('code');
    this.codePre.appendChild(this.contentDOM);
    this.codeBody.appendChild(this.codePre);
    this.dom.appendChild(this.codeBody);

    this.scheduleHighlight();
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.language = node.attrs.params ?? '';
    this.langLabel.textContent = this.language || 'code';
    this.scheduleHighlight();
    if (this.previewVisible) this.renderDiagram();
    return true;
  }

  selectNode(): void {
    this.dom.classList.add('ProseMirror-selectednode');
  }

  deselectNode(): void {
    this.dom.classList.remove('ProseMirror-selectednode');
  }

  stopEvent(event: Event): boolean {
    return (event.target as HTMLElement).closest('button') !== null;
  }

  ignoreMutation(): boolean {
    return false;
  }

  private scheduleHighlight(): void {
    requestAnimationFrame(() => this.applyHighlight());
  }

  private updateLineNumbers(): void {
    const lineCount = this.node.textContent.split('\n').length;
    const currentCount = this.lineNumbersGutter.children.length;
    if (currentCount !== lineCount) {
      this.lineNumbersGutter.innerHTML = '';
      for (let i = 1; i <= lineCount; i++) {
        const span = document.createElement('span');
        span.textContent = String(i);
        this.lineNumbersGutter.appendChild(span);
      }
    }
  }

  private async applyHighlight(): Promise<void> {
    this.updateLineNumbers();
    if (this.language === 'diff') {
      this.codePre.classList.add('diff-mode');
    } else {
      this.codePre.classList.remove('diff-mode');
    }
    if (this.language === 'mermaid') return;
    const codeTokenizer = getCodeTokenizer();
    if (!codeTokenizer) return;
    try {
      const result = await codeTokenizer.tokenize({ code: this.node.textContent, language: this.language, theme: 'dark' });
      const decoArray = buildCodeDecorations(result.tokens, this.getPos() + 1);
      const decoSet = DecorationSet.create(this.view.state.doc, decoArray);
      this.view.dispatch(this.view.state.tr.setMeta(codeHighlightKey, decoSet));
    } catch {
      this.view.dispatch(this.view.state.tr.setMeta(codeHighlightKey, DecorationSet.empty));
    }
  }

  private togglePreview(): void {
    if (this.previewVisible) {
      this.hidePreview();
    } else {
      this.showPreview();
    }
  }

  private showPreview(): void {
    if (!getDiagramRenderer()) return;
    this.previewVisible = true;
    if (this.previewBtn) this.previewBtn.textContent = '源码';
    this.codePre.style.display = 'none';
    this.lineNumbersGutter.style.display = 'none';
    this.renderDiagram();
  }

  private hidePreview(): void {
    this.previewVisible = false;
    if (this.previewBtn) this.previewBtn.textContent = '预览';
    if (this.diagramContainer) {
      this.diagramContainer.remove();
      this.diagramContainer = null;
    }
    this.codePre.style.display = '';
    this.lineNumbersGutter.style.display = '';
  }

  private async renderDiagram(): Promise<void> {
    const diagramRenderer = getDiagramRenderer();
    if (!diagramRenderer) return;
    if (!this.diagramContainer) {
      this.diagramContainer = document.createElement('div');
      this.diagramContainer.className = 'mermaid-block';
      this.diagramContainer.style.padding = '24px';
      this.diagramContainer.style.overflow = 'auto';
      this.dom.appendChild(this.diagramContainer);
    }
    try {
      const result = await diagramRenderer.renderMermaid(this.node.textContent, { theme: 'light' });
      if (result.error) {
        this.diagramContainer.innerHTML = `<div class="mermaid-error" style="padding:16px;color:var(--md-editor-warning);font-size:13px;">图表渲染失败：${escapeHtml(result.error)}</div>`;
      } else if (result.svg) {
        this.diagramContainer.innerHTML = result.svg;
      }
    } catch {
      this.diagramContainer.innerHTML = '<div class="mermaid-error" style="padding:16px;color:var(--md-editor-warning);font-size:13px;">图表渲染异常</div>';
    }
  }

  private copyCode(): void {
    const text = this.node.textContent;
    navigator.clipboard.writeText(text).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    });
  }

  destroy(): void { }
}
