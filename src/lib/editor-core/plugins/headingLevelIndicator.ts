import { gsap } from 'gsap';
import type { ResolvedPos } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

export const headingLevelIndicatorKey = new PluginKey('headingLevelIndicator');

type HeadingContext = {
  element: HTMLElement;
  level: number;
  pos: number;
};

type OverlayScale = {
  x: number;
  y: number;
};

const BADGE_HEIGHT = 18;
const REQUIRED_LEFT_GUTTER = 48;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * 当前标题层级角标插件。
 *
 * 角标是编辑器宿主中的只读浮层，不进入 ProseMirror 文档；仅当语义编辑器聚焦且
 * 选区完整位于同一个 H1-H6 标题时显示。
 */
export function headingLevelIndicatorPlugin(): Plugin {
  return new Plugin({
    key: headingLevelIndicatorKey,
    view(view) {
      return new HeadingLevelIndicatorView(view);
    },
  });
}

class HeadingLevelIndicatorView {
  private readonly dom = document.createElement('span');
  private readonly host: HTMLElement;
  private readonly resizeObserver: ResizeObserver | null;
  private activeHeading: HeadingContext | null = null;
  private frame = 0;
  private pendingAnimate = false;
  private tween: gsap.core.Tween | null = null;
  private visible = false;

  private readonly queueAnimatedSync = () => this.queueSync(true);
  private readonly queueMeasuredSync = () => this.queueSync(false);
  private readonly handleDocumentPointerDown = (event: PointerEvent) => {
    if (!(event.target instanceof Node) || !this.view.dom.contains(event.target)) {
      this.hide(true);
    }
  };

  constructor(private readonly view: EditorView) {
    this.host = view.dom.parentElement instanceof HTMLElement ? view.dom.parentElement : view.dom;
    this.dom.className = 'heading-level-indicator';
    this.dom.contentEditable = 'false';
    this.dom.setAttribute('aria-hidden', 'true');
    this.host.appendChild(this.dom);

    gsap.set(this.dom, { autoAlpha: 0, x: -4, y: 0 });

    this.view.dom.addEventListener('focusin', this.queueAnimatedSync);
    this.view.dom.addEventListener('focusout', this.queueAnimatedSync);
    document.addEventListener('pointerdown', this.handleDocumentPointerDown);

    this.resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(this.queueMeasuredSync);
    this.resizeObserver?.observe(this.host);
    this.resizeObserver?.observe(this.view.dom);
    this.queueSync(false);
  }

  update(): void {
    this.queueSync(true);
  }

  destroy(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    this.view.dom.removeEventListener('focusin', this.queueAnimatedSync);
    this.view.dom.removeEventListener('focusout', this.queueAnimatedSync);
    document.removeEventListener('pointerdown', this.handleDocumentPointerDown);
    this.tween?.kill();
    gsap.set(this.dom, { clearProps: 'transform,opacity,visibility,willChange' });
    this.dom.remove();
  }

  private queueSync(animate: boolean): void {
    this.pendingAnimate ||= animate;
    if (this.frame) return;

    this.frame = requestAnimationFrame(() => {
      const shouldAnimate = this.pendingAnimate;
      this.frame = 0;
      this.pendingAnimate = false;
      this.sync(shouldAnimate);
    });
  }

  private sync(animate: boolean): void {
    const heading = this.findActiveHeading();
    if (!this.hasEditorSurfaceFocus() || !heading || !this.hasSafeLeftGutter()) {
      this.activeHeading = null;
      this.hide(animate);
      return;
    }

    const top = this.measureHeadingTop(heading.element);
    if (top === null) {
      this.activeHeading = null;
      this.hide(animate);
      return;
    }

    const headingChanged =
      this.activeHeading?.pos !== heading.pos || this.activeHeading.element !== heading.element;
    this.activeHeading = heading;
    this.dom.textContent = `H${heading.level}`;

    if (!headingChanged && this.visible) {
      gsap.set(this.dom, { y: top });
      return;
    }

    this.show(top, animate);
  }

  private show(top: number, animate: boolean): void {
    this.tween?.kill();
    this.visible = true;

    if (!animate || prefersReducedMotion()) {
      gsap.set(this.dom, {
        autoAlpha: 1,
        x: 0,
        y: top,
        clearProps: 'willChange',
      });
      return;
    }

    gsap.set(this.dom, {
      autoAlpha: 0,
      x: -6,
      y: top,
      willChange: 'transform, opacity',
    });
    this.tween = gsap.to(this.dom, {
      autoAlpha: 1,
      x: 0,
      y: top,
      duration: 0.14,
      ease: 'power2.out',
      overwrite: true,
      onComplete: () => {
        this.tween = null;
        gsap.set(this.dom, { clearProps: 'willChange' });
      },
    });
  }

  private hide(animate: boolean): void {
    this.tween?.kill();
    this.tween = null;
    this.activeHeading = null;

    if (!this.visible) {
      gsap.set(this.dom, { autoAlpha: 0, x: -4, clearProps: 'willChange' });
      return;
    }

    this.visible = false;
    if (!animate || prefersReducedMotion()) {
      gsap.set(this.dom, {
        autoAlpha: 0,
        x: 0,
        clearProps: 'willChange',
      });
      return;
    }

    this.tween = gsap.to(this.dom, {
      autoAlpha: 0,
      x: -4,
      duration: 0.1,
      ease: 'power2.out',
      overwrite: true,
      willChange: 'transform, opacity',
      onComplete: () => {
        this.tween = null;
        gsap.set(this.dom, { clearProps: 'willChange' });
      },
    });
  }

  private findActiveHeading(): HeadingContext | null {
    const { selection } = this.view.state;
    const from = findHeadingAncestor(selection.$from);
    const to = findHeadingAncestor(selection.$to);
    if (!from || !to || from.pos !== to.pos || from.level !== to.level) return null;

    const node = this.view.nodeDOM(from.pos);
    if (!(node instanceof HTMLElement)) return null;

    return {
      element: node,
      level: from.level,
      pos: from.pos,
    };
  }

  private hasEditorSurfaceFocus(): boolean {
    return this.view.editable && document.activeElement === this.view.dom;
  }

  private hasSafeLeftGutter(): boolean {
    const boundary = this.host.closest<HTMLElement>('.semantic-pane');
    if (!boundary) return false;

    const hostRect = this.host.getBoundingClientRect();
    const boundaryRect = boundary.getBoundingClientRect();
    const scale = this.getOverlayScale();
    return hostRect.left - boundaryRect.left >= REQUIRED_LEFT_GUTTER * scale.x;
  }

  private measureHeadingTop(heading: HTMLElement): number | null {
    const hostRect = this.host.getBoundingClientRect();
    const headingRect = heading.getBoundingClientRect();
    if (hostRect.width <= 0 || headingRect.width <= 0) return null;

    const scale = this.getOverlayScale();
    const lineHeight = Number.parseFloat(getComputedStyle(heading).lineHeight);
    const firstLineOffset = Number.isFinite(lineHeight)
      ? Math.max(0, (lineHeight - BADGE_HEIGHT) / 2)
      : 0;
    return (headingRect.top - hostRect.top) / scale.y + firstLineOffset;
  }

  private getOverlayScale(): OverlayScale {
    const rect = this.host.getBoundingClientRect();
    return {
      x: rect.width > 0 && this.host.offsetWidth > 0 ? rect.width / this.host.offsetWidth : 1,
      y: rect.height > 0 && this.host.offsetHeight > 0 ? rect.height / this.host.offsetHeight : 1,
    };
  }
}

function findHeadingAncestor(position: ResolvedPos): {
  level: number;
  pos: number;
} | null {
  for (let depth = position.depth; depth > 0; depth -= 1) {
    const node = position.node(depth);
    if (node.type.name !== 'heading') continue;

    const level = Number(node.attrs.level);
    if (!Number.isInteger(level) || level < 1 || level > 6) return null;
    return {
      level,
      pos: position.before(depth),
    };
  }
  return null;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(REDUCED_MOTION_QUERY).matches
    : false;
}
