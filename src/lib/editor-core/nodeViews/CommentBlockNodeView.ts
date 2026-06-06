import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { NodeSelection, TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { registerActiveEdit, unregisterActiveEdit } from './activeEditRegistry';

/** 块级 Markdown 注释 NodeView：展示为低调卡片，点击后编辑完整注释内容。 */
export class CommentBlockNodeView {
  private static instantEditMode = false;

  dom: HTMLElement;

  private node: ProseMirrorNode;
  private view: EditorView;
  private getPos: () => number;
  private editing = false;
  private originalContent = '';
  private textarea: HTMLTextAreaElement | null = null;
  private activeEditExitFn: (() => void) | null = null;

  constructor(node: ProseMirrorNode, view: EditorView, getPos: () => number) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    this.dom = document.createElement('div');
    this.dom.className = 'comment-block';
    this.dom.contentEditable = 'false';
    this.dom.tabIndex = 0;
    this.dom.setAttribute('role', 'button');
    this.dom.setAttribute('aria-label', this.createAriaLabel());
    this.dom.addEventListener('mousedown', (event) => {
      if (this.editing) return;
      event.preventDefault();
      event.stopPropagation();
      window.setTimeout(() => this.enterEdit(), 0);
    });
    this.dom.addEventListener('click', (event) => {
      if (this.editing) return;
      event.preventDefault();
      event.stopPropagation();
      this.enterEdit();
    });
    this.dom.addEventListener('keydown', (event) => {
      if (this.editing) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.enterEdit();
      }
    });

    this.renderDisplay();

    if (CommentBlockNodeView.instantEditMode) {
      CommentBlockNodeView.instantEditMode = false;
      requestAnimationFrame(() => this.enterEdit());
    }
  }

  static requestInstantEdit(): void {
    CommentBlockNodeView.instantEditMode = true;
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.dom.setAttribute('aria-label', this.createAriaLabel());
    if (!this.editing) this.renderDisplay();
    return true;
  }

  selectNode(): void {
    this.dom.classList.add('ProseMirror-selectednode');
  }

  deselectNode(): void {
    this.dom.classList.remove('ProseMirror-selectednode');
    if (this.editing) this.exitEdit(true);
  }

  stopEvent(event: Event): boolean {
    return this.editing && this.dom.contains(event.target as Node);
  }

  ignoreMutation(): boolean {
    return true;
  }

  destroy(): void {
    this.cleanupEdit();
  }

  private renderDisplay(): void {
    const content = this.getContent().trim();
    this.dom.textContent = '';
    this.dom.classList.toggle('is-empty', !content);

    const label = document.createElement('span');
    label.className = 'comment-block-label';
    label.textContent = '注释';

    const preview = document.createElement('span');
    preview.className = 'comment-block-preview';
    preview.textContent = content || '点击填写注释';

    this.dom.append(label, preview);
  }

  private enterEdit(): void {
    if (this.editing) return;

    this.editing = true;
    this.activeEditExitFn = () => this.exitEdit(true);
    registerActiveEdit(this.activeEditExitFn);

    this.originalContent = this.getContent();
    this.dom.classList.add('is-editing');
    this.dom.classList.remove('ProseMirror-selectednode');

    this.textarea = document.createElement('textarea');
    this.textarea.className = 'comment-block-textarea';
    this.textarea.value = this.originalContent;
    this.textarea.rows = Math.max(2, Math.min(8, this.originalContent.split('\n').length + 1));
    this.textarea.setAttribute('aria-label', '编辑块级注释');

    this.dom.textContent = '';
    this.dom.appendChild(this.textarea);

    this.textarea.addEventListener('keydown', (event) => this.handleKeyDown(event));
    this.textarea.addEventListener('blur', () => this.exitEdit(true));

    requestAnimationFrame(() => {
      if (!this.textarea) return;
      this.textarea.focus({ preventScroll: true });
      this.textarea.setSelectionRange(this.textarea.value.length, this.textarea.value.length);
    });
  }

  private exitEdit(save: boolean): void {
    if (!this.editing) return;

    const nextContent =
      save && this.textarea ? sanitizeCommentContent(this.textarea.value) : this.originalContent;
    const previousContent = this.getContent();
    const pos = this.getPos();

    this.cleanupEdit();

    let tr = this.view.state.tr;
    if (save && nextContent !== previousContent) {
      tr = tr.setNodeMarkup(pos, null, { content: nextContent });
    }

    tr = tr.setSelection(NodeSelection.create(tr.doc, pos));
    this.view.dispatch(tr);
    this.view.focus();
  }

  private cleanupEdit(): void {
    this.editing = false;
    if (this.activeEditExitFn) {
      unregisterActiveEdit(this.activeEditExitFn);
      this.activeEditExitFn = null;
    }
    this.dom.classList.remove('is-editing');
    this.textarea = null;
    this.renderDisplay();
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.exitEdit(false);
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      this.exitEdit(true);
      const pos = this.getPos();
      const paragraph = this.view.state.schema.nodes.paragraph.create();
      const insertPos = pos + this.node.nodeSize;
      const tr = this.view.state.tr.insert(insertPos, paragraph);
      this.view.dispatch(
        tr.setSelection(TextSelection.create(tr.doc, insertPos + 1)).scrollIntoView(),
      );
    }
  }

  private getContent(): string {
    return String(this.node.attrs.content ?? '');
  }

  private createAriaLabel(): string {
    const content = this.getContent().trim();
    return content ? `块级注释：${content}` : '块级注释';
  }
}

function sanitizeCommentContent(content: string): string {
  return content.replace(/-->/g, '-- >');
}
