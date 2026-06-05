import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { NodeSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

/**
 * horizontal_rule 节点的 NodeView
 *
 * 职责：
 * 1. 渲染水平分割线（<hr>）
 * 2. 点击时选中整个节点（NodeSelection），支持 Delete 键删除
 */
export class HorizontalRuleNodeView {
  dom: HTMLElement;

  private node: ProseMirrorNode;
  private view: EditorView;
  private getPos: () => number;

  constructor(node: ProseMirrorNode, view: EditorView, getPos: () => number) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    this.dom = document.createElement('div');
    this.dom.className = 'horizontal-rule-node';
    this.dom.contentEditable = 'false';
    const hr = document.createElement('hr');
    this.dom.appendChild(hr);

    this.dom.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const pos = this.getPos();
      this.view.dispatch(
        this.view.state.tr.setSelection(NodeSelection.create(this.view.state.doc, pos)),
      );
    });
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    return true;
  }

  selectNode(): void {
    this.dom.classList.add('ProseMirror-selectednode');
  }

  deselectNode(): void {
    this.dom.classList.remove('ProseMirror-selectednode');
  }

  stopEvent(event: Event): boolean {
    // 拦截点击事件，由 mousedown handler 创建 NodeSelection
    return event.type === 'mousedown';
  }

  ignoreMutation(): boolean {
    return true;
  }
}
