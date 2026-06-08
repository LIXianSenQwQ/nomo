/** Callout NodeView：卡片式渲染，header 不可编辑，body 可编辑 */

import type { Node as ProseMirrorNode } from 'prosemirror-model';
import type { EditorView, NodeView } from 'prosemirror-view';
import {
  CALLOUT_TYPES,
  getCalloutConfig,
  getCalloutLabel,
  type CalloutType,
} from '../callout/calloutTypes';

const INTERFACE_LOCALE_CHANGED_EVENT = 'nomo://interface-locale-changed';

/**
 * callout 节点的 NodeView。
 *
 * DOM 结构：
 *   .callout-card
 *     .callout-header
 *       .callout-icon      [SVG 图标]
 *       .callout-title     [中文标题]
 *       .callout-type-btn  [▼ 切换按钮]
 *     .callout-body        [contentDOM，ProseMirror 管理 block+ 内容]
 */
export class CalloutNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;

  private node: ProseMirrorNode;
  private view: EditorView;
  private getPos: () => number;

  // header 元素引用
  private iconEl: HTMLElement;
  private titleEl: HTMLElement;
  private typeBtn: HTMLButtonElement;

  // 类型选择面板
  private picker: HTMLElement;
  private closePickerOnOutsideMouseDown: ((event: MouseEvent) => void) | null = null;
  private refreshLocaleLabels = () => this.updateLocalizedLabels();

  constructor(node: ProseMirrorNode, view: EditorView, getPos: () => number) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    const config = getCalloutConfig(node.attrs.type as string);

    // 根容器
    this.dom = document.createElement('div');
    this.dom.className = 'callout-card';
    this.dom.setAttribute('data-callout-type', config.type);

    // ---- header（不可编辑）----
    const header = document.createElement('div');
    header.className = 'callout-header';
    header.contentEditable = 'false';

    // 图标
    this.iconEl = document.createElement('span');
    this.iconEl.className = 'callout-icon';
    this.iconEl.innerHTML = getIconSvg(config.icon);
    header.appendChild(this.iconEl);

    // 标题
    this.titleEl = document.createElement('span');
    this.titleEl.className = 'callout-title';
    this.titleEl.textContent = getCalloutLabel(config.type);
    header.appendChild(this.titleEl);

    // 类型切换按钮
    this.typeBtn = document.createElement('button');
    this.typeBtn.type = 'button';
    this.typeBtn.className = 'callout-type-btn';
    this.typeBtn.textContent = '▾';
    this.typeBtn.setAttribute('aria-label', getCalloutLabel(config.type));
    this.typeBtn.setAttribute('aria-haspopup', 'listbox');
    this.typeBtn.setAttribute('aria-expanded', 'false');
    this.typeBtn.title = getCalloutLabel(config.type);
    this.typeBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.togglePicker();
    });
    header.appendChild(this.typeBtn);

    this.dom.appendChild(header);

    // ---- body（可编辑，contentDOM）----
    this.contentDOM = document.createElement('div');
    this.contentDOM.className = 'callout-body';
    this.dom.appendChild(this.contentDOM);

    this.picker = this.createPicker(config.type);
    this.dom.appendChild(this.picker);
    window.addEventListener(INTERFACE_LOCALE_CHANGED_EVENT, this.refreshLocaleLabels);
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;

    const newType = node.attrs.type as string;
    const config = getCalloutConfig(newType);

    this.dom.setAttribute('data-callout-type', config.type);
    this.iconEl.innerHTML = getIconSvg(config.icon);
    this.titleEl.textContent = getCalloutLabel(config.type);
    this.updatePickerActiveType(config.type);

    return true;
  }

  selectNode(): void {
    this.dom.classList.add('ProseMirror-selectednode');
  }

  deselectNode(): void {
    this.dom.classList.remove('ProseMirror-selectednode');
  }

  stopEvent(e: Event): boolean {
    // 阻止 header 区域的事件传播到 ProseMirror
    const target = e.target as HTMLElement;
    if (target.closest('.callout-header')) {
      return true;
    }
    // picker 区域的事件也阻止
    if (target.closest('.callout-type-picker')) {
      return true;
    }
    return false;
  }

  ignoreMutation(mutation: { type: string; target: Node }): boolean {
    if (mutation.type === 'selection') return false;

    const target = mutation.target;
    return !this.contentDOM.contains(target);
  }

  destroy(): void {
    this.hidePicker();
    window.removeEventListener(INTERFACE_LOCALE_CHANGED_EVENT, this.refreshLocaleLabels);
  }

  // ---- 类型切换面板 ----

  private togglePicker(): void {
    if (this.dom.classList.contains('is-picker-open')) {
      this.hidePicker();
    } else {
      this.showPicker();
    }
  }

  private showPicker(): void {
    this.typeBtn.setAttribute('aria-expanded', 'true');
    this.dom.classList.add('is-picker-open');
    this.updatePickerActiveType(this.node.attrs.type as CalloutType);
    if (this.closePickerOnOutsideMouseDown) return;

    const closeOnOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!this.dom.contains(target)) {
        this.hidePicker();
      }
    };
    this.closePickerOnOutsideMouseDown = closeOnOutsideClick;

    requestAnimationFrame(() => {
      document.addEventListener('mousedown', closeOnOutsideClick, true);
    });
  }

  private createPicker(currentType: CalloutType): HTMLElement {
    const picker = document.createElement('div');
    picker.className = 'callout-type-picker';
    picker.setAttribute('role', 'listbox');

    for (const config of CALLOUT_TYPES) {
      const item = document.createElement('div');
      item.className = 'callout-type-picker-item';
      item.dataset.calloutType = config.type;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', config.type === currentType ? 'true' : 'false');
      if (config.type === currentType) {
        item.classList.add('is-active');
      }

      const icon = document.createElement('span');
      icon.className = 'callout-type-picker-icon';
      icon.innerHTML = getIconSvg(config.icon);
      item.appendChild(icon);

      const label = document.createElement('span');
      label.className = 'callout-type-picker-label';
      label.textContent = getCalloutLabel(config.type);
      item.appendChild(label);

      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.applyType(config.type);
        this.hidePicker();
      });

      picker.appendChild(item);
    }

    return picker;
  }

  private hidePicker(): void {
    if (this.closePickerOnOutsideMouseDown) {
      document.removeEventListener('mousedown', this.closePickerOnOutsideMouseDown, true);
      this.closePickerOnOutsideMouseDown = null;
    }
    this.typeBtn.setAttribute('aria-expanded', 'false');
    this.dom.classList.remove('is-picker-open');
  }

  private updatePickerActiveType(currentType: CalloutType): void {
    for (const item of this.picker.querySelectorAll<HTMLElement>('.callout-type-picker-item')) {
      const active = item.dataset.calloutType === currentType;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-selected', active ? 'true' : 'false');
    }
  }

  private updateLocalizedLabels(): void {
    const type = getCalloutConfig(this.node.attrs.type as string).type;
    this.titleEl.textContent = getCalloutLabel(type);
    this.typeBtn.setAttribute('aria-label', getCalloutLabel(type));
    this.typeBtn.title = getCalloutLabel(type);
    for (const item of this.picker.querySelectorAll<HTMLElement>('.callout-type-picker-item')) {
      const itemType = item.dataset.calloutType ?? 'note';
      const label = item.querySelector<HTMLElement>('.callout-type-picker-label');
      if (label) {
        label.textContent = getCalloutLabel(itemType);
      }
    }
  }

  private applyType(newType: CalloutType): void {
    const currentType = this.node.attrs.type as string;
    if (newType === currentType) return;

    const pos = this.getPos();
    const tr = this.view.state.tr.setNodeMarkup(pos, undefined, { type: newType });
    this.view.dispatch(tr.scrollIntoView());
  }
}

// ---- Lucide SVG 图标缓存 ----

const ICON_SVG_CACHE: Record<string, string> = {};

function getIconSvg(iconName: string): string {
  if (ICON_SVG_CACHE[iconName]) return ICON_SVG_CACHE[iconName];

  // 内联 SVG 路径（Lucide 图标的 path 数据）
  const svgMap: Record<string, string> = {
    Info:
      '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    Lightbulb:
      '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
    Star:
      '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    AlertTriangle:
      '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    OctagonAlert:
      '<path d="M12 16h.01"/><path d="M12 8v4"/><path d="M15.312 2a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586l-4.688-4.688A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2z"/>',
  };

  const svgContent = svgMap[iconName] ?? svgMap['Info'];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svgContent}</svg>`;
  ICON_SVG_CACHE[iconName] = svg;
  return svg;
}
