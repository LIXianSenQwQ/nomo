/**
 * 阻止应用 chrome 落回浏览器原生菜单，同时保留真正文本输入控件的编辑菜单。
 * 已由子组件处理的自定义菜单会先调用 preventDefault，因此不会在这里重复处理。
 */
export function suppressUnhandledContextMenu(event: MouseEvent): void {
  if (event.defaultPrevented) return;
  const target = event.target as HTMLElement | null;
  if (!target) return;

  const policy = target.closest<HTMLElement>('[data-context-menu]')?.dataset.contextMenu;
  if (policy === 'native') return;
  if (policy === 'none') {
    event.preventDefault();
    return;
  }

  // TXT/JSON 分段编辑器仍维持既有行为，本轮只统一应用 chrome 与 Markdown 工作区。
  if (target.closest('.segmented-workspace')) return;

  if (
    target.closest('input, textarea, select')
  ) {
    return;
  }

  event.preventDefault();
}
