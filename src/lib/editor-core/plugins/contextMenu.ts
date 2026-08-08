import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { Plugin, TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

export type ContextMenuIcon =
  | 'undo'
  | 'redo'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'search'
  | 'select-all'
  | 'insert'
  | 'format'
  | 'link'
  | 'open'
  | 'unlink'
  | 'edit'
  | 'delete'
  | 'align-left'
  | 'align-center'
  | 'align-right'
  | 'image'
  | 'heading'
  | 'list'
  | 'quote'
  | 'code'
  | 'table'
  | 'formula'
  | 'diagram'
  | 'separator'
  | 'outline'
  | 'toolbar'
  | 'focus'
  | 'width'
  | 'zoom'
  | 'new-file'
  | 'new-folder'
  | 'folder'
  | 'refresh'
  | 'collapse'
  | 'expand'
  | 'jump'
  | 'minimize'
  | 'maximize'
  | 'restore'
  | 'close';

/** 上下文菜单项 */
export interface ContextMenuItem {
  label: string;
  icon?: ContextMenuIcon;
  action?: () => unknown | Promise<unknown>;
  disabled?: boolean;
  children?: ContextMenuItem[];
  /** 当前是否激活（如对齐选中态），显示 ✓ */
  active?: boolean;
  /** 是否为分隔线后的项 */
  separator?: boolean;
  /** 危险操作（红色高亮） */
  danger?: boolean;
  /** 快捷键提示文本 */
  shortcut?: string;
}

export type ContextMenuTargetKind =
  | 'text'
  | 'empty-block'
  | 'selection'
  | 'link'
  | 'image'
  | 'heading'
  | 'code-block'
  | 'table'
  | 'math-block'
  | 'mermaid-block';

export interface ContextMenuTarget {
  kind: ContextMenuTargetKind;
  pos: number;
  nodeType: string;
  text?: string;
  href?: string;
  headingLevel?: number;
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
  /** 右键命中的语义上下文 */
  target: ContextMenuTarget;
}

/** 应用中任意区域请求打开统一上下文菜单时使用的负载。 */
export interface ContextMenuRequest {
  x: number;
  y: number;
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
  (dom as unknown as Record<string, unknown>)[MENU_FACTORY_KEY] = factory;
}

export interface ContextMenuPluginOptions {
  onOpen: (event: ContextMenuOpenEvent) => void;
}

/**
 * 通用上下文菜单 ProseMirror 插件。
 *
 * 监听编辑区的 contextmenu 事件，优先查找对象挂载的菜单工厂，否则解析通用语义目标；
 * 同时按坐标保留或移动选区，再由应用层生成对应菜单。
 */
export function contextMenuPlugin(options: ContextMenuPluginOptions): Plugin {
  return new Plugin({
    props: {
      handleDOMEvents: {
        contextmenu(view: EditorView, event: MouseEvent) {
          const target = event.target as HTMLElement | null;
          if (!target) return false;

          if (target.closest('input, textarea, select')) {
            return false;
          }

          // 向上查找挂载了菜单工厂的 DOM 元素
          const factoryResult = findMenuFactory(target, view.dom);
          const nodeDom = factoryResult?.dom ?? findSemanticNodeDom(target, view.dom);
          const coordinateResult = view.posAtCoords({ left: event.clientX, top: event.clientY });
          let pos = coordinateResult?.pos ?? -1;
          if (factoryResult) {
            const factoryPos = view.posAtDOM(nodeDom, 0);
            if (factoryPos >= 0) pos = factoryPos;
          }
          if (pos < 0) return false;

          preserveOrMoveSelection(view, pos);

          const $pos = view.state.doc.resolve(pos);
          const node = $pos.nodeAfter ?? $pos.parent;
          const items = factoryResult?.factory() ?? [];
          const menuTarget = resolveContextTarget(view, target, nodeDom, pos, node);

          event.preventDefault();
          event.stopPropagation();

          options.onOpen({
            x: event.clientX,
            y: event.clientY,
            node,
            pos,
            nodeDom,
            items,
            target: menuTarget,
          });
          return true;
        },
      },
    },
  });
}

function preserveOrMoveSelection(view: EditorView, pos: number): void {
  const { selection, doc } = view.state;
  if (!selection.empty && pos >= selection.from && pos <= selection.to) {
    return;
  }
  try {
    const nextSelection = TextSelection.near(doc.resolve(Math.max(0, Math.min(pos, doc.content.size))));
    view.dispatch(view.state.tr.setSelection(nextSelection));
  } catch {
    // 坐标命中个别不可选 NodeView 时保留原选区，菜单仍可提供对象操作。
  }
}

function findSemanticNodeDom(target: HTMLElement, editorDom: HTMLElement): HTMLElement {
  return (
    target.closest<HTMLElement>(
      'a, h1, h2, h3, h4, h5, h6, .image-node, .code-card, table, .math-block, .mermaid-block',
    ) ?? editorDom
  );
}

function resolveContextTarget(
  view: EditorView,
  eventTarget: HTMLElement,
  nodeDom: HTMLElement,
  pos: number,
  node: ProseMirrorNode,
): ContextMenuTarget {
  const objectDom = findSemanticNodeDom(eventTarget, view.dom);
  const nodeType = node.type.name;

  if (objectDom.closest('.image-node')) {
    return { kind: 'image', pos, nodeType, text: String(node.attrs.alt ?? '') };
  }

  const link = eventTarget.closest<HTMLAnchorElement>('a[href]');
  if (link) {
    return {
      kind: 'link',
      pos,
      nodeType,
      text: link.textContent ?? '',
      href: link.getAttribute('href') ?? '',
    };
  }

  const heading = eventTarget.closest<HTMLElement>('h1, h2, h3, h4, h5, h6');
  if (heading) {
    return {
      kind: 'heading',
      pos,
      nodeType,
      text: heading.textContent ?? '',
      headingLevel: Number(heading.tagName.slice(1)),
    };
  }

  if (eventTarget.closest('.code-card')) {
    const codeCard = eventTarget.closest<HTMLElement>('.code-card');
    return {
      kind: 'code-block',
      pos,
      nodeType,
      text: codeCard?.querySelector<HTMLElement>('.code-content code')?.textContent ?? node.textContent,
    };
  }
  if (eventTarget.closest('table')) {
    return { kind: 'table', pos, nodeType };
  }
  if (eventTarget.closest('.math-block')) {
    const mathBlock = eventTarget.closest<HTMLElement>('.math-block');
    return { kind: 'math-block', pos, nodeType, text: mathBlock?.dataset.tex ?? String(node.attrs.tex ?? '') };
  }
  if (eventTarget.closest('.mermaid-block')) {
    const mermaidBlock = eventTarget.closest<HTMLElement>('.mermaid-block');
    return { kind: 'mermaid-block', pos, nodeType, text: mermaidBlock?.dataset.code ?? String(node.attrs.code ?? '') };
  }

  const { selection } = view.state;
  if (!selection.empty && pos >= selection.from && pos <= selection.to) {
    return {
      kind: 'selection',
      pos,
      nodeType,
      text: view.state.doc.textBetween(selection.from, selection.to, '\n'),
    };
  }

  const block = eventTarget.closest<HTMLElement>('p');
  if (block && !block.textContent?.trim()) {
    return { kind: 'empty-block', pos, nodeType };
  }

  return { kind: 'text', pos, nodeType: nodeDom === view.dom ? nodeType : nodeDom.tagName.toLowerCase() };
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
    const factory = (current as unknown as Record<string, unknown>)[MENU_FACTORY_KEY] as
      | MenuFactory
      | undefined;
    if (typeof factory === 'function') {
      return { dom: current, factory };
    }
    current = current.parentElement;
  }
  return null;
}
