import { DOMSerializer, type Node as ProseMirrorNode } from 'prosemirror-model';
import { TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { onInterfaceLocaleChanged, t } from '../../../app/i18n';

type FootnoteDefinitionLocation = {
  node: ProseMirrorNode;
  pos: number;
};

/**
 * 正文脚注引用 NodeView：负责跳转到底部定义，并在 hover/focus 时显示只读预览。
 */
export class FootnoteRefNodeView {
  dom: HTMLElement;

  private node: ProseMirrorNode;
  private view: EditorView;
  private previewCard: HTMLElement | null = null;
  private previewTitle: HTMLElement | null = null;
  private previewContent: HTMLElement | null = null;
  private positionHandler: (() => void) | null = null;
  private closeTimer: number | null = null;
  private unsubscribeLocale: () => void = () => undefined;

  constructor(node: ProseMirrorNode, view: EditorView) {
    this.node = node;
    this.view = view;

    this.dom = document.createElement('sup');
    this.dom.className = 'footnote-ref';
    this.dom.contentEditable = 'false';
    this.dom.tabIndex = 0;
    this.dom.setAttribute('role', 'link');

    this.dom.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    this.dom.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.jumpToDefinition();
    });
    this.dom.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      this.jumpToDefinition();
    });
    this.dom.addEventListener('mouseenter', () => this.openPreview());
    this.dom.addEventListener('mouseleave', () => this.scheduleClosePreview());
    this.dom.addEventListener('focus', () => this.openPreview());
    this.dom.addEventListener('blur', () => this.scheduleClosePreview());
    this.unsubscribeLocale = onInterfaceLocaleChanged(() => {
      this.render();
      if (this.previewCard) {
        this.renderPreviewContent();
        this.updatePreviewPosition();
      }
    });

    this.render();
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.render();
    if (this.previewCard) {
      this.renderPreviewContent();
      this.updatePreviewPosition();
    }
    return true;
  }

  selectNode(): void {
    this.dom.classList.add('ProseMirror-selectednode');
  }

  deselectNode(): void {
    this.dom.classList.remove('ProseMirror-selectednode');
  }

  stopEvent(event: Event): boolean {
    return this.dom.contains(event.target as Node);
  }

  ignoreMutation(): boolean {
    return true;
  }

  destroy(): void {
    this.unsubscribeLocale();
    this.closePreview();
  }

  private render(): void {
    const id = this.id;
    this.dom.setAttribute('data-footnote-id', id);
    this.dom.setAttribute('aria-label', t.footnoteJumpToDefinition({ id }));
    this.dom.title = t.viewFootnote();
    this.dom.textContent = id;
  }

  private jumpToDefinition(): void {
    const definition = this.findDefinition();
    if (!definition) return;

    const targetPos = definition.pos + 1;
    const tr = this.view.state.tr.setSelection(
      TextSelection.near(this.view.state.doc.resolve(targetPos), 1),
    );
    this.view.dispatch(tr.scrollIntoView());
    this.view.focus();
  }

  private openPreview(): void {
    this.clearCloseTimer();
    if (!this.previewCard) {
      this.previewCard = document.createElement('div');
      this.previewCard.className = 'footnote-preview';
      this.previewCard.style.position = 'fixed';
      this.previewCard.style.zIndex = '1000';
      this.previewCard.style.visibility = 'hidden';
      this.previewCard.addEventListener('mouseenter', () => this.clearCloseTimer());
      this.previewCard.addEventListener('mouseleave', () => this.scheduleClosePreview());

      this.previewTitle = document.createElement('div');
      this.previewTitle.className = 'footnote-preview-title';
      this.previewCard.appendChild(this.previewTitle);

      this.previewContent = document.createElement('div');
      this.previewContent.className = 'footnote-preview-content';
      this.previewCard.appendChild(this.previewContent);
      document.body.appendChild(this.previewCard);

      this.positionHandler = () => this.updatePreviewPosition();
      window.addEventListener('scroll', this.positionHandler, true);
      window.addEventListener('resize', this.positionHandler);
    }

    this.renderPreviewContent();
    requestAnimationFrame(() => {
      if (!this.previewCard) return;
      this.updatePreviewPosition();
      this.previewCard.style.visibility = '';
    });
  }

  private scheduleClosePreview(): void {
    this.clearCloseTimer();
    this.closeTimer = window.setTimeout(() => this.closePreview(), 120);
  }

  private clearCloseTimer(): void {
    if (this.closeTimer === null) return;
    window.clearTimeout(this.closeTimer);
    this.closeTimer = null;
  }

  private closePreview(): void {
    this.clearCloseTimer();
    if (this.positionHandler) {
      window.removeEventListener('scroll', this.positionHandler, true);
      window.removeEventListener('resize', this.positionHandler);
      this.positionHandler = null;
    }
    this.previewCard?.remove();
    this.previewCard = null;
    this.previewContent = null;
  }

  private updatePreviewPosition(): void {
    if (!this.previewCard) return;

    const rect = this.dom.getBoundingClientRect();
    const isVisible = rect.bottom >= 0 && rect.top < window.innerHeight;
    if (!isVisible) {
      this.previewCard.style.display = 'none';
      return;
    }

    const maxWidth = Math.min(520, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - maxWidth - 12));
    this.previewCard.style.display = '';
    this.previewCard.style.top = `${rect.bottom + 8}px`;
    this.previewCard.style.left = `${left}px`;
    this.previewCard.style.maxWidth = `${maxWidth}px`;
  }

  private renderPreviewContent(): void {
    if (!this.previewContent) return;

    if (this.previewTitle) {
      this.previewTitle.textContent = t.footnoteTitle({ id: this.id });
    }
    this.previewContent.textContent = '';
    const definition = this.findDefinition();
    if (!definition || definition.node.content.size === 0) {
      this.previewContent.classList.add('is-missing');
      this.previewContent.textContent = definition
        ? t.footnoteEmpty()
        : t.footnoteMissing({ id: this.id });
      return;
    }

    this.previewContent.classList.remove('is-missing');
    const serializer = DOMSerializer.fromSchema(this.view.state.schema);
    this.previewContent.appendChild(
      serializer.serializeFragment(definition.node.content, { document }),
    );
  }

  private findDefinition(): FootnoteDefinitionLocation | null {
    let result: FootnoteDefinitionLocation | null = null;
    this.view.state.doc.descendants((node, pos) => {
      if (result) return false;
      if (node.type.name === 'footnote_def' && node.attrs.id === this.id) {
        result = { node, pos };
        return false;
      }
      return true;
    });
    return result;
  }

  private get id(): string {
    return String(this.node.attrs.id ?? '');
  }
}
