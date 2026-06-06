import { Plugin } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { Node as ProseMirrorNode } from 'prosemirror-model';

/** 上下文菜单项 */
export interface ContextMenuItem {
  label: string;
  icon?: string;
  action: () => void;
  /** 当前是否激活（如对齐选中态），显示 ✓ */
  active?: boolean;
  /** 是否为分隔线后的项 */
  separator?: boolean;
  /** 危险操作（红色高亮） */
  danger?: boolean;
  /** 快捷键提示文本 */
  shortcut?: string;
}

/** 上下文菜单打开事件 */
export interface ContextMenuOpenEvent {
  /** 鼠标位置 X */
  x: number;
  /** 鼠标位置 Y */
  y: number;
  /** 命中的 ProseMirror 节点 */
  node: ProseMirrorNode;
  /** 节点在文档中的位置 */
  pos: number;
  /** 节点对应的 DOM 元素 */
  nodeDom: HTMLElement;
  /** 菜单项 */
  items: ContextMenuItem[];
}

/** NodeView 上下文菜单能力接口 */
export interface ContextMenuCapable {
  getContextMenuItems(view: EditorView): ContextMenuItem[];
}

const MENU_FACTORY_KEY = '__contextMenuFactory';

/** DOM 元素挂载的菜单工厂函数类型 */
type MenuFactory = () => ContextMenuItem[];

/**
 * 给 DOM 元素挂载上下文菜单工厂。
 * NodeView 在渲染时调用此方法，使其 DOM 支持右键菜单。
 */
export function mountContextMenuFactory(dom: HTMLElement, factory: MenuFactory): void {
  (dom as Record<string, unknown>)[MENU_FACTORY_KEY] = factory;
}

export interface ContextMenuPluginOptions {
  onOpen: (event: ContextMenuOpenEvent) => void;
}

/**
 * 通用上下文菜单 ProseMirror 插件。
 *
 * 监听编辑区的 contextmenu 事件，向上遍历 DOM 查找挂载了菜单工厂的元素，
 * 若找到则阻止默认菜单并触发 onOpen，传递菜单项和节点信息。
 */
export function contextMenuPlugin(options: ContextMenuPluginOptions): Plugin {
  return new Plugin({
    props: {
      handleDOMEvents: {
        contextmenu(view: EditorView, event: MouseEvent) {
          const target = event.target as HTMLElement | null;
          if (!target) return false;

          // 向上查找挂载了菜单工厂的 DOM 元素
          const factoryResult = findMenuFactory(target, view.dom);
          if (!factoryResult) return false;

          const { dom: nodeDom, factory } = factoryResult;

          // 通过 DOM 定位 ProseMirror 文档位置
          const pos = view.posAtDOM(nodeDom, 0);
          if (pos < 0) return false;

          const $pos = view.state.doc.resolve(pos);
          const node = $pos.nodeAfter;
          if (!node) return false;

          const items = factory();

          event.preventDefault();
          event.stopPropagation();

          options.onOpen({
            x: event.clientX,
            y: event.clientY,
            node,
            pos,
            nodeDom,
            items,
          });
          return true;
        },
      },
    },
  });
}

/**
 * 从事件目标向上查找挂载了菜单工厂的 DOM 元素。
 */
function findMenuFactory(
  target: HTMLElement,
  editorDom: HTMLElement,
): { dom: HTMLElement; factory: MenuFactory } | null {
  let current: HTMLElement | null = target;
  while (current && current !== editorDom) {
    const factory = (current as Record<string, unknown>)[MENU_FACTORY_KEY] as
      | MenuFactory
      | undefined;
    if (typeof factory === 'function') {
      return { dom: current, factory };
    }
    current = current.parentElement;
  }
  return null;
}
