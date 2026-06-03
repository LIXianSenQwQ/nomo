import type { EditorState, Transaction } from 'prosemirror-state';
import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { isInTable, TableMap } from 'prosemirror-tables';
import type { Node } from 'prosemirror-model';
import {
  addTableColumnAfter,
  addTableColumnBefore,
  addTableRowAfter,
  addTableRowBefore,
  deleteCurrentTable,
  deleteCurrentTableColumn,
  deleteCurrentTableRow,
  normalizeFirstTableRowHeader,
  setTableColumnAlignment,
  toggleFirstTableRowHeader,
} from '../tableCommands';
import { findActiveTableElement } from './tableControlDom';

export const tableControlsKey = new PluginKey('tableControls');

type TableControlsOptions = {
  showOuterBorderInsertButtons?: boolean;
};

export function tableControlsPlugin(options: TableControlsOptions = {}): Plugin {
  return new Plugin({
    key: tableControlsKey,
    view(view) {
      return new TableControlsView(view, options);
    },
  });
}

class TableControlsView {
  private readonly dom = document.createElement('div');
  private readonly refresh = () => requestAnimationFrame(() => this.update(this.view));

  constructor(
    private readonly view: EditorView,
    private readonly options: TableControlsOptions,
  ) {
    this.dom.className = 'table-inline-controls';
    this.dom.setAttribute('contenteditable', 'false');
    this.view.dom.parentElement?.appendChild(this.dom);
    this.view.dom.addEventListener('focusin', this.refresh);
    this.view.dom.addEventListener('mouseup', this.refresh);
    this.view.dom.addEventListener('keyup', this.refresh);
    this.update(view);
  }

  // ===== 生命周期 =====

  update(view: EditorView): void {
    const table = findActiveTableElement(view);
    if (!isInTable(view.state) || !table) {
      this.dom.classList.remove('visible');
      this.dom.replaceChildren();
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

    const rows = table.rows;
    const rowCount = rows.length;
    const colCount = rows[0]?.cells.length ?? 0;
    if (rowCount === 0 || colCount === 0) return;

    this.dom.replaceChildren();

    // 步骤1：渲染行/列插入按钮（跳过外边缘，由边框按钮处理）
    this.renderRowInsertButtons(table, rowCount);
    this.renderColInsertButtons(table, colCount);

    // 步骤2：可选渲染表格外边框上的线性插入按钮；当前设计暂时隐藏，保留入口便于后续迭代。
    if (this.options.showOuterBorderInsertButtons) {
      this.renderOuterBorderButtons(table, rowCount, colCount);
    }

    // 步骤3：渲染删除按钮（所有行的左侧 + 所有列的下方）
    this.renderRowDeleteButtons(table, rowCount);
    this.renderColDeleteButtons(table, rowCount, colCount);

    // 步骤4：渲染表格工具条（边界新增、对齐、表头、删除表格）
    this.renderUtilityBar(rowCount, colCount);

    this.dom.classList.add('visible');
  }

  destroy(): void {
    this.view.dom.removeEventListener('focusin', this.refresh);
    this.view.dom.removeEventListener('mouseup', this.refresh);
    this.view.dom.removeEventListener('keyup', this.refresh);
    this.dom.remove();
  }

  // ===== 渲染：行插入按钮 =====

  private renderRowInsertButtons(table: HTMLTableElement, rowCount: number): void {
    const tableRows = table.rows;
    const tableRect = table.getBoundingClientRect();

    // 仅处理行间隙（1..rowCount-1），四角边缘由边框按钮处理
    for (let i = 1; i < rowCount; i++) {
      const y = this.rowGapY(tableRows, i, tableRect);
      const title = `在第 ${i} 行和第 ${i + 1} 行之间插入行`;

      const leftBtn = this.createButton(title, '+', 'row-insert-left', () => this.insertRowAt(i));
      leftBtn.style.top = `${y}px`;
      this.dom.appendChild(leftBtn);

      const rightBtn = this.createButton(title, '+', 'row-insert-right', () => this.insertRowAt(i));
      rightBtn.style.top = `${y}px`;
      this.dom.appendChild(rightBtn);
    }
  }

  /** 计算第 pos 个行间隙的垂直中心（相对于表格 overlay） */
  private rowGapY(
    rows: HTMLCollectionOf<HTMLTableRowElement>,
    pos: number,
    tableRect: DOMRect,
  ): number {
    if (pos === 0) {
      // 第一行上方
      const rowTop = rows[0].getBoundingClientRect().top - tableRect.top;
      return rowTop;
    }
    if (pos === rows.length) {
      // 最后一行下方
      const rowBottom = rows[rows.length - 1].getBoundingClientRect().bottom - tableRect.top;
      return rowBottom;
    }
    // 第 pos-1 行和第 pos 行之间的间隙
    const prevBottom = rows[pos - 1].getBoundingClientRect().bottom - tableRect.top;
    const currTop = rows[pos].getBoundingClientRect().top - tableRect.top;
    return Math.round((prevBottom + currTop) / 2);
  }

  // ===== 渲染：列插入按钮 =====

  private renderColInsertButtons(table: HTMLTableElement, colCount: number): void {
    const firstRowCells = table.rows[0]?.cells;
    if (!firstRowCells) return;

    const tableRect = table.getBoundingClientRect();

    // 仅处理列间隙（1..colCount-1），四角边缘由边框按钮处理
    for (let j = 1; j < colCount; j++) {
      const x = this.colGapX(firstRowCells, j, tableRect);
      const title = `在第 ${j} 列和第 ${j + 1} 列之间插入列`;

      const topBtn = this.createButton(title, '+', 'col-insert-top', () => this.insertColumnAt(j));
      topBtn.style.left = `${x}px`;
      this.dom.appendChild(topBtn);

      const bottomBtn = this.createButton(title, '+', 'col-insert-bottom', () =>
        this.insertColumnAt(j),
      );
      bottomBtn.style.left = `${x}px`;
      this.dom.appendChild(bottomBtn);
    }
  }

  /** 计算第 pos 个列间隙的水平中心（相对于表格 overlay） */
  private colGapX(
    cells: HTMLCollectionOf<HTMLTableCellElement>,
    pos: number,
    tableRect: DOMRect,
  ): number {
    if (pos === 0) {
      // 第一列左侧
      return cells[0].getBoundingClientRect().left - tableRect.left;
    }
    if (pos === cells.length) {
      // 最后一列右侧
      return cells[cells.length - 1].getBoundingClientRect().right - tableRect.left;
    }
    // 第 pos-1 列和第 pos 列之间的间隙
    const prevRight = cells[pos - 1].getBoundingClientRect().right - tableRect.left;
    const currLeft = cells[pos].getBoundingClientRect().left - tableRect.left;
    return Math.round((prevRight + currLeft) / 2);
  }

  // ===== 渲染：表格外边框上的线性插入控件 =====

  /** 控件厚度：实际视觉贴边，命中区在边框两侧各留一半 */
  private static readonly BORDER_CTRL_HIT_SIZE = 18;

  private renderOuterBorderButtons(
    table: HTMLTableElement,
    rowCount: number,
    colCount: number,
  ): void {
    const tableRect = table.getBoundingClientRect();
    const firstRow = table.rows[0];
    const lastRow = table.rows[rowCount - 1];
    if (!firstRow || !lastRow) return;

    const rendered = new Set<string>();

    // 顶部/底部整条外边框用于插入行，按边缘单元格分段铺满表格宽度。
    for (const cell of Array.from(firstRow.cells)) {
      this.addBorderCtrl(tableRect, cell, 'top', '在第一行前插入行', rendered, () =>
        this.insertRowAt(0),
      );
    }
    for (const cell of Array.from(lastRow.cells)) {
      this.addBorderCtrl(tableRect, cell, 'bottom', '在最后一行后插入行', rendered, () =>
        this.insertRowAt(rowCount),
      );
    }

    // 左侧/右侧整条外边框用于插入列，按边缘单元格分段铺满表格高度。
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
      const row = table.rows[rowIndex];
      const leftCell = row.cells[0];
      const rightCell = row.cells[colCount - 1];
      if (leftCell) {
        this.addBorderCtrl(tableRect, leftCell, 'left', '在第一列前插入列', rendered, () =>
          this.insertColumnAt(0),
        );
      }
      if (rightCell) {
        this.addBorderCtrl(tableRect, rightCell, 'right', '在最后一列后插入列', rendered, () =>
          this.insertColumnAt(colCount),
        );
      }
    }
  }

  /** 创建贴合角落单元格外边框的轻量插入控件 */
  private addBorderCtrl(
    tableRect: DOMRect,
    cell: HTMLTableCellElement,
    side: 'top' | 'bottom' | 'left' | 'right',
    title: string,
    rendered: Set<string>,
    onClick: () => void,
  ): void {
    const cellRect = cell.getBoundingClientRect();
    const hitSize = TableControlsView.BORDER_CTRL_HIT_SIZE;
    const relativeLeft = cellRect.left - tableRect.left;
    const relativeTop = cellRect.top - tableRect.top;
    const key = [
      side,
      Math.round(relativeLeft),
      Math.round(relativeTop),
      Math.round(cellRect.width),
      Math.round(cellRect.height),
    ].join(':');
    if (rendered.has(key)) return;
    rendered.add(key);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `table-ctrl-btn border-insert-btn border-insert-${side}`;
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    });

    // 定位：独立 button 的命中区骑在单元格外边框线上，视觉线条贴合边框本身。
    switch (side) {
      case 'top':
        btn.style.left = `${relativeLeft + cellRect.width * 0.5}px`;
        btn.style.top = `${relativeTop}px`;
        btn.style.width = `${cellRect.width}px`;
        btn.style.height = `${hitSize}px`;
        break;
      case 'bottom':
        btn.style.left = `${relativeLeft + cellRect.width * 0.5}px`;
        btn.style.top = `${cellRect.bottom - tableRect.top}px`;
        btn.style.width = `${cellRect.width}px`;
        btn.style.height = `${hitSize}px`;
        break;
      case 'left':
        btn.style.left = `${relativeLeft}px`;
        btn.style.top = `${relativeTop + cellRect.height * 0.5}px`;
        btn.style.width = `${hitSize}px`;
        btn.style.height = `${cellRect.height}px`;
        break;
      case 'right':
        btn.style.left = `${cellRect.right - tableRect.left}px`;
        btn.style.top = `${relativeTop + cellRect.height * 0.5}px`;
        btn.style.width = `${hitSize}px`;
        btn.style.height = `${cellRect.height}px`;
        break;
    }
    btn.style.transform = 'translate(-50%, -50%)';

    this.dom.appendChild(btn);
  }

  // ===== 渲染：删除行按钮（每行左侧） =====

  private renderRowDeleteButtons(table: HTMLTableElement, rowCount: number): void {
    const tableRows = table.rows;
    const tableRect = table.getBoundingClientRect();

    for (let r = 0; r < rowCount; r++) {
      const rowRect = tableRows[r].getBoundingClientRect();
      const centerY = rowRect.top - tableRect.top + rowRect.height / 2;

      const btn = this.createButton(`删除第 ${r + 1} 行`, '−', 'delete-row-btn', () =>
        this.deleteRowAt(r, 0),
      );
      btn.style.top = `${Math.round(centerY)}px`;
      this.dom.appendChild(btn);
    }
  }

  // ===== 渲染：删除列按钮（每列下方） =====

  private renderColDeleteButtons(
    table: HTMLTableElement,
    _rowCount: number,
    colCount: number,
  ): void {
    const firstRowCells = table.rows[0]?.cells;
    if (!firstRowCells) return;

    const tableRect = table.getBoundingClientRect();

    for (let c = 0; c < colCount; c++) {
      const cellRect = firstRowCells[c].getBoundingClientRect();
      const centerX = cellRect.left - tableRect.left + cellRect.width / 2;

      const btn = this.createButton(`删除第 ${c + 1} 列`, '−', 'delete-col-btn', () =>
        this.deleteColumnAt(0, c),
      );
      btn.style.left = `${Math.round(centerX)}px`;
      this.dom.appendChild(btn);
    }
  }

  // ===== 渲染：工具条（对齐、表头、删除表格） =====

  private renderUtilityBar(rowCount: number, colCount: number): void {
    const bar = this.el('div', 'table-util-bar');

    bar.appendChild(
      this.createButton(
        '在第一行前插入行',
        '',
        'boundary-insert-btn boundary-insert-row-before',
        () => this.insertRowAt(0),
      ),
    );
    bar.appendChild(
      this.createButton(
        '在第一列前插入列',
        '',
        'boundary-insert-btn boundary-insert-column-before',
        () => this.insertColumnAt(0),
      ),
    );
    bar.appendChild(
      this.createButton(
        '在最后一行后插入行',
        '',
        'boundary-insert-btn boundary-insert-row-after',
        () => this.insertRowAt(rowCount),
      ),
    );
    bar.appendChild(
      this.createButton(
        '在最后一列后插入列',
        '',
        'boundary-insert-btn boundary-insert-column-after',
        () => this.insertColumnAt(colCount),
      ),
    );
    bar.appendChild(this.el('span', 'table-util-separator'));

    bar.appendChild(
      this.createButton('左对齐', '≡', 'util-btn util-align-left', () =>
        this.run(setTableColumnAlignment('left')),
      ),
    );
    bar.appendChild(
      this.createButton('居中对齐', '≣', 'util-btn util-align-center', () =>
        this.run(setTableColumnAlignment('center')),
      ),
    );
    bar.appendChild(
      this.createButton('右对齐', '≡', 'util-btn util-align-right', () =>
        this.run(setTableColumnAlignment('right')),
      ),
    );
    bar.appendChild(
      this.createButton('切换表头行', 'H', 'util-btn util-header-row', () =>
        this.run(toggleFirstTableRowHeader()),
      ),
    );
    bar.appendChild(
      this.createButton('删除整张表格', '⌫', 'util-btn util-delete-table util-btn-danger', () =>
        this.run(deleteCurrentTable()),
      ),
    );

    this.dom.appendChild(bar);
  }

  // ===== 按钮工厂 =====

  private createButton(
    title: string,
    label: string,
    className: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `table-ctrl-btn ${className}`;
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

  // ===== 操作：插入行 =====

  private insertRowAt(pos: number): void {
    const info = this.getTableInfo();
    if (!info) return;
    const map = TableMap.get(info.node);

    // 将光标移到目标行，然后执行插入命令
    if (pos === 0) {
      this.moveCursorTo(info, map, 0, 0);
      addTableRowBefore()(this.view.state, (tr) => this.view.dispatch(tr));
      normalizeFirstTableRowHeader()(this.view.state, (tr) => this.view.dispatch(tr));
    } else if (pos >= map.height) {
      this.moveCursorTo(info, map, map.height - 1, 0);
      addTableRowAfter()(this.view.state, (tr) => this.view.dispatch(tr));
    } else {
      this.moveCursorTo(info, map, pos - 1, 0);
      addTableRowAfter()(this.view.state, (tr) => this.view.dispatch(tr));
    }
    this.view.focus();
  }

  // ===== 操作：插入列 =====

  private insertColumnAt(pos: number): void {
    const info = this.getTableInfo();
    if (!info) return;
    const map = TableMap.get(info.node);

    if (pos === 0) {
      this.moveCursorTo(info, map, 0, 0);
      addTableColumnBefore()(this.view.state, (tr) => this.view.dispatch(tr));
    } else if (pos >= map.width) {
      this.moveCursorTo(info, map, 0, map.width - 1);
      addTableColumnAfter()(this.view.state, (tr) => this.view.dispatch(tr));
    } else {
      this.moveCursorTo(info, map, 0, pos - 1);
      addTableColumnAfter()(this.view.state, (tr) => this.view.dispatch(tr));
    }
    this.view.focus();
  }

  // ===== 操作：删除行/列 =====

  private deleteRowAt(row: number, col: number): void {
    const info = this.getTableInfo();
    if (!info) return;
    const map = TableMap.get(info.node);
    this.moveCursorTo(info, map, row, col);
    deleteCurrentTableRow()(this.view.state, (tr) => this.view.dispatch(tr));
    this.view.focus();
  }

  private deleteColumnAt(row: number, col: number): void {
    const info = this.getTableInfo();
    if (!info) return;
    const map = TableMap.get(info.node);
    this.moveCursorTo(info, map, row, col);
    deleteCurrentTableColumn()(this.view.state, (tr) => this.view.dispatch(tr));
    this.view.focus();
  }

  // ===== 辅助方法 =====

  /** 将光标移动到指定单元格内 */
  private moveCursorTo(
    info: { tableStart: number; node: Node },
    map: TableMap,
    row: number,
    col: number,
  ): void {
    const cellNodePos = info.tableStart + map.positionAt(row, col, info.node);
    const tr = this.view.state.tr.setSelection(
      TextSelection.create(this.view.state.doc, cellNodePos + 1),
    );
    this.view.dispatch(tr);
  }

  private run(
    command: (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean,
  ): void {
    command(this.view.state, (tr) => this.view.dispatch(tr));
    this.view.focus();
    this.update(this.view);
  }

  /** 获取当前光标所在表格的信息 */
  private getTableInfo(): { tableStart: number; node: Node } | null {
    const { $from } = this.view.state.selection;
    for (let depth = $from.depth; depth > 0; depth--) {
      const node = $from.node(depth);
      if (node.type.spec.tableRole === 'table') {
        return {
          tableStart: $from.before(depth) + 1,
          node,
        };
      }
    }
    return null;
  }

  private el(tag: string, className: string): HTMLElement {
    const e = document.createElement(tag);
    e.className = className;
    return e;
  }
}
