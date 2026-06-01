import type { Node as ProseMirrorNode } from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';

/**
 * html_block 节点的 NodeView。
 * 提供卡片外壳（header 显示标签名）和 contentDOM 用于内联编辑。
 */
export class HtmlBlockNodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private node: ProseMirrorNode;
  private tagLabel: HTMLElement;
  private className = 'html-card';

  constructor(node: ProseMirrorNode, _view: EditorView, _getPos: () => number) {
    this.node = node;

    this.dom = document.createElement('div');
    this.dom.className = this.className;

    const header = document.createElement('header');
    this.tagLabel = document.createElement('span');
    this.tagLabel.textContent = this.formatTagLabel();
    header.appendChild(this.tagLabel);
    this.dom.appendChild(header);

    this.contentDOM = document.createElement(this.readTagName());
    this.syncContentElementAttrs();
    this.dom.appendChild(this.contentDOM);
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) return false;
    if (node.attrs.tag !== this.node.attrs.tag) return false;
    this.node = node;
    this.tagLabel.textContent = this.formatTagLabel();
    this.syncContentElementAttrs();
    return true;
  }

  selectNode(): void {
    this.dom.classList.add('ProseMirror-selectednode');
  }

  deselectNode(): void {
    this.dom.classList.remove('ProseMirror-selectednode');
  }

  stopEvent(_event: Event): boolean {
    return false;
  }

  ignoreMutation(): boolean {
    return false;
  }

  destroy(): void {}

  private formatTagLabel(): string {
    const { tag, class: cls, id } = this.node.attrs;
    const parts = [`<${tag}>`];
    if (cls) parts.push(`.${cls}`);
    if (id) parts.push(`#${id}`);
    return parts.join(' ');
  }

  private readTagName(): 'section' | 'div' {
    return this.node.attrs.tag === 'section' ? 'section' : 'div';
  }

  private syncContentElementAttrs(): void {
    const { class: cls, id } = this.node.attrs;
    const classNames = ['html-card-content'];
    if (typeof cls === 'string' && cls.trim()) {
      classNames.push(cls.trim());
    }

    this.contentDOM.setAttribute('class', classNames.join(' '));
    if (typeof id === 'string' && id.trim()) {
      this.contentDOM.setAttribute('id', id.trim());
    } else {
      this.contentDOM.removeAttribute('id');
    }
  }
}
