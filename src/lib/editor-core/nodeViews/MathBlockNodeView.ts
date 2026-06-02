import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { NodeSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { getMathRenderer } from '../renderers';

/**
 * math_block 节点的 NodeView —— 渲染态
 *
 * 职责：
 * 1. 将 math_block 节点渲染为 KaTeX 公式（displayMode: true）
 * 2. 点击公式块进入编辑态（textarea 多行编辑）
 * 3. Ctrl+Enter 保存退出 / Esc 放弃退出
 */
export class MathBlockNodeView {
  dom: HTMLElement;

  private node: ProseMirrorNode;
  private view: EditorView;
  private getPos: () => number;
  private renderId = 0;

  // 编辑态相关
  private editing = false;
  private originalTex = '';
  private textarea: HTMLTextAreaElement | null = null;
  private previewEl: HTMLElement | null = null;
  // 首次创建时自动进入编辑态（如 InputRule 从 $$ 创建的空公式块）
  private needsAutoEdit = false;

  constructor(node: ProseMirrorNode, view: EditorView, getPos: () => number) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    this.dom = document.createElement('div');
    this.dom.className = 'math-block';
    this.dom.contentEditable = 'false';
    this.dom.setAttribute('data-tex', node.attrs.tex as string);

    // 初始 fallback 文本
    this.dom.textContent = `$$\n${node.attrs.tex}\n$$`;

    // 点击进入编辑态
    this.dom.addEventListener('click', (event) => {
      if (this.editing) return;
      event.preventDefault();
      event.stopPropagation();
      this.enterEdit();
    });

    // 空 tex 说明是 InputRule 新建的公式块，标记首次选中时自动进入编辑态
    if (!(node.attrs.tex as string).trim()) {
      this.needsAutoEdit = true;
    }

    this.renderKaTeX();
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    if (!this.editing) {
      this.renderKaTeX();
    }
    return true;
  }

  selectNode(): void {
    this.dom.classList.add('ProseMirror-selectednode');
    // 首次创建的空公式块自动进入编辑态
    if (this.needsAutoEdit) {
      this.needsAutoEdit = false;
      this.enterEdit();
    }
  }

  deselectNode(): void {
    this.dom.classList.remove('ProseMirror-selectednode');
    if (this.editing) {
      this.exitEdit(true);
    }
  }

  stopEvent(event: Event): boolean {
    // 编辑态内拦截所有事件，防止 ProseMirror 处理
    if (this.editing) {
      if (this.dom.contains(event.target as Node)) return true;
    }
    return false;
  }

  ignoreMutation(): boolean {
    return true;
  }

  destroy(): void {
    this.cleanupEdit();
  }

  // ---- KaTeX 渲染 ----

  private async renderKaTeX(): Promise<void> {
    const id = ++this.renderId;
    const tex = this.node.attrs.tex as string;
    this.dom.setAttribute('data-tex', tex);

    if (!tex) {
      this.dom.textContent = '';
      return;
    }

    const mathRenderer = getMathRenderer();
    if (!mathRenderer) {
      this.dom.textContent = `$$\n${tex}\n$$`;
      return;
    }

    try {
      const result = await mathRenderer.render(tex, { displayMode: true });
      if (id !== this.renderId) return; // 放弃过期渲染
      if (result.error) {
        this.dom.textContent = `$$\n${tex}\n$$`;
        this.dom.style.color = 'var(--md-editor-warning, #9a6700)';
      } else {
        this.dom.innerHTML = result.html;
        this.dom.style.color = '';
      }
    } catch {
      if (id !== this.renderId) return;
      this.dom.textContent = `$$\n${tex}\n$$`;
    }
  }

  // ---- 编辑态管理 ----

  private enterEdit(): void {
    if (this.editing) return;
    this.editing = true;
    this.originalTex = this.node.attrs.tex as string;
    this.dom.classList.add('is-editing');
    this.dom.classList.remove('ProseMirror-selectednode');

    // 步骤1：清空 dom，构建编辑态布局（textarea + 预览区）
    this.dom.textContent = '';

    // textarea 编辑区
    this.textarea = document.createElement('textarea');
    this.textarea.className = 'math-block-textarea';
    this.textarea.value = this.originalTex;
    this.textarea.rows = Math.max(2, this.originalTex.split('\n').length);
    this.textarea.spellcheck = false;
    this.dom.appendChild(this.textarea);

    // 预览区（在公式块内部，不用 fixed 浮层）
    this.previewEl = document.createElement('div');
    this.previewEl.className = 'math-block-preview';
    this.dom.appendChild(this.previewEl);

    // 步骤2：textarea 事件监听
    this.textarea.addEventListener('input', () => {
      this.autoResizeTextarea();
      this.updatePreview();
    });
    this.textarea.addEventListener('keydown', (e) => this.handleKeyDown(e));
    this.textarea.addEventListener('blur', () => {
      // 点击外部保存退出
      this.exitEdit(true);
    });

    // 步骤3：初始预览渲染
    this.updatePreview();

    // 步骤4：聚焦 textarea
    requestAnimationFrame(() => {
      if (!this.textarea) return;
      this.textarea.focus({ preventScroll: true });
    });
  }

  private exitEdit(save: boolean): void {
    if (!this.editing) return;

    const newTex = save && this.textarea ? this.textarea.value : this.originalTex;
    const oldTex = this.node.attrs.tex as string;
    const pos = this.getPos();

    this.cleanupEdit();

    let tr = this.view.state.tr;
    if (save && newTex !== oldTex) {
      // 一次性提交：修改 node attrs
      tr = tr.setNodeMarkup(pos, null, { tex: newTex });
    }

    // 恢复选中状态
    tr = tr.setSelection(NodeSelection.create(tr.doc, pos));
    this.view.dispatch(tr);
  }

  private cleanupEdit(): void {
    this.editing = false;
    this.dom.classList.remove('is-editing');
    this.textarea = null;
    this.previewEl = null;

    // 恢复 KaTeX 渲染
    this.renderKaTeX();
  }

  // ---- 键盘处理 ----

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.textarea) return;

    // Ctrl+Enter：保存退出编辑态
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.exitEdit(true);
      return;
    }

    // Escape：放弃修改退出编辑态
    if (e.key === 'Escape') {
      e.preventDefault();
      this.exitEdit(false);
      return;
    }

    // Enter 在 textarea 内正常换行（不退出编辑态）
    // 其他按键也正常传递给 textarea
  }

  // ---- 辅助方法 ----

  private autoResizeTextarea(): void {
    if (!this.textarea) return;
    this.textarea.rows = Math.max(2, this.textarea.value.split('\n').length);
  }

  private async updatePreview(): Promise<void> {
    if (!this.previewEl || !this.textarea) return;

    const tex = this.textarea.value.trim();
    if (!tex) {
      this.previewEl.textContent = '';
      return;
    }

    const mathRenderer = getMathRenderer();
    if (!mathRenderer) {
      this.previewEl.textContent = '(math renderer unavailable)';
      return;
    }

    try {
      const result = await mathRenderer.render(tex, { displayMode: true });
      if (!this.editing || !this.previewEl) return; // 编辑态已退出
      if (result.error) {
        this.previewEl.textContent = result.error;
        this.previewEl.style.color = 'var(--md-editor-warning, #9a6700)';
      } else {
        this.previewEl.innerHTML = result.html;
        this.previewEl.style.color = '';
      }
    } catch {
      if (!this.editing || !this.previewEl) return;
      this.previewEl.textContent = 'KaTeX error';
    }
  }
}
