import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { TextSelection } from 'prosemirror-state';
import type { EditorView, ViewMutationRecord } from 'prosemirror-view';

/**
 * 底部脚注定义 NodeView：展示定义标记、返回正文入口，并保留内容区原生编辑能力。
 */
export class FootnoteDefNodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;

  private node: ProseMirrorNode;
  private view: EditorView;
  private marker: HTMLButtonElement;

  constructor(node: ProseMirrorNode, view: EditorView) {
    this.node = node;
    this.view = view;

    this.dom = document.createElement('div');
    this.dom.className = 'footnote-def';

    this.marker = document.createElement('button');
    this.marker.type = 'button';
    this.marker.className = 'footnote-def-marker';
    this.marker.contentEditable = 'false';
    this.marker.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    this.marker.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.jumpToFirstReference();
    });

    this.contentDOM = document.createElement('span');
    this.contentDOM.className = 'footnote-def-content';

    this.dom.append(this.marker, this.contentDOM);
    this.render();
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.render();
    return true;
  }

  stopEvent(event: Event): boolean {
    return this.marker.contains(event.target as Node);
  }

  ignoreMutation(mutation: ViewMutationRecord): boolean {
    return !this.contentDOM.contains(mutation.target);
  }

  destroy(): void {
    return;
  }

  private render(): void {
    const id = this.id;
    this.dom.setAttribute('data-footnote-id', id);
    this.marker.setAttribute('aria-label', `返回正文脚注 ${id}`);
    this.marker.title = '返回正文脚注';
    this.marker.textContent = id;
  }

  private jumpToFirstReference(): void {
    let refEndPos: number | null = null;
    this.view.state.doc.descendants((node, pos) => {
      if (refEndPos !== null) return false;
      if (node.type.name === 'footnote_ref' && node.attrs.id === this.id) {
        refEndPos = pos + node.nodeSize;
        return false;
      }
      return true;
    });
    if (refEndPos === null) return;

    const tr = this.view.state.tr.setSelection(
      TextSelection.near(this.view.state.doc.resolve(refEndPos), 1),
    );
    this.view.dispatch(tr.scrollIntoView());
    this.view.focus();
  }

  private get id(): string {
    return String(this.node.attrs.id ?? '');
  }
}
