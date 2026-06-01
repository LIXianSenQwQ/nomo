import type { EditorState, Transaction } from 'prosemirror-state';
import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { isInTable } from 'prosemirror-tables';
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
} from '../tableCommands';

export const tableControlsKey = new PluginKey('tableControls');

export function tableControlsPlugin(): Plugin {
  return new Plugin({
    key: tableControlsKey,
    view(view) {
      return new TableControlsView(view);
    }
  });
}

class TableControlsView {
  private readonly dom = document.createElement('div');
  private readonly refresh = () => requestAnimationFrame(() => this.update(this.view));

  constructor(private readonly view: EditorView) {
    this.dom.className = 'table-inline-controls';
    this.dom.setAttribute('contenteditable', 'false');
    this.dom.append(
      this.createGroup('table-column-controls', [
        this.createButton('左对齐', '≡', () => this.run(setTableColumnAlignment('left'))),
        this.createButton('居中对齐', '≣', () => this.run(setTableColumnAlignment('center'))),
        this.createButton('右对齐', '≡', () => this.run(setTableColumnAlignment('right'))),
        this.createButton('左侧插入列', '+C', () => this.run(addTableColumnBefore())),
        this.createButton('右侧插入列', 'C+', () => this.run(addTableColumnAfter())),
        this.createButton('删除当前列', '−C', () => this.run(deleteCurrentTableColumn())),
        this.createButton('切换表头', 'H', () => this.run(toggleFirstTableRowHeader())),
        this.createButton('删除表格', '⌫', () => this.run(deleteCurrentTable()))
      ]),
      this.createGroup('table-row-controls', [
        this.createButton('上方插入行', '+R', () => this.run(addTableRowBefore())),
        this.createButton('下方插入行', 'R+', () => this.run(addTableRowAfter())),
        this.createButton('删除当前行', '−R', () => this.run(deleteCurrentTableRow()))
      ]),
      this.createGroup('table-edge-controls', [
        this.createButton('新增行', '+R', () => this.run(addTableRowAfter())),
        this.createButton('新增列', '+C', () => this.run(addTableColumnAfter()))
      ])
    );
    this.view.dom.parentElement?.appendChild(this.dom);
    this.view.dom.addEventListener('focusin', this.refresh);
    this.view.dom.addEventListener('mouseup', this.refresh);
    this.view.dom.addEventListener('keyup', this.refresh);
    this.update(view);
  }

  update(view: EditorView): void {
    const table = findActiveTableElement(view);
    if (!isInTable(view.state) || !table) {
      this.dom.classList.remove('visible');
      return;
    }

    const hostRect = view.dom.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    const left = tableRect.left - hostRect.left + view.dom.scrollLeft;
    const top = tableRect.top - hostRect.top + view.dom.scrollTop;

    this.dom.style.setProperty('--table-control-left', `${Math.max(0, left)}px`);
    this.dom.style.setProperty('--table-control-top', `${Math.max(0, top)}px`);
    this.dom.style.setProperty('--table-control-width', `${tableRect.width}px`);
    this.dom.style.setProperty('--table-control-height', `${tableRect.height}px`);
    this.dom.classList.add('visible');
  }

  destroy(): void {
    this.view.dom.removeEventListener('focusin', this.refresh);
    this.view.dom.removeEventListener('mouseup', this.refresh);
    this.view.dom.removeEventListener('keyup', this.refresh);
    this.dom.remove();
  }

  private createGroup(className: string, buttons: HTMLButtonElement[]): HTMLDivElement {
    const group = document.createElement('div');
    group.className = className;
    group.append(...buttons);
    return group;
  }

  private createButton(title: string, label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.title = title;
    button.setAttribute('aria-label', title);
    button.textContent = label;
    button.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    });
    return button;
  }

  private run(command: (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean): void {
    command(this.view.state, (tr) => this.view.dispatch(tr));
    this.view.focus();
    this.update(this.view);
  }
}

function findActiveTableElement(view: EditorView): HTMLTableElement | null {
  const { $from } = view.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.spec.tableRole === 'table') {
      const tablePosition = $from.before(depth);
      const dom = view.nodeDOM(tablePosition);
      return dom instanceof HTMLTableElement ? dom : dom instanceof HTMLElement ? dom.querySelector('table') : null;
    }
  }
  return null;
}
