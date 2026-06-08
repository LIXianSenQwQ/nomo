import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { onInterfaceLocaleChanged, t } from '../../../app/i18n';
import { getDiagramRenderer } from '../renderers';

/**
 * Mermaid 图表块 NodeView。
 *
 * 职责：
 * 1. 常态把 Mermaid 源码渲染为 SVG 图表；
 * 2. 点击图表进入源码编辑态；
 * 3. 编辑态保持“源码在上、预览在下”的稳定布局。
 */
export class MermaidBlockNodeView {
  private static instances = new Set<MermaidBlockNodeView>();
  private static readonly FULLSCREEN_DEFAULT_SCALE = 1.25;
  private static readonly FULLSCREEN_MIN_SCALE = 0.5;
  private static readonly FULLSCREEN_MAX_SCALE = 3;
  private static readonly FULLSCREEN_SCALE_STEP = 0.1;

  dom: HTMLElement;

  private node: ProseMirrorNode;
  private view: EditorView;
  private getPos: () => number;
  private renderId = 0;
  private previewRenderId = 0;
  private editing = false;
  private originalCode = '';
  private textarea: HTMLTextAreaElement | null = null;
  private previewEl: HTMLElement | null = null;
  private previewSnapshotEl: HTMLElement | null = null;
  private editSurfaceEl: HTMLElement | null = null;
  private fullscreenOverlayEl: HTMLElement | null = null;
  private fullscreenViewportEl: HTMLElement | null = null;
  private fullscreenZoomSurfaceEl: HTMLElement | null = null;
  private fullscreenZoomBadgeEl: HTMLElement | null = null;
  private fullscreenSvgBaseSize: { width: number; height: number } | null = null;
  private fullscreenScale = MermaidBlockNodeView.FULLSCREEN_DEFAULT_SCALE;
  private fullscreenKeydown: ((event: KeyboardEvent) => void) | null = null;
  private unsubscribeLocale: () => void = () => undefined;
  private fullscreenDrag: {
    pointerId: number;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null = null;

  constructor(node: ProseMirrorNode, view: EditorView, getPos: () => number) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;
    MermaidBlockNodeView.instances.add(this);

    this.dom = document.createElement('div');
    this.dom.className = 'mermaid-block';
    this.dom.contentEditable = 'false';
    this.dom.setAttribute('data-code', node.attrs.code as string);

    this.dom.addEventListener('click', (event) => {
      if (this.editing) return;
      event.preventDefault();
      event.stopPropagation();
      this.enterEdit();
    });

    this.unsubscribeLocale = onInterfaceLocaleChanged(() => {
      this.closeFullscreen();
      if (!this.editing) {
        void this.renderMermaid();
      }
    });
    this.renderMermaid();
  }

  static updateTheme(): void {
    for (const instance of MermaidBlockNodeView.instances) {
      if (!instance.editing) {
        instance.renderMermaid();
      }
    }
  }

  static enterEditAt(view: EditorView, pos: number, caret: 'start' | 'end' = 'start'): boolean {
    for (const instance of MermaidBlockNodeView.instances) {
      if (instance.view !== view) continue;
      if (instance.getPos() === pos) {
        instance.enterEdit(caret);
        return true;
      }
    }
    return false;
  }

  static enterClosestEditAt(
    view: EditorView,
    pos: number,
    caret: 'start' | 'end' = 'start',
  ): boolean {
    let closestInstance: MermaidBlockNodeView | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const instance of MermaidBlockNodeView.instances) {
      if (instance.view !== view || instance.editing) continue;
      const distance = Math.abs(instance.getPos() - pos);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestInstance = instance;
      }
    }

    if (!closestInstance || closestDistance > 4) return false;
    closestInstance.enterEdit(caret);
    return true;
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    if (!this.editing) {
      this.renderMermaid();
    }
    return true;
  }

  selectNode(): void {
    this.dom.classList.remove('ProseMirror-selectednode');
  }

  deselectNode(): void {
    this.dom.classList.remove('ProseMirror-selectednode');
    if (this.editing) {
      this.exitEdit(true, 'preserve');
    }
  }

  stopEvent(event: Event): boolean {
    if (this.editing && this.dom.contains(event.target as Node)) return true;
    return false;
  }

  ignoreMutation(): boolean {
    return true;
  }

  destroy(): void {
    this.closeFullscreen();
    this.cleanupEdit();
    this.unsubscribeLocale();
    MermaidBlockNodeView.instances.delete(this);
  }

  private async renderMermaid(): Promise<void> {
    const id = ++this.renderId;
    const code = this.node.attrs.code as string;
    this.dom.setAttribute('data-code', code);

    if (this.editing) return;

    if (!code.trim()) {
      this.renderEmptyDiagram();
      return;
    }

    const renderer = getDiagramRenderer();
    if (!renderer) {
      this.dom.textContent = `\`\`\`mermaid\n${code}\n\`\`\``;
      return;
    }

    try {
      const result = await renderer.renderMermaid(code, { theme: this.getTheme() });
      if (this.editing || id !== this.renderId) return;
      if (result.error) {
        this.renderError(result.error, code);
      } else {
        this.renderDisplayDiagram(this.normalizeMermaidSvgSize(result.svg));
      }
    } catch (error) {
      if (this.editing || id !== this.renderId) return;
      this.renderError(error instanceof Error ? error.message : t.mermaidRenderFailed(), code);
    }
  }

  private enterEdit(caret: 'start' | 'end' = 'start'): void {
    if (this.editing) return;
    this.editing = true;
    this.renderId += 1;
    this.previewRenderId += 1;
    this.closeFullscreen();
    this.originalCode = this.node.attrs.code as string;
    this.previewSnapshotEl = this.takeRenderedPreviewSnapshot('mermaid-block-preview-snapshot');
    this.dom.classList.add('is-editing');
    this.dom.classList.remove('ProseMirror-selectednode');

    this.editSurfaceEl = document.createElement('div');
    this.editSurfaceEl.className = 'mermaid-block-edit-surface';
    this.dom.appendChild(this.editSurfaceEl);

    this.textarea = document.createElement('textarea');
    this.textarea.className = 'mermaid-block-textarea';
    this.textarea.value = this.originalCode;
    this.textarea.rows = Math.max(4, this.originalCode.split('\n').length);
    this.textarea.spellcheck = false;
    this.editSurfaceEl.appendChild(this.textarea);

    this.previewEl = document.createElement('div');
    this.previewEl.className = 'mermaid-block-preview';
    this.editSurfaceEl.appendChild(this.previewEl);
    if (this.previewSnapshotEl) {
      this.previewEl.appendChild(this.previewSnapshotEl);
    }

    this.textarea.addEventListener('input', () => {
      this.autoResizeTextarea();
      void this.updatePreview();
    });
    this.textarea.addEventListener('keydown', (event) => this.handleKeyDown(event));
    this.textarea.addEventListener('blur', () => {
      this.exitEdit(true);
    });

    requestAnimationFrame(() => {
      if (!this.textarea) return;
      this.textarea.focus({ preventScroll: true });
      const pos = caret === 'end' ? this.textarea.value.length : 0;
      this.textarea.setSelectionRange(pos, pos);
    });
  }

  private exitEdit(save: boolean, selection: 'before' | 'after' | 'preserve' = 'preserve'): void {
    if (!this.editing) return;

    const newCode = save && this.textarea ? this.textarea.value : this.originalCode;
    const oldCode = this.node.attrs.code as string;
    const pos = this.getPos();

    this.cleanupEdit();

    let tr = this.view.state.tr;
    if (save && newCode !== oldCode) {
      tr = tr.setNodeMarkup(pos, null, { code: newCode });
    }

    if (selection === 'before') {
      tr = tr.setSelection(TextSelection.near(tr.doc.resolve(pos), -1));
    } else if (selection === 'after') {
      const nextPos = Math.min(pos + this.node.nodeSize, tr.doc.content.size);
      tr = tr.setSelection(TextSelection.near(tr.doc.resolve(nextPos), 1));
    }

    if (tr.docChanged || selection !== 'preserve') {
      this.view.dispatch(tr);
    }
    if (selection === 'before' || selection === 'after') {
      this.view.focus();
    }
  }

  private cleanupEdit(): void {
    this.editing = false;
    this.previewRenderId += 1;
    this.dom.classList.remove('is-editing');
    this.textarea = null;
    this.previewEl = null;
    this.previewSnapshotEl = null;
    this.editSurfaceEl = null;
    void this.renderMermaid();
  }

  private takeRenderedPreviewSnapshot(className: string): HTMLElement | null {
    const renderedContent = this.dom.querySelector<HTMLElement>('.mermaid-block-rendered');
    if (!renderedContent?.hasChildNodes() && !this.dom.hasChildNodes()) return null;

    const previewEl = document.createElement('div');
    previewEl.className = className;
    previewEl.setAttribute('aria-hidden', 'true');

    if (renderedContent) {
      while (renderedContent.firstChild) {
        previewEl.appendChild(renderedContent.firstChild);
      }
      this.dom.replaceChildren();
      return previewEl;
    }

    while (this.dom.firstChild) {
      const child = this.dom.firstChild;
      if (
        child instanceof HTMLElement &&
        child.classList.contains('mermaid-block-fullscreen-button')
      ) {
        child.remove();
      } else {
        previewEl.appendChild(child);
      }
    }

    return previewEl;
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.textarea) return;

    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && event.shiftKey) {
      event.preventDefault();
      const pos = this.getPos();
      this.exitEdit(true, 'preserve');
      const paragraph = this.view.state.schema.nodes.paragraph.create();
      const tr = this.view.state.tr.insert(pos, paragraph);
      this.view.dispatch(tr.setSelection(TextSelection.create(tr.doc, pos + 1)));
      this.view.focus();
      return;
    }

    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      const pos = this.getPos();
      this.exitEdit(true, 'preserve');
      const afterPos = pos + this.node.nodeSize;
      if (afterPos <= this.view.state.doc.content.size) {
        const paragraph = this.view.state.schema.nodes.paragraph.create();
        const tr = this.view.state.tr.insert(afterPos, paragraph);
        this.view.dispatch(tr.setSelection(TextSelection.create(tr.doc, afterPos + 1)));
        this.view.focus();
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.exitEdit(false);
      return;
    }

    if (event.key === 'ArrowDown' && !event.shiftKey) {
      const { selectionStart, value } = this.textarea;
      if (!value.slice(selectionStart).includes('\n')) {
        event.preventDefault();
        this.exitEdit(true, 'after');
      }
      return;
    }

    if (event.key === 'ArrowUp' && !event.shiftKey) {
      const { selectionStart, value } = this.textarea;
      if (!value.slice(0, selectionStart).includes('\n')) {
        event.preventDefault();
        this.exitEdit(true, 'before');
      }
    }
  }

  private autoResizeTextarea(): void {
    if (!this.textarea) return;
    this.textarea.rows = Math.max(4, this.textarea.value.split('\n').length);
  }

  private async updatePreview(): Promise<void> {
    if (!this.previewEl || !this.textarea) return;
    const id = ++this.previewRenderId;
    const code = this.textarea.value;
    const renderer = getDiagramRenderer();
    if (!code.trim()) {
      this.setPreviewContent('', { error: false, renderId: id });
      return;
    }
    if (!renderer) {
      this.setPreviewContent('(diagram renderer unavailable)', { error: true, renderId: id });
      return;
    }

    try {
      const result = await renderer.renderMermaid(code, { theme: this.getTheme() });
      if (!this.editing || !this.previewEl || id !== this.previewRenderId) return;
      if (result.error) {
        this.setPreviewContent(result.error, { error: true, renderId: id });
      } else {
        this.setPreviewContent(this.normalizeMermaidSvgSize(result.svg), {
          error: false,
          html: true,
          renderId: id,
        });
      }
    } catch (error) {
      if (!this.editing || !this.previewEl || id !== this.previewRenderId) return;
      this.setPreviewContent(error instanceof Error ? error.message : t.mermaidRenderFailed(), {
        error: true,
        renderId: id,
      });
    }
  }

  private setPreviewContent(
    content: string,
    options: { error: boolean; html?: boolean; renderId: number },
  ): void {
    if (!this.previewEl || options.renderId !== this.previewRenderId) return;

    const snapshotEl = this.previewSnapshotEl;
    this.previewEl.classList.toggle('is-error', options.error);

    if (!snapshotEl) {
      this.previewEl.textContent = '';
      if (options.html) {
        this.previewEl.innerHTML = content;
      } else {
        this.previewEl.textContent = content;
      }
      return;
    }

    const renderedEl = document.createElement('div');
    renderedEl.className = 'mermaid-block-preview-render';
    if (options.html) {
      renderedEl.innerHTML = content;
    } else {
      renderedEl.textContent = content;
    }
    this.previewEl.replaceChildren(renderedEl);
    this.previewSnapshotEl = null;
  }

  private renderError(error: string, code: string): void {
    this.dom.textContent = '';
    const errorEl = document.createElement('div');
    errorEl.className = 'mermaid-block-error';
    errorEl.textContent = error;
    const sourceEl = document.createElement('pre');
    sourceEl.className = 'mermaid-block-source';
    sourceEl.textContent = `\`\`\`mermaid\n${code}\n\`\`\``;
    this.dom.append(errorEl, sourceEl);
  }

  private renderEmptyDiagram(): void {
    this.dom.textContent = '';
    const emptyEl = document.createElement('div');
    emptyEl.className = 'mermaid-block-empty';
    this.dom.appendChild(emptyEl);
  }

  private renderDisplayDiagram(svg: string): void {
    this.dom.textContent = '';

    const renderedEl = document.createElement('div');
    renderedEl.className = 'mermaid-block-rendered';
    renderedEl.innerHTML = svg;

    const fullscreenButton = this.createIconButton(
      'mermaid-block-fullscreen-button',
      t.fullscreenDiagram(),
      t.enlarge(),
      'maximize',
    );
    fullscreenButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.openFullscreen();
    });

    this.dom.append(renderedEl, fullscreenButton);
  }

  private normalizeMermaidSvgSize(svg: string): string {
    const template = document.createElement('template');
    template.innerHTML = svg.trim();

    const svgEl = template.content.querySelector('svg');
    const viewBox = svgEl?.getAttribute('viewBox');
    if (!svgEl || !viewBox) return svg;

    const [, , width, height] = viewBox
      .trim()
      .split(/\s+/)
      .map((value) => Number.parseFloat(value));
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return template.innerHTML;
    }

    // Mermaid 默认输出 width="100%"，会让编辑器卡片继承一整行画布。
    // 用 viewBox 的真实尺寸作为 SVG 内在尺寸，再交给 CSS 做最大宽高约束。
    svgEl.setAttribute('width', String(Math.ceil(width)));
    svgEl.setAttribute('height', String(Math.ceil(height)));

    const inlineStyle = svgEl.getAttribute('style');
    if (inlineStyle) {
      const nextStyle = inlineStyle
        .split(';')
        .map((part) => part.trim())
        .filter((part) => part && !part.toLowerCase().startsWith('max-width'))
        .join('; ');
      if (nextStyle) {
        svgEl.setAttribute('style', nextStyle);
      } else {
        svgEl.removeAttribute('style');
      }
    }

    return template.innerHTML;
  }

  private openFullscreen(): void {
    if (this.editing || this.fullscreenOverlayEl) return;

    const renderedContent = this.dom.querySelector<HTMLElement>('.mermaid-block-rendered');
    if (!renderedContent?.hasChildNodes()) return;

    const overlayEl = document.createElement('div');
    overlayEl.className = 'mermaid-fullscreen-overlay';
    overlayEl.setAttribute('role', 'dialog');
    overlayEl.setAttribute('aria-modal', 'true');
    overlayEl.setAttribute('aria-label', t.fullscreenDiagramPreview());

    const panelEl = document.createElement('div');
    panelEl.className = 'mermaid-fullscreen-panel';

    const closeButton = this.createIconButton(
      'mermaid-fullscreen-close-button',
      t.closeFullscreenDiagram(),
      t.close(),
      'close',
    );
    closeButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.closeFullscreen();
    });

    const viewportEl = document.createElement('div');
    viewportEl.className = 'mermaid-fullscreen-viewport';

    const zoomSurfaceEl = document.createElement('div');
    zoomSurfaceEl.className = 'mermaid-fullscreen-zoom-surface';
    zoomSurfaceEl.appendChild(renderedContent.cloneNode(true));

    const zoomBadgeEl = document.createElement('div');
    zoomBadgeEl.className = 'mermaid-fullscreen-zoom-badge';

    viewportEl.appendChild(zoomSurfaceEl);
    viewportEl.addEventListener(
      'wheel',
      (event) => {
        this.handleFullscreenWheel(event);
      },
      { passive: false },
    );
    viewportEl.addEventListener('pointerdown', (event) => this.handleFullscreenPointerDown(event));
    viewportEl.addEventListener('pointermove', (event) => this.handleFullscreenPointerMove(event));
    viewportEl.addEventListener('pointerup', (event) => this.finishFullscreenDrag(event));
    viewportEl.addEventListener('pointercancel', (event) => this.finishFullscreenDrag(event));

    panelEl.append(closeButton, viewportEl, zoomBadgeEl);
    overlayEl.appendChild(panelEl);
    overlayEl.addEventListener('click', (event) => {
      if (event.target === overlayEl) {
        this.closeFullscreen();
      }
    });

    this.fullscreenKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeFullscreen();
      }
    };
    document.addEventListener('keydown', this.fullscreenKeydown);
    document.body.appendChild(overlayEl);
    document.body.classList.add('has-mermaid-fullscreen');
    this.fullscreenOverlayEl = overlayEl;
    this.fullscreenViewportEl = viewportEl;
    this.fullscreenZoomSurfaceEl = zoomSurfaceEl;
    this.fullscreenZoomBadgeEl = zoomBadgeEl;
    this.setFullscreenScale(MermaidBlockNodeView.FULLSCREEN_DEFAULT_SCALE);

    requestAnimationFrame(() => {
      this.centerFullscreenContent();
      closeButton.focus({ preventScroll: true });
    });
  }

  private closeFullscreen(): void {
    if (this.fullscreenKeydown) {
      document.removeEventListener('keydown', this.fullscreenKeydown);
      this.fullscreenKeydown = null;
    }
    this.fullscreenOverlayEl?.remove();
    this.fullscreenOverlayEl = null;
    this.fullscreenViewportEl = null;
    this.fullscreenZoomSurfaceEl = null;
    this.fullscreenZoomBadgeEl = null;
    this.fullscreenSvgBaseSize = null;
    this.fullscreenDrag = null;
    document.body.classList.remove('has-mermaid-fullscreen');
  }

  private handleFullscreenWheel(event: WheelEvent): void {
    if (!event.ctrlKey) return;
    event.preventDefault();

    const viewportEl = this.fullscreenViewportEl;
    if (!viewportEl) return;

    const oldScale = this.fullscreenScale;
    const direction = event.deltaY < 0 ? 1 : -1;
    const nextScale = this.clampFullscreenScale(
      oldScale + direction * MermaidBlockNodeView.FULLSCREEN_SCALE_STEP,
    );
    if (nextScale === oldScale) return;

    const viewportRect = viewportEl.getBoundingClientRect();
    const pointerX = event.clientX - viewportRect.left;
    const pointerY = event.clientY - viewportRect.top;
    const contentX = viewportEl.scrollLeft + pointerX;
    const contentY = viewportEl.scrollTop + pointerY;
    const scaleRatio = nextScale / oldScale;

    this.setFullscreenScale(nextScale);
    viewportEl.scrollLeft = contentX * scaleRatio - pointerX;
    viewportEl.scrollTop = contentY * scaleRatio - pointerY;
  }

  private handleFullscreenPointerDown(event: PointerEvent): void {
    if (event.button !== 0 || !this.fullscreenViewportEl) return;
    event.preventDefault();
    this.fullscreenDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: this.fullscreenViewportEl.scrollLeft,
      scrollTop: this.fullscreenViewportEl.scrollTop,
    };
    this.fullscreenViewportEl.classList.add('is-dragging');
    this.fullscreenViewportEl.setPointerCapture?.(event.pointerId);
  }

  private handleFullscreenPointerMove(event: PointerEvent): void {
    if (!this.fullscreenViewportEl || !this.fullscreenDrag) return;
    if (event.pointerId !== this.fullscreenDrag.pointerId) return;
    event.preventDefault();
    this.fullscreenViewportEl.scrollLeft =
      this.fullscreenDrag.scrollLeft - (event.clientX - this.fullscreenDrag.startX);
    this.fullscreenViewportEl.scrollTop =
      this.fullscreenDrag.scrollTop - (event.clientY - this.fullscreenDrag.startY);
  }

  private finishFullscreenDrag(event: PointerEvent): void {
    if (!this.fullscreenViewportEl || !this.fullscreenDrag) return;
    if (event.pointerId !== this.fullscreenDrag.pointerId) return;
    if (this.fullscreenViewportEl.hasPointerCapture?.(event.pointerId)) {
      this.fullscreenViewportEl.releasePointerCapture(event.pointerId);
    }
    this.fullscreenViewportEl.classList.remove('is-dragging');
    this.fullscreenDrag = null;
  }

  private centerFullscreenContent(): void {
    const viewportEl = this.fullscreenViewportEl;
    if (!viewportEl) return;
    viewportEl.scrollLeft = Math.max(0, (viewportEl.scrollWidth - viewportEl.clientWidth) / 2);
    viewportEl.scrollTop = Math.max(0, (viewportEl.scrollHeight - viewportEl.clientHeight) / 2);
  }

  private clampFullscreenScale(scale: number): number {
    return Math.min(
      MermaidBlockNodeView.FULLSCREEN_MAX_SCALE,
      Math.max(MermaidBlockNodeView.FULLSCREEN_MIN_SCALE, scale),
    );
  }

  private setFullscreenScale(scale: number): void {
    this.fullscreenScale = this.clampFullscreenScale(scale);

    const roundedScale = Number(this.fullscreenScale.toFixed(2));
    this.applyFullscreenSvgScale(roundedScale);
    if (this.fullscreenZoomBadgeEl) {
      this.fullscreenZoomBadgeEl.textContent = `${Math.round(roundedScale * 100)}%`;
    }
  }

  private applyFullscreenSvgScale(scale: number): void {
    const svgEl = this.fullscreenZoomSurfaceEl?.querySelector<SVGElement>('svg');
    if (!svgEl) return;

    const baseSize = this.fullscreenSvgBaseSize ?? this.readSvgIntrinsicSize(svgEl);
    if (!baseSize) return;

    this.fullscreenSvgBaseSize = baseSize;
    svgEl.setAttribute('width', String(Math.ceil(baseSize.width * scale)));
    svgEl.setAttribute('height', String(Math.ceil(baseSize.height * scale)));
  }

  private readSvgIntrinsicSize(svgEl: SVGElement): { width: number; height: number } | null {
    const viewBox = svgEl.getAttribute('viewBox');
    if (viewBox) {
      const [, , width, height] = viewBox
        .trim()
        .split(/\s+/)
        .map((value) => Number.parseFloat(value));
      if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
        return { width, height };
      }
    }

    const width = Number.parseFloat(svgEl.getAttribute('width') ?? '');
    const height = Number.parseFloat(svgEl.getAttribute('height') ?? '');
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return { width, height };
    }

    return null;
  }

  private createIconButton(
    className: string,
    ariaLabel: string,
    title: string,
    icon: 'maximize' | 'close',
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.setAttribute('aria-label', ariaLabel);
    button.title = title;
    button.innerHTML =
      icon === 'maximize'
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6"/><path d="M21 3l-7 7"/><path d="M9 21H3v-6"/><path d="M3 21l7-7"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
    return button;
  }

  private getTheme(): 'light' | 'dark' {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }
}
