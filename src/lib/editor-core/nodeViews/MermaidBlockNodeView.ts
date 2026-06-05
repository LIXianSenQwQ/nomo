import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { NodeSelection, TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { getDiagramRenderer } from '../renderers';

/**
 * Mermaid 图表块 NodeView。
 *
 * 职责：
 * 1. 常态把 Mermaid 源码渲染为 SVG 图表；
 * 2. 点击图表进入源码编辑态；
 * 3. 编辑态保持“源码在上、预览在下”的稳定布局。
 */
export class MermaidBlockNodeView {
  private static instances = new Set<MermaidBlockNodeView>();

  dom: HTMLElement;

  private node: ProseMirrorNode;
  private view: EditorView;
  private getPos: () => number;
  private renderId = 0;
  private editing = false;
  private originalCode = '';
  private textarea: HTMLTextAreaElement | null = null;
  private previewEl: HTMLElement | null = null;
  private suppressNextSelectAutoEdit = false;

  constructor(node: ProseMirrorNode, view: EditorView, getPos: () => number) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;
    MermaidBlockNodeView.instances.add(this);

    this.dom = document.createElement('div');
    this.dom.className = 'mermaid-block';
    this.dom.contentEditable = 'false';
    this.dom.setAttribute('data-code', node.attrs.code as string);

    this.dom.addEventListener('click', (event) => {
      if (this.editing) return;
      event.preventDefault();
      event.stopPropagation();
      this.enterEdit();
    });

    this.renderMermaid();
  }

  static updateTheme(): void {
    for (const instance of MermaidBlockNodeView.instances) {
      if (!instance.editing) {
        instance.renderMermaid();
      } else {
        void instance.updatePreview();
      }
    }
  }

  static enterEditAt(view: EditorView, pos: number, caret: 'start' | 'end' = 'start'): boolean {
    for (const instance of MermaidBlockNodeView.instances) {
      if (instance.view !== view) continue;
      if (instance.getPos() === pos) {
        instance.enterEdit(caret);
        return true;
      }
    }
    return false;
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    if (!this.editing) {
      this.renderMermaid();
    }
    return true;
  }

  selectNode(): void {
    this.dom.classList.add('ProseMirror-selectednode');
    if (this.editing) {
      this.dom.classList.remove('ProseMirror-selectednode');
      return;
    }
    if (this.suppressNextSelectAutoEdit) {
      this.suppressNextSelectAutoEdit = false;
    }
  }

  deselectNode(): void {
    this.dom.classList.remove('ProseMirror-selectednode');
    if (this.editing) {
      this.exitEdit(true, 'preserve');
    }
  }

  stopEvent(event: Event): boolean {
    if (this.editing && this.dom.contains(event.target as Node)) return true;
    return false;
  }

  ignoreMutation(): boolean {
    return true;
  }

  destroy(): void {
    this.cleanupEdit();
    MermaidBlockNodeView.instances.delete(this);
  }

  private async renderMermaid(): Promise<void> {
    const id = ++this.renderId;
    const code = this.node.attrs.code as string;
    this.dom.setAttribute('data-code', code);

    if (!code.trim()) {
      this.dom.textContent = '';
      return;
    }

    const renderer = getDiagramRenderer();
    if (!renderer) {
      this.dom.textContent = `\`\`\`mermaid\n${code}\n\`\`\``;
      return;
    }

    try {
      const result = await renderer.renderMermaid(code, { theme: this.getTheme() });
      if (id !== this.renderId) return;
      if (result.error) {
        this.renderError(result.error, code);
      } else {
        this.dom.innerHTML = result.svg;
      }
    } catch (error) {
      if (id !== this.renderId) return;
      this.renderError(error instanceof Error ? error.message : 'Mermaid 渲染失败', code);
    }
  }

  private enterEdit(caret: 'start' | 'end' = 'start'): void {
    if (this.editing) return;
    this.editing = true;
    this.originalCode = this.node.attrs.code as string;
    this.dom.classList.add('is-editing');
    this.dom.classList.remove('ProseMirror-selectednode');
    this.dom.textContent = '';

    this.textarea = document.createElement('textarea');
    this.textarea.className = 'mermaid-block-textarea';
    this.textarea.value = this.originalCode;
    this.textarea.rows = Math.max(4, this.originalCode.split('\n').length);
    this.textarea.spellcheck = false;
    this.dom.appendChild(this.textarea);

    this.previewEl = document.createElement('div');
    this.previewEl.className = 'mermaid-block-preview';
    this.dom.appendChild(this.previewEl);

    this.textarea.addEventListener('input', () => {
      this.autoResizeTextarea();
      void this.updatePreview();
    });
    this.textarea.addEventListener('keydown', (event) => this.handleKeyDown(event));
    this.textarea.addEventListener('blur', () => {
      this.exitEdit(true);
    });

    void this.updatePreview();

    requestAnimationFrame(() => {
      if (!this.textarea) return;
      this.textarea.focus({ preventScroll: true });
      const pos = caret === 'end' ? this.textarea.value.length : 0;
      this.textarea.setSelectionRange(pos, pos);
    });
  }

  private exitEdit(save: boolean, selection: 'node' | 'before' | 'after' | 'preserve' = 'node'): void {
    if (!this.editing) return;

    const newCode = save && this.textarea ? this.textarea.value : this.originalCode;
    const oldCode = this.node.attrs.code as string;
    const pos = this.getPos();

    this.cleanupEdit();

    let tr = this.view.state.tr;
    if (save && newCode !== oldCode) {
      tr = tr.setNodeMarkup(pos, null, { code: newCode });
    }

    if (selection === 'before') {
      tr = tr.setSelection(TextSelection.near(tr.doc.resolve(pos), -1));
    } else if (selection === 'after') {
      const nextPos = Math.min(pos + this.node.nodeSize, tr.doc.content.size);
      tr = tr.setSelection(TextSelection.near(tr.doc.resolve(nextPos), 1));
    } else if (selection === 'node') {
      this.suppressNextSelectAutoEdit = true;
      tr = tr.setSelection(NodeSelection.create(tr.doc, pos));
    }

    if (tr.docChanged || selection !== 'preserve') {
      this.view.dispatch(tr);
    }
    if (selection === 'before' || selection === 'after') {
      this.view.focus();
    }
  }

  private cleanupEdit(): void {
    this.editing = false;
    this.dom.classList.remove('is-editing');
    this.textarea = null;
    this.previewEl = null;
    void this.renderMermaid();
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.textarea) return;

    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && event.shiftKey) {
      event.preventDefault();
      const pos = this.getPos();
      this.exitEdit(true, 'preserve');
      const paragraph = this.view.state.schema.nodes.paragraph.create();
      const tr = this.view.state.tr.insert(pos, paragraph);
      this.view.dispatch(tr.setSelection(TextSelection.create(tr.doc, pos + 1)));
      this.view.focus();
      return;
    }

    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      const pos = this.getPos();
      this.exitEdit(true, 'preserve');
      const afterPos = pos + this.node.nodeSize;
      if (afterPos <= this.view.state.doc.content.size) {
        const paragraph = this.view.state.schema.nodes.paragraph.create();
        const tr = this.view.state.tr.insert(afterPos, paragraph);
        this.view.dispatch(tr.setSelection(TextSelection.create(tr.doc, afterPos + 1)));
        this.view.focus();
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.exitEdit(false);
      return;
    }

    if (event.key === 'ArrowDown' && !event.shiftKey) {
      const { selectionStart, value } = this.textarea;
      if (!value.slice(selectionStart).includes('\n')) {
        event.preventDefault();
        this.exitEdit(true, 'after');
      }
      return;
    }

    if (event.key === 'ArrowUp' && !event.shiftKey) {
      const { selectionStart, value } = this.textarea;
      if (!value.slice(0, selectionStart).includes('\n')) {
        event.preventDefault();
        this.exitEdit(true, 'before');
      }
    }
  }

  private autoResizeTextarea(): void {
    if (!this.textarea) return;
    this.textarea.rows = Math.max(4, this.textarea.value.split('\n').length);
  }

  private async updatePreview(): Promise<void> {
    if (!this.previewEl || !this.textarea) return;
    const code = this.textarea.value;
    const renderer = getDiagramRenderer();
    if (!code.trim()) {
      this.previewEl.textContent = '';
      return;
    }
    if (!renderer) {
      this.previewEl.textContent = '(diagram renderer unavailable)';
      return;
    }

    try {
      const result = await renderer.renderMermaid(code, { theme: this.getTheme() });
      if (!this.editing || !this.previewEl) return;
      if (result.error) {
        this.previewEl.textContent = result.error;
        this.previewEl.classList.add('is-error');
      } else {
        this.previewEl.innerHTML = result.svg;
        this.previewEl.classList.remove('is-error');
      }
    } catch (error) {
      if (!this.editing || !this.previewEl) return;
      this.previewEl.textContent = error instanceof Error ? error.message : 'Mermaid 渲染失败';
      this.previewEl.classList.add('is-error');
    }
  }

  private renderError(error: string, code: string): void {
    this.dom.textContent = '';
    const errorEl = document.createElement('div');
    errorEl.className = 'mermaid-block-error';
    errorEl.textContent = error;
    const sourceEl = document.createElement('pre');
    sourceEl.className = 'mermaid-block-source';
    sourceEl.textContent = `\`\`\`mermaid\n${code}\n\`\`\``;
    this.dom.append(errorEl, sourceEl);
  }

  private getTheme(): 'light' | 'dark' {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }
}
