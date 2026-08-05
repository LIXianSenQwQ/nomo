const VISIBLE_CLASS = 'is-scrollbar-visible';
const EDGE_REVEAL_DISTANCE_PX = 20;
const SCROLL_HIDE_DELAY_MS = 900;
const EDGE_LEAVE_HIDE_DELAY_MS = 240;
const SCROLLABLE_OVERFLOW = new Set(['auto', 'scroll', 'overlay']);

interface ScrollbarVisibilityState {
  nearEdge: boolean;
  scrolling: boolean;
  hideTimer: number | null;
  scrollTimer: number | null;
}

interface ScrollableAxes {
  horizontal: boolean;
  vertical: boolean;
}

function getScrollableAxes(element: HTMLElement): ScrollableAxes {
  const hasVerticalOverflow = element.scrollHeight > element.clientHeight + 1;
  const hasHorizontalOverflow = element.scrollWidth > element.clientWidth + 1;

  if (!hasVerticalOverflow && !hasHorizontalOverflow) {
    return { horizontal: false, vertical: false };
  }

  const style = window.getComputedStyle(element);
  if (style.getPropertyValue('scrollbar-width') === 'none') {
    return { horizontal: false, vertical: false };
  }

  return {
    horizontal: hasHorizontalOverflow && SCROLLABLE_OVERFLOW.has(style.overflowX),
    vertical: hasVerticalOverflow && SCROLLABLE_OVERFLOW.has(style.overflowY),
  };
}

function resolveScrolledElement(target: EventTarget | null): HTMLElement | null {
  if (target instanceof HTMLElement) {
    return target;
  }

  if (target instanceof Document && target.scrollingElement instanceof HTMLElement) {
    return target.scrollingElement;
  }

  return null;
}

export function installAutoHideScrollbars(): () => void {
  const states = new WeakMap<HTMLElement, ScrollbarVisibilityState>();
  const visibleElements = new Set<HTMLElement>();
  let nearEdgeElements = new Set<HTMLElement>();
  let pointerFrame: number | null = null;
  let latestPointer:
    | {
        clientX: number;
        clientY: number;
        path: EventTarget[];
      }
    | undefined;

  const getState = (element: HTMLElement): ScrollbarVisibilityState => {
    const current = states.get(element);
    if (current) {
      return current;
    }

    const next: ScrollbarVisibilityState = {
      nearEdge: false,
      scrolling: false,
      hideTimer: null,
      scrollTimer: null,
    };
    states.set(element, next);
    return next;
  };

  const reveal = (element: HTMLElement): void => {
    const state = getState(element);
    if (state.hideTimer !== null) {
      window.clearTimeout(state.hideTimer);
      state.hideTimer = null;
    }

    element.classList.add(VISIBLE_CLASS);
    visibleElements.add(element);
  };

  const hideWhenIdle = (element: HTMLElement): void => {
    const state = getState(element);
    state.hideTimer = null;
    if (state.nearEdge || state.scrolling) {
      return;
    }

    element.classList.remove(VISIBLE_CLASS);
    visibleElements.delete(element);
  };

  const scheduleHide = (element: HTMLElement, delay: number): void => {
    const state = getState(element);
    if (state.hideTimer !== null) {
      window.clearTimeout(state.hideTimer);
    }
    state.hideTimer = window.setTimeout(() => hideWhenIdle(element), delay);
  };

  const updateNearEdgeElements = (nextElements: Set<HTMLElement>): void => {
    for (const element of nearEdgeElements) {
      if (nextElements.has(element)) {
        continue;
      }

      getState(element).nearEdge = false;
      scheduleHide(element, EDGE_LEAVE_HIDE_DELAY_MS);
    }

    for (const element of nextElements) {
      const state = getState(element);
      state.nearEdge = true;
      reveal(element);
    }

    nearEdgeElements = nextElements;
  };

  const processPointerPosition = (): void => {
    pointerFrame = null;
    if (!latestPointer) {
      updateNearEdgeElements(new Set());
      return;
    }

    const { clientX, clientY, path } = latestPointer;
    const nextElements = new Set<HTMLElement>();

    for (const target of path) {
      if (!(target instanceof HTMLElement)) {
        continue;
      }

      const axes = getScrollableAxes(target);
      if (!axes.horizontal && !axes.vertical) {
        continue;
      }

      const rect = target.getBoundingClientRect();
      const pointerInside =
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom;
      if (!pointerInside) {
        continue;
      }

      const nearVerticalEdge = axes.vertical && rect.right - clientX <= EDGE_REVEAL_DISTANCE_PX;
      const nearHorizontalEdge =
        axes.horizontal && rect.bottom - clientY <= EDGE_REVEAL_DISTANCE_PX;
      if (nearVerticalEdge || nearHorizontalEdge) {
        nextElements.add(target);
      }
    }

    updateNearEdgeElements(nextElements);
  };

  const handlePointerMove = (event: PointerEvent): void => {
    latestPointer =
      event.pointerType === 'touch'
        ? undefined
        : {
            clientX: event.clientX,
            clientY: event.clientY,
            path: event.composedPath(),
          };

    if (pointerFrame === null) {
      pointerFrame = window.requestAnimationFrame(processPointerPosition);
    }
  };

  const handlePointerLeave = (): void => {
    latestPointer = undefined;
    if (pointerFrame !== null) {
      window.cancelAnimationFrame(pointerFrame);
      pointerFrame = null;
    }
    updateNearEdgeElements(new Set());
  };

  const handleScroll = (event: Event): void => {
    const element = resolveScrolledElement(event.target);
    if (!element) {
      return;
    }

    const axes = getScrollableAxes(element);
    if (!axes.horizontal && !axes.vertical) {
      return;
    }

    const state = getState(element);
    state.scrolling = true;
    reveal(element);

    if (state.scrollTimer !== null) {
      window.clearTimeout(state.scrollTimer);
    }
    state.scrollTimer = window.setTimeout(() => {
      state.scrollTimer = null;
      state.scrolling = false;
      scheduleHide(element, 0);
    }, SCROLL_HIDE_DELAY_MS);
  };

  const hideAll = (): void => {
    latestPointer = undefined;
    if (pointerFrame !== null) {
      window.cancelAnimationFrame(pointerFrame);
      pointerFrame = null;
    }

    for (const element of visibleElements) {
      const state = getState(element);
      state.nearEdge = false;
      state.scrolling = false;
      if (state.hideTimer !== null) {
        window.clearTimeout(state.hideTimer);
        state.hideTimer = null;
      }
      if (state.scrollTimer !== null) {
        window.clearTimeout(state.scrollTimer);
        state.scrollTimer = null;
      }
      element.classList.remove(VISIBLE_CLASS);
    }

    visibleElements.clear();
    nearEdgeElements.clear();
  };

  const handleVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      hideAll();
    }
  };

  document.addEventListener('scroll', handleScroll, true);
  document.addEventListener('pointermove', handlePointerMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', handlePointerLeave, { passive: true });
  window.addEventListener('blur', hideAll);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    document.removeEventListener('scroll', handleScroll, true);
    document.removeEventListener('pointermove', handlePointerMove);
    document.documentElement.removeEventListener('pointerleave', handlePointerLeave);
    window.removeEventListener('blur', hideAll);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    hideAll();
  };
}
