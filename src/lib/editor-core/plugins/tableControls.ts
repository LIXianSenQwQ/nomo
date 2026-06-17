import type { EditorState, Transaction } from 'prosemirror-state';
import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { isInTable, TableMap } from 'prosemirror-tables';
import type { Node } from 'prosemirror-model';
import { onInterfaceLocaleChanged, t } from '../../../app/i18n';
import {
  addTableColumnAfter,
  addTableColumnBefore,
  addTableRowAfter,
  addTableRowBefore,
  deleteCurrentTable,
  deleteCurrentTableColumn,
  deleteCurrentTableRow,
  normalizeFirstTableRowHeader,
  resizeCurrentTable,
  setTableColumnAlignment,
  toggleFirstTableRowHeader,
} from '../tableCommands';
import { findActiveTableElement } from './tableControlDom';

export const tableControlsKey = new PluginKey('tableControls');

type TableControlsOptions = {
  showOuterBorderInsertButtons?: boolean;
};

type OverlayScale = {
  x: number;
  y: number;
};

const DEFAULT_RESIZE_PICKER_ROWS = 5;
const DEFAULT_RESIZE_PICKER_COLUMNS = 6;

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
  private resizePickerOpen = false;
  private resizePreviewRows = 0;
  private resizePreviewColumns = 0;
  private readonly unsubscribeLocale: () => void;
  private readonly closeResizePickerOnDocumentPointerDown = (event: PointerEvent) => {
    if (!this.resizePickerOpen) return;
    if (event.target instanceof globalThis.Node && this.dom.contains(event.target)) return;
    this.closeResizePicker();
  };

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
    document.addEventListener('pointerdown', this.closeResizePickerOnDocumentPointerDown);
    this.unsubscribeLocale = onInterfaceLocaleChanged(() => this.update(this.view));
    this.update(view);
  }

  // ===== 生命周期 =====

  update(view: EditorView): void {
    const table = findActiveTableElement(view);
    if (!isInTable(view.state) || !table) {
      this.resizePickerOpen = false;
      this.dom.classList.remove('visible');
      this.dom.replaceChildren();
      return;
    }

    const overlayHost = this.getOverlayHost(view);
    const hostRect = overlayHost.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    const scale = this.getOverlayScale(overlayHost);
    const left = (tableRect.left - hostRect.left) / scale.x + overlayHost.scrollLeft;
    const top = (tableRect.top - hostRect.top) / scale.y + overlayHost.scrollTop;

    this.dom.style.setProperty('--table-control-left', `${Math.max(0, left)}px`);
    this.dom.style.setProperty('--table-control-top', `${Math.max(0, top)}px`);
    this.dom.style.setProperty('--table-control-width', `${tableRect.width / scale.x}px`);
    this.dom.style.setProperty('--table-control-height', `${tableRect.height / scale.y}px`);

    const rows = table.rows;
    const rowCount = rows.length;
    const colCount = rows[0]?.cells.length ?? 0;
    if (rowCount === 0 || colCount === 0) return;
    if (!this.resizePickerOpen) {
      this.resizePreviewRows = rowCount;
      this.resizePreviewColumns = colCount;
    }

    const rowRects = Array.from(rows, (row) => row.getBoundingClientRect());
    const firstRowCellRects = Array.from(rows[0].cells, (cell) => cell.getBoundingClientRect());

    this.dom.replaceChildren();

    // 步骤1：渲染行/列插入按钮（跳过外边缘，由边框按钮处理）
    this.renderRowInsertButtons(rowCount, tableRect, rowRects, scale);
    this.renderColInsertButtons(colCount, tableRect, firstRowCellRects, scale);

    // 步骤2：可选渲染表格外边框上的线性插入按钮；当前设计暂时隐藏，保留入口便于后续迭代。
    if (this.options.showOuterBorderInsertButtons) {
      this.renderOuterBorderButtons(table, rowCount, colCount, scale);
    }

    // 步骤3：渲染删除按钮（所有行的左侧 + 所有列的下方）
    this.renderRowDeleteButtons(rowCount, tableRect, rowRects, scale);
    this.renderColDeleteButtons(colCount, tableRect, firstRowCellRects, scale);

    // 步骤4：渲染表格工具条（边界新增、对齐、表头、删除表格）
    this.renderUtilityBar(rowCount, colCount);

    this.dom.classList.add('visible');
  }

  destroy(): void {
    this.view.dom.removeEventListener('focusin', this.refresh);
    this.view.dom.removeEventListener('mouseup', this.refresh);
    this.view.dom.removeEventListener('keyup', this.refresh);
    document.removeEventListener('pointerdown', this.closeResizePickerOnDocumentPointerDown);
    this.unsubscribeLocale();
    this.dom.remove();
  }

  // ===== 渲染：行插入按钮 =====

  private renderRowInsertButtons(
    rowCount: number,
    tableRect: DOMRect,
    rowRects: DOMRect[],
    scale: OverlayScale,
  ): void {
    // 仅处理行间隙（1..rowCount-1），四角边缘由边框按钮处理
    for (let i = 1; i < rowCount; i++) {
      const y = this.rowGapY(rowRects, i, tableRect, scale);
      const title = t.insertRowBetween({ from: i, to: i + 1 });

      const leftBtn = this.createButton(title, '+', 'row-insert-left', () => this.insertRowAt(i));
      leftBtn.style.top = `${y}px`;
      this.dom.appendChild(leftBtn);

      const rightBtn = this.createButton(title, '+', 'row-insert-right', () => this.insertRowAt(i));
      rightBtn.style.top = `${y}px`;
      this.dom.appendChild(rightBtn);
    }
  }

  /** 计算第 pos 个行间隙的垂直中心（相对于表格 overlay） */
  private rowGapY(rows: DOMRect[], pos: number, tableRect: DOMRect, scale: OverlayScale): number {
    if (pos === 0) {
      // 第一行上方
      const rowTop = (rows[0].top - tableRect.top) / scale.y;
      return rowTop;
    }
    if (pos === rows.length) {
      // 最后一行下方
      const rowBottom = (rows[rows.length - 1].bottom - tableRect.top) / scale.y;
      return rowBottom;
    }
    // 第 pos-1 行和第 pos 行之间的间隙
    const prevBottom = (rows[pos - 1].bottom - tableRect.top) / scale.y;
    const currTop = (rows[pos].top - tableRect.top) / scale.y;
    return Math.round((prevBottom + currTop) / 2);
  }

  // ===== 渲染：列插入按钮 =====

  private renderColInsertButtons(
    colCount: number,
    tableRect: DOMRect,
    firstRowCellRects: DOMRect[],
    scale: OverlayScale,
  ): void {
    // 仅处理列间隙（1..colCount-1），四角边缘由边框按钮处理
    for (let j = 1; j < colCount; j++) {
      const x = this.colGapX(firstRowCellRects, j, tableRect, scale);
      const title = t.insertColumnBetween({ from: j, to: j + 1 });

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
  private colGapX(cells: DOMRect[], pos: number, tableRect: DOMRect, scale: OverlayScale): number {
    if (pos === 0) {
      // 第一列左侧
      return (cells[0].left - tableRect.left) / scale.x;
    }
    if (pos === cells.length) {
      // 最后一列右侧
      return (cells[cells.length - 1].right - tableRect.left) / scale.x;
    }
    // 第 pos-1 列和第 pos 列之间的间隙
    const prevRight = (cells[pos - 1].right - tableRect.left) / scale.x;
    const currLeft = (cells[pos].left - tableRect.left) / scale.x;
    return Math.round((prevRight + currLeft) / 2);
  }

  // ===== 渲染：表格外边框上的线性插入控件 =====

  /** 控件厚度：实际视觉贴边，命中区在边框两侧各留一半 */
  private static readonly BORDER_CTRL_HIT_SIZE = 18;

  private renderOuterBorderButtons(
    table: HTMLTableElement,
    rowCount: number,
    colCount: number,
    scale: OverlayScale,
  ): void {
    const tableRect = table.getBoundingClientRect();
    const firstRow = table.rows[0];
    const lastRow = table.rows[rowCount - 1];
    if (!firstRow || !lastRow) return;

    const rendered = new Set<string>();

    // 顶部/底部整条外边框用于插入行，按边缘单元格分段铺满表格宽度。
    for (const cell of Array.from(firstRow.cells)) {
      this.addBorderCtrl(tableRect, cell, 'top', t.insertRowBeforeFirst(), rendered, scale, () =>
        this.insertRowAt(0),
      );
    }
    for (const cell of Array.from(lastRow.cells)) {
      this.addBorderCtrl(tableRect, cell, 'bottom', t.insertRowAfterLast(), rendered, scale, () =>
        this.insertRowAt(rowCount),
      );
    }

    // 左侧/右侧整条外边框用于插入列，按边缘单元格分段铺满表格高度。
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
      const row = table.rows[rowIndex];
      const leftCell = row.cells[0];
      const rightCell = row.cells[colCount - 1];
      if (leftCell) {
        this.addBorderCtrl(
          tableRect,
          leftCell,
          'left',
          t.insertColumnBeforeFirst(),
          rendered,
          scale,
          () => this.insertColumnAt(0),
        );
      }
      if (rightCell) {
        this.addBorderCtrl(
          tableRect,
          rightCell,
          'right',
          t.insertColumnAfterLast(),
          rendered,
          scale,
          () => this.insertColumnAt(colCount),
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
    scale: OverlayScale,
    onClick: () => void,
  ): void {
    const cellRect = cell.getBoundingClientRect();
    const hitSize = TableControlsView.BORDER_CTRL_HIT_SIZE;
    const relativeLeft = (cellRect.left - tableRect.left) / scale.x;
    const relativeTop = (cellRect.top - tableRect.top) / scale.y;
    const cellWidth = cellRect.width / scale.x;
    const cellHeight = cellRect.height / scale.y;
    const key = [
      side,
      Math.round(relativeLeft),
      Math.round(relativeTop),
      Math.round(cellWidth),
      Math.round(cellHeight),
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
        btn.style.left = `${relativeLeft + cellWidth * 0.5}px`;
        btn.style.top = `${relativeTop}px`;
        btn.style.width = `${cellWidth}px`;
        btn.style.height = `${hitSize}px`;
        break;
      case 'bottom':
        btn.style.left = `${relativeLeft + cellWidth * 0.5}px`;
        btn.style.top = `${(cellRect.bottom - tableRect.top) / scale.y}px`;
        btn.style.width = `${cellWidth}px`;
        btn.style.height = `${hitSize}px`;
        break;
      case 'left':
        btn.style.left = `${relativeLeft}px`;
        btn.style.top = `${relativeTop + cellHeight * 0.5}px`;
        btn.style.width = `${hitSize}px`;
        btn.style.height = `${cellHeight}px`;
        break;
      case 'right':
        btn.style.left = `${(cellRect.right - tableRect.left) / scale.x}px`;
        btn.style.top = `${relativeTop + cellHeight * 0.5}px`;
        btn.style.width = `${hitSize}px`;
        btn.style.height = `${cellHeight}px`;
        break;
    }
    btn.style.transform = 'translate(-50%, -50%)';

    this.dom.appendChild(btn);
  }

  // ===== 渲染：删除行按钮（每行左侧） =====

  private renderRowDeleteButtons(
    rowCount: number,
    tableRect: DOMRect,
    rowRects: DOMRect[],
    scale: OverlayScale,
  ): void {
    for (let r = 0; r < rowCount; r++) {
      const rowRect = rowRects[r];
      const centerY = (rowRect.top - tableRect.top + rowRect.height / 2) / scale.y;

      const btn = this.createButton(t.deleteTableRow({ index: r + 1 }), '−', 'delete-row-btn', () =>
        this.deleteRowAt(r, 0),
      );
      btn.style.top = `${Math.round(centerY)}px`;
      this.dom.appendChild(btn);
    }
  }

  // ===== 渲染：删除列按钮（每列下方） =====

  private renderColDeleteButtons(
    colCount: number,
    tableRect: DOMRect,
    firstRowCellRects: DOMRect[],
    scale: OverlayScale,
  ): void {
    for (let c = 0; c < colCount; c++) {
      const cellRect = firstRowCellRects[c];
      const centerX = (cellRect.left - tableRect.left + cellRect.width / 2) / scale.x;

      const btn = this.createButton(
        t.deleteTableColumn({ index: c + 1 }),
        '−',
        'delete-col-btn',
        () => this.deleteColumnAt(0, c),
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
        t.insertRowBeforeFirst(),
        '',
        'boundary-insert-btn boundary-insert-row-before',
        () => this.insertRowAt(0),
      ),
    );
    bar.appendChild(
      this.createButton(
        t.insertColumnBeforeFirst(),
        '',
        'boundary-insert-btn boundary-insert-column-before',
        () => this.insertColumnAt(0),
      ),
    );
    bar.appendChild(
      this.createButton(
        t.insertRowAfterLast(),
        '',
        'boundary-insert-btn boundary-insert-row-after',
        () => this.insertRowAt(rowCount),
      ),
    );
    bar.appendChild(
      this.createButton(
        t.insertColumnAfterLast(),
        '',
        'boundary-insert-btn boundary-insert-column-after',
        () => this.insertColumnAt(colCount),
      ),
    );
    bar.appendChild(this.el('span', 'table-util-separator'));

    bar.appendChild(
      this.createUtilityButton(t.alignLeft(), 'util-align-left', this.createAlignIcon('left'), () =>
        this.runAndClosePicker(setTableColumnAlignment('left')),
      ),
    );
    bar.appendChild(
      this.createUtilityButton(
        t.alignCenterTable(),
        'util-align-center',
        this.createAlignIcon('center'),
        () => this.runAndClosePicker(setTableColumnAlignment('center')),
      ),
    );
    bar.appendChild(
      this.createUtilityButton(
        t.alignRight(),
        'util-align-right',
        this.createAlignIcon('right'),
        () => this.runAndClosePicker(setTableColumnAlignment('right')),
      ),
    );
    bar.appendChild(
      this.createUtilityButton(
        t.toggleHeaderRow(),
        'util-header-row',
        this.createHeaderIcon(),
        () => this.runAndClosePicker(toggleFirstTableRowHeader()),
      ),
    );
    const resizeButton = this.createUtilityButton(
      t.resizeTable(),
      'util-resize-table',
      this.createResizeIcon(),
      () => this.toggleResizePicker(rowCount, colCount),
    );
    resizeButton.setAttribute('aria-haspopup', 'dialog');
    resizeButton.setAttribute('aria-expanded', String(this.resizePickerOpen));
    bar.appendChild(resizeButton);
    bar.appendChild(
      this.createUtilityButton(
        t.deleteTable(),
        'util-delete-table util-btn-danger',
        this.createDeleteIcon(),
        () => this.runAndClosePicker(deleteCurrentTable()),
      ),
    );

    if (this.resizePickerOpen) {
      bar.appendChild(this.renderResizePicker(rowCount, colCount));
    }

    this.dom.appendChild(bar);
  }

  // ===== 按钮工厂 =====

  private createUtilityButton(
    title: string,
    className: string,
    icon: HTMLElement,
    onClick: () => void,
  ): HTMLButtonElement {
    const button = this.createButton(title, '', `util-btn ${className}`, onClick);
    button.appendChild(icon);
    return button;
  }

  private createAlignIcon(align: 'left' | 'center' | 'right'): HTMLElement {
    const icon = this.el('span', `util-icon util-icon-align util-icon-align-${align}`);
    for (let index = 0; index < 4; index += 1) {
      icon.appendChild(this.el('span', 'util-icon-line'));
    }
    return icon;
  }

  private createHeaderIcon(): HTMLElement {
    const icon = this.el('span', 'util-icon util-icon-header');
    icon.textContent = 'H';
    return icon;
  }

  private createResizeIcon(): HTMLElement {
    const icon = this.el('span', 'util-icon util-icon-resize');
    icon.appendChild(this.el('span', 'util-icon-resize-grid'));
    icon.appendChild(this.el('span', 'util-icon-resize-corner'));
    return icon;
  }

  private createDeleteIcon(): HTMLElement {
    const icon = this.el('span', 'util-icon util-icon-delete');
    icon.appendChild(this.el('span', 'util-icon-delete-lid'));
    icon.appendChild(this.el('span', 'util-icon-delete-body'));
    return icon;
  }

  private renderResizePicker(rowCount: number, colCount: number): HTMLElement {
    const pickerRows = Math.max(DEFAULT_RESIZE_PICKER_ROWS, rowCount);
    const pickerColumns = Math.max(DEFAULT_RESIZE_PICKER_COLUMNS, colCount);
    this.resizePreviewRows = this.clampPickerPreview(this.resizePreviewRows, 1, pickerRows);
    this.resizePreviewColumns = this.clampPickerPreview(
      this.resizePreviewColumns,
      1,
      pickerColumns,
    );

    const popover = this.el('div', 'table-resize-popover');
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', t.resizeTable());
    popover.tabIndex = -1;
    popover.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.closeResizePicker();
      }
    });

    const header = this.el('div', 'table-resize-header');
    header.appendChild(this.elWithText('span', '', t.resizeTable()));
    const sizeLabel = this.elWithText(
      'strong',
      '',
      `${this.resizePreviewRows} × ${this.resizePreviewColumns}`,
    );
    header.appendChild(sizeLabel);
    popover.appendChild(header);

    const grid = this.el('div', 'table-resize-grid');
    grid.setAttribute('aria-label', t.tableRowsColumns());
    grid.style.gridTemplateColumns = `repeat(${pickerColumns}, 32px)`;
    const cells: HTMLButtonElement[] = [];

    const updatePreview = (rows: number, columns: number) => {
      this.resizePreviewRows = rows;
      this.resizePreviewColumns = columns;
      sizeLabel.textContent = `${rows} × ${columns}`;
      for (const cell of cells) {
        const cellRows = Number(cell.dataset.rows);
        const cellColumns = Number(cell.dataset.columns);
        cell.classList.toggle('active', cellRows <= rows && cellColumns <= columns);
      }
    };

    for (let row = 1; row <= pickerRows; row += 1) {
      for (let column = 1; column <= pickerColumns; column += 1) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'table-resize-cell';
        cell.dataset.rows = String(row);
        cell.dataset.columns = String(column);
        cell.setAttribute('aria-label', t.resizeTableSize({ rows: row, columns: column }));
        cell.addEventListener('mouseenter', () => updatePreview(row, column));
        cell.addEventListener('focus', () => updatePreview(row, column));
        cell.addEventListener('mousedown', (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.resizeTableTo(row, column);
        });
        cells.push(cell);
        grid.appendChild(cell);
      }
    }

    popover.appendChild(grid);
    updatePreview(this.resizePreviewRows, this.resizePreviewColumns);
    return popover;
  }

  private toggleResizePicker(rowCount: number, colCount: number): void {
    this.resizePickerOpen = !this.resizePickerOpen;
    this.resizePreviewRows = rowCount;
    this.resizePreviewColumns = colCount;
    this.update(this.view);
  }

  private closeResizePicker(): void {
    if (!this.resizePickerOpen) return;
    this.resizePickerOpen = false;
    this.update(this.view);
  }

  private resizeTableTo(rows: number, columns: number): void {
    this.resizePickerOpen = false;
    this.run(resizeCurrentTable(rows, columns));
  }

  private runAndClosePicker(
    command: (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean,
  ): void {
    this.resizePickerOpen = false;
    this.run(command);
  }

  private clampPickerPreview(value: number, min: number, max: number): number {
    if (!Number.isFinite(value) || value < min) return min;
    return Math.min(max, Math.floor(value));
  }

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

  private getOverlayScale(host: HTMLElement): OverlayScale {
    const rect = host.getBoundingClientRect();
    return {
      x: rect.width > 0 && host.offsetWidth > 0 ? rect.width / host.offsetWidth : 1,
      y: rect.height > 0 && host.offsetHeight > 0 ? rect.height / host.offsetHeight : 1,
    };
  }

  private getOverlayHost(view: EditorView): HTMLElement {
    return this.dom.parentElement instanceof HTMLElement ? this.dom.parentElement : view.dom;
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

  private elWithText(tag: string, className: string, text: string): HTMLElement {
    const e = this.el(tag, className);
    e.textContent = text;
    return e;
  }
}
