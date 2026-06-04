import { setBlockType, toggleMark, wrapIn } from 'prosemirror-commands';
import { redo, undo } from 'prosemirror-history';
import { liftListItem, wrapInList } from 'prosemirror-schema-list';
import type { MarkType, Node as PmNode, NodeType, ResolvedPos } from 'prosemirror-model';
import { EditorState, NodeSelection, TextSelection, type Transaction } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { schema } from './schema';

/**
 * 在当前块的下方插入一个新的空段落，并将光标移入。
 * 逻辑：定位当前顶层块的末尾位置，在该位置插入空段落节点。
 */
function insertParagraphAfterCurrentBlock(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  if (!dispatch) return false;
  const { $from } = state.selection;
  const topDepth = 1;
  const afterPos = $from.after(topDepth);
  const emptyParagraph = schema.nodes.paragraph.create();
  const tr = state.tr.insert(afterPos, emptyParagraph);
  // 光标移到新段落的起始位置
  const newPos = afterPos + 1;
  tr.setSelection(TextSelection.create(tr.doc, newPos));
  dispatch(tr.scrollIntoView());
  return true;
}

/**
 * 在当前块的上方插入一个新的空段落，并将光标移入。
 * 逻辑：定位当前顶层块的起始位置，在该位置之前插入空段落节点。
 */
function insertParagraphBeforeCurrentBlock(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  if (!dispatch) return false;
  const { $from } = state.selection;
  const topDepth = 1;
  const beforePos = $from.before(topDepth);
  const emptyParagraph = schema.nodes.paragraph.create();
  const tr = state.tr.insert(beforePos, emptyParagraph);
  // 光标移到新段落的起始位置
  tr.setSelection(TextSelection.create(tr.doc, beforePos + 1));
  dispatch(tr.scrollIntoView());
  return true;
}
import {
  addTableColumnAfter,
  addTableColumnBefore,
  addTableRowAfter,
  addTableRowBefore,
  createTableNode,
  deleteCurrentTable,
  deleteCurrentTableColumn,
  deleteCurrentTableRow,
  setTableColumnAlignment,
  toggleFirstTableRowHeader,
} from './tableCommands';
import type { EditorCommand, SetMarkdownOptions } from './types';

type MarkdownSetter = (markdown: string, options?: SetMarkdownOptions) => void;

/** 如果当前已是同级标题，则取消为正文；否则设为对应级别 */
function toggleHeading(view: EditorView, level: number): boolean {
  const { $from } = view.state.selection;
  for (let d = $from.depth; d >= 0; d--) {
    const node = $from.node(d);
    if (node.type === schema.nodes.heading) {
      if (node.attrs.level === level) {
        return setBlockType(schema.nodes.paragraph)(view.state, view.dispatch);
      }
      break;
    }
  }
  return setBlockType(schema.nodes.heading, { level })(view.state, view.dispatch);
}

// 查找光标所在位置的父列表（bullet_list 或 ordered_list）
function findParentList($pos: ResolvedPos): { listPos: number; listType: NodeType } | null {
  for (let d = $pos.depth; d >= 0; d--) {
    const node = $pos.node(d);
    if (node.type === schema.nodes.bullet_list || node.type === schema.nodes.ordered_list) {
      return { listPos: $pos.before(d), listType: node.type };
    }
  }
  return null;
}

// 查找包含 $pos 的 list_item 及父列表信息
function findListItem($pos: ResolvedPos): { itemPos: number; itemNode: PmNode } | null {
  for (let d = $pos.depth; d >= 0; d--) {
    const node = $pos.node(d);
    if (node.type === schema.nodes.list_item) {
      return { itemPos: $pos.before(d), itemNode: node };
    }
  }
  return null;
}

// 查找 list_item 中首个文本节点的内容偏移（相对于 list_item 内容起始）
function findFirstTextInItem(item: PmNode): { offset: number } | null {
  let result: { offset: number } | null = null;
  item.descendants((node, pos) => {
    if (node.isText) {
      result = { offset: pos };
      return false;
    }
  });
  return result;
}

// 判断 list_item 首段文本是否以 [ ] 或 [x] 开头
function findTaskMarkerInItem(item: PmNode): { offset: number; length: number } | null {
  let result: { offset: number; length: number } | null = null;
  item.descendants((node) => {
    if (node.isText) {
      const match = /^\[[ x]\]\s?/.exec(node.text ?? '');
      if (match) result = { offset: 0, length: match[0].length };
      return false;
    }
  });
  return result;
}

function getTaskMarkerRange(listItem: {
  itemPos: number;
  itemNode: PmNode;
}): { from: number; to: number } | null {
  const textInfo = findFirstTextInItem(listItem.itemNode);
  const taskMarker = findTaskMarkerInItem(listItem.itemNode);
  if (!textInfo || !taskMarker) return null;
  const from = listItem.itemPos + 1 + textInfo.offset + taskMarker.offset;
  return { from, to: from + taskMarker.length };
}

function liftCurrentListItem(
  state: EditorState,
  dispatch: (tr: Transaction) => void,
  tr?: Transaction,
): boolean {
  if (!tr) return liftListItem(schema.nodes.list_item)(state, dispatch);

  const nextState = state.apply(tr);
  let liftTr: Transaction | null = null;
  const lifted = liftListItem(schema.nodes.list_item)(nextState, (capturedTr) => {
    liftTr = capturedTr;
  });
  if (!lifted || !liftTr) return false;

  for (const step of (liftTr as Transaction).steps) tr.step(step);
  dispatch(tr);
  return true;
}

function getListAttrsForType(listType: NodeType): Record<string, unknown> | null {
  if (listType === schema.nodes.ordered_list) return { order: 1 };
  return null;
}

function appendCommandSteps(
  state: EditorState,
  tr: Transaction,
  command: (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean,
): boolean {
  let capturedTr: Transaction | null = null;
  const handled = command(state.apply(tr), (nextTr) => {
    capturedTr = nextTr;
  });
  if (!handled || !capturedTr) return false;
  for (const step of (capturedTr as Transaction).steps) tr.step(step);
  return true;
}

// 列表切换：同类列表取消为普通段落；跨有序/无序转换时保留任务标记。
// 适配 state/dispatch 签名，可直接用于 ProseMirror keymap
export function toggleList(
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
  listType?: NodeType,
): boolean {
  if (!dispatch || !listType) return false;
  const { $from } = state.selection;
  const currentList = findParentList($from);

  if (currentList?.listType === listType) {
    const listItem = findListItem($from);
    const taskRange = listItem ? getTaskMarkerRange(listItem) : null;
    const tr = taskRange ? state.tr.delete(taskRange.from, taskRange.to) : undefined;
    return liftCurrentListItem(state, dispatch, tr);
  }

  if (currentList) {
    dispatch(state.tr.setNodeMarkup(currentList.listPos, listType, getListAttrsForType(listType)));
    return true;
  }

  return wrapInList(listType, getListAttrsForType(listType))(state, dispatch);
}

// 切换任务列表：任务项 → 去掉 [ ]/[x] 并保留列表；普通列表项 → 加上 [ ]；正文 → 创建无序任务列表
// 适配 state/dispatch 签名，可直接用于 ProseMirror keymap
export function toggleTaskListAtCursor(
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
): boolean {
  if (!dispatch) return false;
  const { $from } = state.selection;
  const listItem = findListItem($from);

  if (listItem) {
    const textInfo = findFirstTextInItem(listItem.itemNode);
    if (!textInfo) return false;
    const textPos = listItem.itemPos + 1 + textInfo.offset;
    const taskRange = getTaskMarkerRange(listItem);

    if (taskRange) {
      dispatch(state.tr.delete(taskRange.from, taskRange.to));
      return true;
    }

    dispatch(state.tr.insertText('[ ] ', textPos));
    return true;
  }

  const textStart = $from.start();
  const tr = state.tr;
  if ($from.parent.type !== schema.nodes.paragraph) {
    if (!appendCommandSteps(state, tr, setBlockType(schema.nodes.paragraph))) return false;
  }
  if (
    !appendCommandSteps(
      state,
      tr,
      wrapInList(schema.nodes.bullet_list, getListAttrsForType(schema.nodes.bullet_list)),
    )
  )
    return false;

  tr.insertText('[ ] ', tr.mapping.map(textStart));
  dispatch(tr);
  return true;
}

export function executeEditorCommand(
  command: EditorCommand,
  view: EditorView,
  markdown: string,
  setMarkdown: MarkdownSetter,
): boolean {
  const { state, dispatch } = view;
  const run = (fn: (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean) =>
    fn(state, dispatch);

  switch (command.type) {
    case 'toggleBold':
      return run(toggleMark(schema.marks.strong));
    case 'toggleItalic':
      return run(toggleMark(schema.marks.em));
    case 'toggleCode':
      return run(toggleMark(schema.marks.code));
    case 'setHeading':
      return toggleHeading(view, command.level);
    case 'setParagraph':
      return run(setBlockType(schema.nodes.paragraph));
    case 'toggleBlockquote':
      return run(wrapIn(schema.nodes.blockquote));
    case 'toggleBulletList':
      return toggleList(state, dispatch, schema.nodes.bullet_list);
    case 'toggleOrderedList':
      return toggleList(state, dispatch, schema.nodes.ordered_list);
    case 'insertLink':
      return insertTextWithOptionalMark(view, command.text ?? command.href, schema.marks.link, {
        href: command.href,
        title: command.title ?? null,
      });
    case 'insertImage':
      return insertInlineNode(view, schema.nodes.image, {
        src: command.src,
        alt: command.alt ?? null,
        title: command.title ?? null,
      });
    case 'insertCodeBlock':
      return insertBlock(
        view,
        schema.nodes.code_block,
        command.code ?? '',
        command.language ? { params: command.language } : undefined,
      );
    case 'toggleTaskList':
      return toggleTaskListAtCursor(state, dispatch);
    case 'insertMathBlock': {
      const tex = command.tex ?? 'E = mc^2';
      const node = schema.nodes.math_block.create({ tex });
      const { $from, empty } = state.selection;
      // 如果光标在顶层（doc 直接子节点），精确选中新建的 math_block；
      // 否则（如在列表项内）追加到文档末尾，避免破坏嵌套结构。
      if ($from.depth <= 1) {
        if (empty && $from.parent.isTextblock && $from.parent.content.size === 0) {
          const blockStart = $from.before(1);
          const blockEnd = $from.after(1);
          const tr = state.tr.replaceWith(blockStart, blockEnd, node);
          tr.setSelection(NodeSelection.create(tr.doc, blockStart));
          view.dispatch(tr.scrollIntoView());
        } else {
          const tr = state.tr.replaceSelectionWith(node);
          const newPos = tr.mapping.map(state.selection.from, -1);
          if (tr.doc.nodeAt(newPos)?.type === schema.nodes.math_block) {
            tr.setSelection(NodeSelection.create(tr.doc, newPos));
          }
          view.dispatch(tr.scrollIntoView());
        }
      } else {
        const endPos = state.doc.content.size;
        const tr = state.tr.insert(endPos, node);
        tr.setSelection(NodeSelection.create(tr.doc, endPos));
        view.dispatch(tr.scrollIntoView());
      }
      return true;
    }
    case 'insertMermaidBlock':
      return insertMarkdownSnippet(
        markdown,
        setMarkdown,
        `\`\`\`mermaid\n${command.code ?? 'flowchart TD\\n  A --> B'}\n\`\`\`\n`,
      );
    case 'insertTable': {
      const tableNode = createTableNode(command.rows ?? 3, command.columns ?? 3);
      return insertTable(view, tableNode);
    }
    case 'addTableRowBefore':
      return run(addTableRowBefore());
    case 'addTableRowAfter':
      return run(addTableRowAfter());
    case 'addTableColumnBefore':
      return run(addTableColumnBefore());
    case 'addTableColumnAfter':
      return run(addTableColumnAfter());
    case 'deleteTableRow':
      return run(deleteCurrentTableRow());
    case 'deleteTableColumn':
      return run(deleteCurrentTableColumn());
    case 'deleteTable':
      return run(deleteCurrentTable());
    case 'toggleTableHeader':
      return run(toggleFirstTableRowHeader());
    case 'setTableColumnAlignment':
      return run(setTableColumnAlignment(command.align));
    case 'insertParagraphAfter':
      return insertParagraphAfterCurrentBlock(state, dispatch);
    case 'insertParagraphBefore':
      return insertParagraphBeforeCurrentBlock(state, dispatch);
    case 'undo':
      return run(undo);
    case 'redo':
      return run(redo);
    case 'scrollToHeading':
      return scrollToHeading(view, command.headingIndex);
    default:
      return false;
  }
}

function scrollToHeading(view: EditorView, headingIndex: number): boolean {
  let foundPos: number | null = null;
  let headingCount = 0;
  view.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      headingCount += 1;
      if (headingCount === headingIndex + 1) {
        foundPos = pos;
        return false;
      }
    }
  });

  if (foundPos === null) return false;

  const $pos = view.state.doc.resolve(foundPos);
  view.dispatch(view.state.tr.setSelection(TextSelection.near($pos)).scrollIntoView());
  return true;
}

function insertTextWithOptionalMark(
  view: EditorView,
  text: string,
  markType: MarkType,
  attrs: Record<string, unknown>,
): boolean {
  const mark = markType.create(attrs);
  view.dispatch(
    view.state.tr.replaceSelectionWith(schema.text(text, [mark]), false).scrollIntoView(),
  );
  return true;
}

function insertInlineNode(
  view: EditorView,
  type: NodeType,
  attrs: Record<string, unknown>,
): boolean {
  const node = type.createAndFill(attrs);
  if (!node) return false;

  view.dispatch(view.state.tr.replaceSelectionWith(node).scrollIntoView());
  return true;
}

function insertTable(view: EditorView, tableNode: PmNode): boolean {
  const { state } = view;
  const { $from, empty } = state.selection;

  // 步骤1：空段落中插入表格时，替换整个段落，确保表格起点不会贴到下方旧表格。
  if (empty && $from.depth === 1 && $from.parent.isTextblock && $from.parent.content.size === 0) {
    const tablePos = $from.before(1);
    const blockEnd = $from.after(1);
    const tr = state.tr.replaceWith(tablePos, blockEnd, tableNode);
    setSelectionInFirstTableCell(tr, tablePos);
    view.dispatch(tr.scrollIntoView());
    return true;
  }

  const tr = state.tr.replaceSelectionWith(tableNode);
  const tablePos = tr.mapping.map(state.selection.from, -1);
  if (tr.doc.nodeAt(tablePos)?.type === schema.nodes.table) {
    setSelectionInFirstTableCell(tr, tablePos);
  }
  view.dispatch(tr.scrollIntoView());
  return true;
}

function setSelectionInFirstTableCell(tr: Transaction, tablePos: number): void {
  const table = tr.doc.nodeAt(tablePos);
  if (!table || table.type !== schema.nodes.table) return;

  let textPos: number | null = null;
  table.descendants((node, pos) => {
    if (textPos === null && node.isTextblock) {
      textPos = tablePos + 1 + pos + 1;
      return false;
    }
    return true;
  });

  if (textPos !== null) {
    tr.setSelection(TextSelection.create(tr.doc, textPos));
  }
}

function insertBlock(
  view: EditorView,
  type: NodeType,
  text: string,
  attrs?: Record<string, unknown>,
): boolean {
  const content = text ? schema.text(text) : undefined;
  const node = type.create(attrs, content);
  const { state } = view;
  const { $from, empty } = state.selection;

  // 步骤1：空段落插入块时，直接替换整个段落。
  // 这样能拿到新节点的精确起点，避免相邻代码块之间用近似位置误进入旧块。
  if (empty && $from.depth === 1 && $from.parent.isTextblock && $from.parent.content.size === 0) {
    const blockStart = $from.before(1);
    const blockEnd = $from.after(1);
    const tr = state.tr.replaceWith(blockStart, blockEnd, node);
    if (type.name === 'code_block') {
      tr.setSelection(NodeSelection.create(tr.doc, blockStart));
    }
    view.dispatch(tr.scrollIntoView());
    return true;
  }

  const tr = state.tr.replaceSelectionWith(node);
  const newPos = tr.mapping.map(state.selection.from, -1);
  if (type.name === 'code_block' && tr.doc.nodeAt(newPos)?.type === type) {
    tr.setSelection(NodeSelection.create(tr.doc, newPos));
  }
  view.dispatch(tr.scrollIntoView());
  return true;
}

function insertMarkdownSnippet(
  markdown: string,
  setMarkdown: MarkdownSetter,
  snippet: string,
): boolean {
  const separator = markdown.endsWith('\n') ? '\n' : '\n\n';
  setMarkdown(`${markdown}${separator}${snippet}`, { reason: 'programmatic-update' });
  return true;
}
