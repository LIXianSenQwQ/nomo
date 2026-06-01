export function getNextActiveMenu(activeMenu: string | null, menu: string): string | null {
  return activeMenu === menu ? null : menu;
}

export function closeActiveMenu(activeMenu: string | null, menu: string): string | null {
  return activeMenu === menu ? null : activeMenu;
}

interface SidebarResizeHandlers {
  setResizing(value: boolean): void;
  setSidebarWidth(value: number): void;
}

export function createSidebarResizeHandlers(handlers: SidebarResizeHandlers) {
  let resizing = false;

  function startResize(event: MouseEvent) {
    event.preventDefault();
    resizing = true;
    handlers.setResizing(true);
    window.addEventListener('mousemove', handleResize);
    window.addEventListener('mouseup', stopResize);
  }

  function handleResize(event: MouseEvent) {
    if (!resizing) return;
    const minWidth = 180;
    const maxWidth = 500;
    handlers.setSidebarWidth(Math.min(maxWidth, Math.max(minWidth, event.clientX)));
  }

  function stopResize() {
    resizing = false;
    handlers.setResizing(false);
    window.removeEventListener('mousemove', handleResize);
    window.removeEventListener('mouseup', stopResize);
  }

  return {
    startResize,
    destroy: stopResize
  };
}
