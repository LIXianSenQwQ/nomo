import { setBlockType, toggleMark, wrapIn } from 'prosemirror-commands';
import { redo, undo } from 'prosemirror-history';
import { wrapInList } from 'prosemirror-schema-list';
import type { MarkType, NodeType } from 'prosemirror-model';
import { EditorState, TextSelection, type Transaction } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { createTableMarkdown } from './markdown';
import { schema } from './schema';
import {
  addTableColumnAfter,
  addTableColumnBefore,
  addTableRowAfter,
  addTableRowBefore,
  deleteCurrentTable,
  deleteCurrentTableColumn,
  deleteCurrentTableRow,
  setTableColumnAlignment,
  toggleFirstTableRowHeader
} from './tableCommands';
import type { EditorCommand, SetMarkdownOptions } from './types';

type MarkdownSetter = (markdown: string, options?: SetMarkdownOptions) => void;

/** 如果当前已是同级标题，则取消为正文；否则设为对应级别 */
function toggleHeading(view: EditorView, level: number): boolean {
  const { $from } = view.state.selection;
  // 向上遍历祖先节点找到包裹的 heading
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

export function executeEditorCommand(command: EditorCommand, view: EditorView, markdown: string, setMarkdown: MarkdownSetter): boolean {
  const { state, dispatch } = view;
  const run = (fn: (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean) => fn(state, dispatch);

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
      return run(wrapInList(schema.nodes.bullet_list));
    case 'toggleOrderedList':
      return run(wrapInList(schema.nodes.ordered_list));
    case 'insertLink':
      return insertTextWithOptionalMark(view, command.text ?? command.href, schema.marks.link, {
        href: command.href,
        title: command.title ?? null
      });
    case 'insertImage':
      return insertInlineNode(view, schema.nodes.image, {
        src: command.src,
        alt: command.alt ?? null,
        title: command.title ?? null
      });
    case 'insertCodeBlock':
      return insertBlock(view, schema.nodes.code_block, command.code ?? '', command.language ? { params: command.language } : undefined);
    case 'toggleTaskList':
      return insertMarkdownSnippet(markdown, setMarkdown, '- [ ] 待办事项\n');
    case 'insertMathBlock':
      return insertMarkdownSnippet(markdown, setMarkdown, `$$\n${command.tex ?? 'E = mc^2'}\n$$\n`);
    case 'insertMermaidBlock':
      return insertMarkdownSnippet(markdown, setMarkdown, `\`\`\`mermaid\n${command.code ?? 'flowchart TD\\n  A --> B'}\n\`\`\`\n`);
    case 'insertTable':
      return insertMarkdownSnippet(markdown, setMarkdown, createTableMarkdown(command.rows ?? 3, command.columns ?? 3));
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

function insertTextWithOptionalMark(view: EditorView, text: string, markType: MarkType, attrs: Record<string, unknown>): boolean {
  const mark = markType.create(attrs);
  view.dispatch(view.state.tr.replaceSelectionWith(schema.text(text, [mark]), false).scrollIntoView());
  return true;
}

function insertInlineNode(view: EditorView, type: NodeType, attrs: Record<string, unknown>): boolean {
  const node = type.createAndFill(attrs);
  if (!node) return false;

  view.dispatch(view.state.tr.replaceSelectionWith(node).scrollIntoView());
  return true;
}

function insertBlock(view: EditorView, type: NodeType, text: string, attrs?: Record<string, unknown>): boolean {
  const content = text ? schema.text(text) : undefined;
  const node = type.create(attrs, content);
  view.dispatch(view.state.tr.replaceSelectionWith(node).scrollIntoView());
  return true;
}

function insertMarkdownSnippet(markdown: string, setMarkdown: MarkdownSetter, snippet: string): boolean {
  const separator = markdown.endsWith('\n') ? '\n' : '\n\n';
  setMarkdown(`${markdown}${separator}${snippet}`, { reason: 'programmatic-update' });
  return true;
}
