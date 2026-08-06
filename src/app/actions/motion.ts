import { gsap } from 'gsap';
import type { TransitionConfig } from 'svelte/transition';

type MotionKind = 'micro' | 'popover' | 'panel' | 'row' | 'mode';

const durationByKind: Record<MotionKind, number> = {
  micro: 0.12,
  popover: 0.16,
  panel: 0.22,
  row: 0.18,
  mode: 0.14,
};

const reducedDurationByKind: Record<MotionKind, number> = {
  micro: 0.08,
  popover: 0.09,
  panel: 0.1,
  row: 0.09,
  mode: 0.08,
};

const ease = 'power2.out';
const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

function getMotionQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return null;
  }
  return window.matchMedia(reducedMotionQuery);
}

export function prefersReducedMotion(): boolean {
  return getMotionQuery()?.matches ?? false;
}

export function motionDuration(kind: MotionKind = 'micro'): number {
  return prefersReducedMotion() ? reducedDurationByKind[kind] : durationByKind[kind];
}

export function transitionDuration(kind: MotionKind = 'micro'): number {
  return Math.round(motionDuration(kind) * 1000);
}

export function outlinePanelTransition(node: HTMLElement): TransitionConfig {
  const duration = transitionDuration('popover');
  const style = getComputedStyle(node);
  const baseTransform = style.transform === 'none' ? '' : style.transform;

  return {
    duration,
    css: (t, u) => `
      opacity: ${t};
      transform: ${baseTransform} translateY(${u * -4}px) scale(${0.98 + t * 0.02});
      visibility: ${t === 0 ? 'hidden' : 'visible'};
    `,
  };
}

export function outlineRowTransition(node: HTMLElement): TransitionConfig {
  const duration = transitionDuration('row');
  const style = getComputedStyle(node);
  const height = node.offsetHeight;
  const marginBottom = parseFloat(style.marginBottom) || 0;
  const opacity = parseFloat(style.opacity) || 1;

  return {
    duration,
    css: (t, u) => `
      height: ${t * height}px;
      min-height: 0;
      margin-bottom: ${t * marginBottom}px;
      opacity: ${t * opacity};
      overflow: hidden;
      transform: translateY(${u * -3}px);
    `,
  };
}

type MotionInOptions = {
  kind?: MotionKind;
  y?: number;
  x?: number;
  scale?: number;
  delay?: number;
};

export function motionIn(node: HTMLElement, options: MotionInOptions = {}) {
  const {
    kind = 'popover',
    y = kind === 'row' ? -4 : 6,
    x = 0,
    scale = kind === 'popover' ? 0.98 : 1,
    delay = 0,
  } = options;
  let tween: gsap.core.Tween | null = null;

  const reduced = prefersReducedMotion();
  tween = gsap.fromTo(
    node,
    { autoAlpha: reduced ? 0.78 : 0, x: reduced ? 0 : x, y: reduced ? 0 : y, scale: 1 },
    {
      autoAlpha: 1,
      x: 0,
      y: 0,
      scale: 1,
      duration: motionDuration(kind),
      delay,
      ease,
      overwrite: 'auto',
      clearProps: 'transform,visibility',
    },
  );

  return {
    destroy() {
      tween?.kill();
    },
  };
}

export function pulseOnChange(node: HTMLElement, value: unknown) {
  let previous = value;
  let initialized = false;
  let tween: gsap.core.Tween | null = null;

  function pulse() {
    tween?.kill();
    tween = gsap.fromTo(
      node,
      { scale: prefersReducedMotion() ? 0.98 : 0.94 },
      {
        scale: 1,
        duration: motionDuration('micro'),
        ease: 'back.out(1.7)',
        overwrite: true,
        clearProps: 'transform',
      },
    );
  }

  return {
    update(nextValue: unknown) {
      if (!initialized) {
        initialized = true;
        previous = nextValue;
        return;
      }
      if (nextValue !== previous) {
        previous = nextValue;
        pulse();
      }
    },
    destroy() {
      tween?.kill();
    },
  };
}

type SidebarParams = {
  focusMode: boolean;
  isResizing: boolean;
};

export function workspaceSidebarMotion(node: HTMLElement, params: SidebarParams) {
  let previousFocusMode = params.focusMode;
  let initialized = false;
  let tween: gsap.core.Tween | null = null;

  function sync(nextParams: SidebarParams) {
    const rail = node.querySelector<HTMLElement>('.rail');
    if (!rail) return;

    const hidden = nextParams.focusMode;
    const reduced = prefersReducedMotion() || nextParams.isResizing;
    const target = { autoAlpha: hidden ? 0 : 1, x: hidden ? -12 : 0 };

    tween?.kill();
    if (!initialized || reduced) {
      gsap.set(rail, target);
      initialized = true;
      previousFocusMode = nextParams.focusMode;
      return;
    }

    if (previousFocusMode !== nextParams.focusMode) {
      tween = gsap.to(rail, {
        ...target,
        duration: motionDuration('panel'),
        ease,
        overwrite: true,
      });
      previousFocusMode = nextParams.focusMode;
    }
  }

  sync(params);

  return {
    update(nextParams: SidebarParams) {
      sync(nextParams);
    },
    destroy() {
      tween?.kill();
    },
  };
}

type ToolbarVisibilityParams = {
  hidden: boolean;
};

export function toolbarVisibilityMotion(node: HTMLElement, params: ToolbarVisibilityParams) {
  let previousHidden = params.hidden;
  let initialized = false;
  let tween: gsap.core.Tween | null = null;

  function sync(nextParams: ToolbarVisibilityParams) {
    const hidden = nextParams.hidden;

    if (initialized && hidden === previousHidden) return;

    tween?.kill();
    if (!initialized || prefersReducedMotion()) {
      if (hidden) {
        gsap.set(node, { autoAlpha: 0, y: -6 });
      } else {
        gsap.set(node, { clearProps: 'transform,opacity,visibility,willChange' });
      }
      initialized = true;
      previousHidden = hidden;
      return;
    }

    tween = gsap.to(node, {
      autoAlpha: hidden ? 0 : 1,
      y: hidden ? -6 : 0,
      willChange: 'transform, opacity',
      duration: motionDuration('panel'),
      ease,
      overwrite: true,
      ...(hidden
        ? {
            onComplete: () => gsap.set(node, { clearProps: 'willChange' }),
          }
        : {
            clearProps: 'transform,opacity,visibility,willChange',
          }),
    });
    previousHidden = hidden;
  }

  sync(params);

  return {
    update(nextParams: ToolbarVisibilityParams) {
      sync(nextParams);
    },
    destroy() {
      tween?.kill();
      gsap.set(node, { clearProps: 'transform,opacity,visibility,willChange' });
    },
  };
}

type TabIndicatorParams = {
  activeTabId: string;
  visibleStart: number;
  visibleEnd: number;
  layoutKey: string;
};

export function tabIndicator(node: HTMLElement, params: TabIndicatorParams) {
  let frame = 0;
  let initialized = false;
  let tween: gsap.core.Tween | null = null;
  let currentParams = params;

  function measure(animate: boolean) {
    frame = 0;
    const indicator = node.querySelector<HTMLElement>('.tab-active-indicator');
    const activeTab = node.querySelector<HTMLElement>('.doc-tab.active');
    if (!indicator || !activeTab) {
      tween?.kill();
      node.dataset.indicatorReady = 'false';
      initialized = false;
      return;
    }

    const x = activeTab.offsetLeft;
    const width = activeTab.offsetWidth;

    tween?.kill();
    if (!initialized || !animate || prefersReducedMotion()) {
      gsap.set(indicator, { x, width });
    } else {
      tween = gsap.to(indicator, {
        x,
        width,
        duration: motionDuration('row'),
        ease,
        overwrite: true,
      });
    }

    node.dataset.indicatorReady = 'true';
    initialized = true;
  }

  function queue(animate: boolean) {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => measure(animate));
  }

  const resizeObserver = new ResizeObserver(() => queue(false));
  resizeObserver.observe(node);
  queue(false);

  return {
    update(nextParams: TabIndicatorParams) {
      const activeTabChanged = nextParams.activeTabId !== currentParams.activeTabId;
      const visibleRangeUnchanged =
        nextParams.visibleStart === currentParams.visibleStart &&
        nextParams.visibleEnd === currentParams.visibleEnd;
      currentParams = nextParams;
      queue(initialized && activeTabChanged && visibleRangeUnchanged);
    },
    destroy() {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      tween?.kill();
    },
  };
}

type ExplorerSelectionIndicatorParams = {
  activePath: string;
  top: number | null;
  layoutKey: string;
  renderKey: string;
};

export function explorerSelectionIndicator(
  node: HTMLElement,
  params: ExplorerSelectionIndicatorParams,
) {
  let frame = 0;
  let initialized = false;
  let tween: gsap.core.Tween | null = null;
  let currentParams = params;

  function measure(nextParams: ExplorerSelectionIndicatorParams, animate: boolean) {
    frame = 0;
    const indicator = node.querySelector<HTMLElement>('.explorer-selection-indicator');
    const selectedRow = node.querySelector<HTMLElement>('.tree-file.selected');
    if (!indicator || !selectedRow || nextParams.top === null) {
      tween?.kill();
      node.dataset.selectionReady = 'false';
      initialized = false;
      return;
    }

    const viewportRect = node.getBoundingClientRect();
    const selectedRect = selectedRow.getBoundingClientRect();
    const paddingLeft = Number.parseFloat(getComputedStyle(selectedRow).paddingLeft) || 0;
    const x = Math.max(8, selectedRect.left - viewportRect.left + paddingLeft - 10);
    const y =
      selectedRect.top -
      viewportRect.top +
      (selectedRect.height - indicator.offsetHeight) / 2;
    tween?.kill();
    if (!initialized || !animate || prefersReducedMotion()) {
      gsap.set(indicator, { x, y });
    } else {
      tween = gsap.to(indicator, {
        x,
        y,
        duration: motionDuration('row'),
        ease,
        overwrite: true,
      });
    }

    node.dataset.selectionReady = 'true';
    initialized = true;
  }

  function queue(nextParams: ExplorerSelectionIndicatorParams, animate: boolean) {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => measure(nextParams, animate));
  }

  queue(params, false);

  return {
    update(nextParams: ExplorerSelectionIndicatorParams) {
      const activePathChanged = nextParams.activePath !== currentParams.activePath;
      const layoutUnchanged = nextParams.layoutKey === currentParams.layoutKey;
      currentParams = nextParams;
      queue(nextParams, initialized && activePathChanged && layoutUnchanged);
    },
    destroy() {
      if (frame) cancelAnimationFrame(frame);
      tween?.kill();
    },
  };
}

type ModeSwitchParams = {
  mode: string;
};

export function modeSwitchIndicator(node: HTMLElement, params: ModeSwitchParams) {
  let previousMode = params.mode;
  let initialized = false;
  let tween: gsap.core.Tween | null = null;

  function sync(nextParams: ModeSwitchParams) {
    const activeButton = node.querySelector<HTMLElement>('button.active');
    if (!activeButton) return;

    const x = activeButton.offsetLeft;
    const width = activeButton.offsetWidth;

    tween?.kill();
    if (!initialized || prefersReducedMotion()) {
      gsap.set(node, {
        '--mode-indicator-x': `${x}px`,
        '--mode-indicator-width': `${width}px`,
      });
      initialized = true;
      previousMode = nextParams.mode;
      return;
    }

    if (previousMode !== nextParams.mode) {
      tween = gsap.to(node, {
        '--mode-indicator-x': `${x}px`,
        '--mode-indicator-width': `${width}px`,
        duration: motionDuration('mode'),
        ease,
        overwrite: true,
      });
      previousMode = nextParams.mode;
    }
  }

  requestAnimationFrame(() => sync(params));

  return {
    update(nextParams: ModeSwitchParams) {
      requestAnimationFrame(() => sync(nextParams));
    },
    destroy() {
      tween?.kill();
    },
  };
}

type ModePaneParams = {
  mode: string;
  disabled?: boolean;
};

export function modePaneMotion(node: HTMLElement, params: ModePaneParams) {
  let previousMode = params.mode;
  let tween: gsap.core.Tween | null = null;

  function sync(nextParams: ModePaneParams) {
    if (nextParams.disabled || prefersReducedMotion()) {
      previousMode = nextParams.mode;
      return;
    }
    if (previousMode === nextParams.mode) return;

    const visiblePane = node.querySelector<HTMLElement>(
      nextParams.mode === 'source' ? '.source-pane' : '.semantic-pane',
    );
    if (!visiblePane) return;

    tween?.kill();
    tween = gsap.fromTo(
      visiblePane,
      { autoAlpha: 0 },
      {
        autoAlpha: 1,
        duration: motionDuration('mode'),
        ease,
        overwrite: true,
        clearProps: 'visibility',
      },
    );
    previousMode = nextParams.mode;
  }

  return {
    update(nextParams: ModePaneParams) {
      sync(nextParams);
    },
    destroy() {
      tween?.kill();
    },
  };
}
