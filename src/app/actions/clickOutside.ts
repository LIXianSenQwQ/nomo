export function clickOutside(node: HTMLElement, handler: () => void) {
  const onClick = (event: MouseEvent) => {
    if (node && !node.contains(event.target as Node)) {
      handler();
    }
  };

  document.addEventListener('click', onClick, true);

  return {
    destroy() {
      document.removeEventListener('click', onClick, true);
    }
  };
}
