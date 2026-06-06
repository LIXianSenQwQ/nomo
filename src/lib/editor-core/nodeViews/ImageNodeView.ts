import type { Node as ProseMirrorNode } from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';
import type { ImageContext, ImageResolveResult } from '../../services/render';
import { getImageLoader } from '../renderers';

/**
 * Markdown 图片 NodeView。
 *
 * 职责：
 * 1. 将 Markdown image 节点解析为本地或远程预览；
 * 2. 缺失图片时显示明确占位；
 * 3. 提供与 Mermaid 图表一致的全屏查看体验。
 */
export class ImageNodeView {
  private static readonly FULLSCREEN_DEFAULT_SCALE = 1;
  private static readonly FULLSCREEN_MIN_SCALE = 0.25;
  private static readonly FULLSCREEN_MAX_SCALE = 4;
  private static readonly FULLSCREEN_SCALE_STEP = 0.1;

  dom: HTMLElement;

  private node: ProseMirrorNode;
  private renderId = 0;
  private resolved: ImageResolveResult | null = null;
  private fullscreenOverlayEl: HTMLElement | null = null;
  private fullscreenViewportEl: HTMLElement | null = null;
  private fullscreenZoomSurfaceEl: HTMLElement | null = null;
  private fullscreenZoomBadgeEl: HTMLElement | null = null;
  private fullscreenScale = ImageNodeView.FULLSCREEN_DEFAULT_SCALE;
  private fullscreenKeydown: ((event: KeyboardEvent) => void) | null = null;
  private fullscreenDrag:
    | {
        pointerId: number;
        startX: number;
        startY: number;
        scrollLeft: number;
        scrollTop: number;
      }
    | null = null;

  constructor(
    node: ProseMirrorNode,
    view: EditorView,
    private readonly getImageContext: () => ImageContext,
  ) {
    this.node = node;
    this.dom = document.createElement('span');
    this.dom.className = 'image-node';
    this.dom.contentEditable = 'false';
    this.dom.addEventListener('mousedown', (event) => this.handleMouseDown(event));
    this.render();
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) {
      return false;
    }
    const changed =
      node.attrs.src !== this.node.attrs.src ||
      node.attrs.alt !== this.node.attrs.alt ||
      node.attrs.title !== this.node.attrs.title;
    this.node = node;
    if (changed) {
      this.render();
    }
    return true;
  }

  selectNode(): void {
    this.dom.classList.remove('ProseMirror-selectednode');
  }

  deselectNode(): void {
    this.dom.classList.remove('ProseMirror-selectednode');
  }

  stopEvent(event: Event): boolean {
    return event.target instanceof Node && this.dom.contains(event.target);
  }

  ignoreMutation(): boolean {
    return true;
  }

  destroy(): void {
    this.closeFullscreen();
    this.renderId += 1;
  }

  private render(): void {
    const renderId = ++this.renderId;
    const src = String(this.node.attrs.src ?? '');
    const alt = String(this.node.attrs.alt ?? '');
    this.dom.dataset.src = src;
    this.dom.replaceChildren();
    this.dom.classList.add('is-loading');

    const loader = getImageLoader();
    if (!loader) {
      this.renderImage({ src, displaySrc: src, exists: true }, renderId);
      return;
    }

    loader
      .resolve(src, this.getImageContext())
      .then((result) => this.renderImage(result, renderId))
      .catch((error) => {
        if (renderId !== this.renderId) return;
        this.renderError(error instanceof Error ? error.message : '图片解析失败', alt);
      });
  }

  private renderImage(result: ImageResolveResult, renderId: number): void {
    if (renderId !== this.renderId) {
      return;
    }

    this.resolved = result;
    this.dom.classList.remove('is-loading');
    this.dom.replaceChildren();

    if (!result.exists) {
      this.renderError(result.error ?? '图片文件不存在', String(this.node.attrs.alt ?? ''));
      return;
    }

    const img = document.createElement('img');
    img.src = result.displaySrc;
    img.alt = String(this.node.attrs.alt ?? '');
    if (this.node.attrs.title) {
      img.title = String(this.node.attrs.title);
    }
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('error', () => {
      if (renderId !== this.renderId) return;
      this.renderError('图片加载失败', String(this.node.attrs.alt ?? ''));
    });

    const button = this.createIconButton(
      'image-node-fullscreen-button',
      '全屏查看图片',
      '放大',
      'maximize',
    );
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.openFullscreen();
    });

    this.dom.append(img, button);
  }

  private handleMouseDown(event: MouseEvent): void {
    if ((event.target as HTMLElement | null)?.closest('button')) {
      return;
    }
    event.preventDefault();
  }

  private renderError(message: string, alt: string): void {
    this.dom.classList.remove('is-loading');
    this.dom.replaceChildren();
    const placeholder = document.createElement('span');
    placeholder.className = 'image-node-placeholder';
    placeholder.setAttribute('role', 'img');
    placeholder.setAttribute('aria-label', alt ? `图片加载失败：${alt}` : '图片加载失败');

    const title = document.createElement('strong');
    title.textContent = alt || '图片';
    const detail = document.createElement('span');
    detail.textContent = message;
    placeholder.append(title, detail);
    this.dom.appendChild(placeholder);
  }

  private openFullscreen(): void {
    if (this.fullscreenOverlayEl || !this.resolved?.exists) {
      return;
    }

    const img = this.dom.querySelector<HTMLImageElement>('img');
    if (!img) {
      return;
    }

    const overlayEl = document.createElement('div');
    overlayEl.className = 'image-fullscreen-overlay';
    overlayEl.setAttribute('role', 'dialog');
    overlayEl.setAttribute('aria-modal', 'true');
    overlayEl.setAttribute('aria-label', '全屏图片预览');

    const panelEl = document.createElement('div');
    panelEl.className = 'image-fullscreen-panel';

    const closeButton = this.createIconButton(
      'image-fullscreen-close-button',
      '关闭全屏图片',
      '关闭',
      'close',
    );
    closeButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.closeFullscreen();
    });

    const viewportEl = document.createElement('div');
    viewportEl.className = 'image-fullscreen-viewport';

    const zoomSurfaceEl = document.createElement('div');
    zoomSurfaceEl.className = 'image-fullscreen-zoom-surface';
    const fullscreenImg = img.cloneNode(false) as HTMLImageElement;
    fullscreenImg.removeAttribute('loading');
    zoomSurfaceEl.appendChild(fullscreenImg);

    const zoomBadgeEl = document.createElement('div');
    zoomBadgeEl.className = 'image-fullscreen-zoom-badge';

    viewportEl.appendChild(zoomSurfaceEl);
    viewportEl.addEventListener('wheel', (event) => this.handleFullscreenWheel(event), {
      passive: false,
    });
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
    document.body.classList.add('has-image-fullscreen');
    this.fullscreenOverlayEl = overlayEl;
    this.fullscreenViewportEl = viewportEl;
    this.fullscreenZoomSurfaceEl = zoomSurfaceEl;
    this.fullscreenZoomBadgeEl = zoomBadgeEl;
    this.setFullscreenScale(ImageNodeView.FULLSCREEN_DEFAULT_SCALE);

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
    this.fullscreenDrag = null;
    document.body.classList.remove('has-image-fullscreen');
  }

  private handleFullscreenWheel(event: WheelEvent): void {
    if (!event.ctrlKey) return;
    event.preventDefault();

    const viewportEl = this.fullscreenViewportEl;
    if (!viewportEl) return;

    const oldScale = this.fullscreenScale;
    const direction = event.deltaY < 0 ? 1 : -1;
    const nextScale = this.clampFullscreenScale(
      oldScale + direction * ImageNodeView.FULLSCREEN_SCALE_STEP,
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
      ImageNodeView.FULLSCREEN_MAX_SCALE,
      Math.max(ImageNodeView.FULLSCREEN_MIN_SCALE, scale),
    );
  }

  private setFullscreenScale(scale: number): void {
    this.fullscreenScale = this.clampFullscreenScale(scale);
    const roundedScale = Number(this.fullscreenScale.toFixed(2));
    this.fullscreenZoomSurfaceEl?.style.setProperty('--image-fullscreen-scale', `${roundedScale}`);
    if (this.fullscreenZoomBadgeEl) {
      this.fullscreenZoomBadgeEl.textContent = `${Math.round(roundedScale * 100)}%`;
    }
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
}
