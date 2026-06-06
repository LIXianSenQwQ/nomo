<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { ContextMenuItem } from '../../lib/editor-core/plugins/contextMenu';

  export let x: number;
  export let y: number;
  export let items: ContextMenuItem[];
  export let onClose: () => void;

  let menuEl: HTMLDivElement | null = null;
  let adjustedX = x;
  let adjustedY = y;

  // 确保菜单位置不超出视口
  async function adjustPosition() {
    await tick();
    if (!menuEl) return;
    const rect = menuEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    adjustedX = x;
    adjustedY = y;

    if (adjustedX + rect.width > vw - 8) {
      adjustedX = vw - rect.width - 8;
    }
    if (adjustedY + rect.height > vh - 8) {
      adjustedY = vh - rect.height - 8;
    }
    if (adjustedX < 8) adjustedX = 8;
    if (adjustedY < 8) adjustedY = 8;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  }

  function handleMousedownOutside(event: MouseEvent) {
    if (menuEl && !menuEl.contains(event.target as Node)) {
      onClose();
    }
  }

  function handleItemClick(item: ContextMenuItem) {
    item.action();
    onClose();
  }

  $: if (x !== undefined && y !== undefined) {
    adjustPosition();
  }

  onMount(() => {
    adjustPosition();
    document.addEventListener('mousedown', handleMousedownOutside, true);
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('scroll', onClose, true);
    return () => {
      document.removeEventListener('mousedown', handleMousedownOutside, true);
      document.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('scroll', onClose, true);
    };
  });
</script>

<div
  bind:this={menuEl}
  class="context-menu"
  style="position: fixed; left: {adjustedX}px; top: {adjustedY}px;"
  role="menu"
>
  {#each items as item, index}
    {#if item.separator && index > 0}
      <div class="context-menu-separator" role="separator"></div>
    {/if}
    <button
      type="button"
      class="context-menu-item"
      class:active={item.active}
      class:danger={item.danger}
      role="menuitem"
      on:mousedown|preventDefault
      on:click={() => handleItemClick(item)}
    >
      <span class="context-menu-item-check">
        {#if item.active}✓{/if}
      </span>
      <span class="context-menu-item-label">{item.label}</span>
      {#if item.shortcut}
        <span class="context-menu-item-shortcut">{item.shortcut}</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .context-menu {
    z-index: 9999;
    min-width: 180px;
    max-width: 280px;
    padding: 4px;
    border: 1px solid var(--md-editor-border);
    border-radius: var(--md-editor-radius-md);
    background: var(--md-editor-surface);
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.16);
    animation: context-menu-in 120ms ease-out;
  }

  @keyframes context-menu-in {
    from {
      opacity: 0;
      transform: translateY(-4px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .context-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 30px;
    padding: 4px 10px;
    border: 0;
    border-radius: var(--md-editor-radius-sm);
    background: transparent;
    color: var(--md-editor-fg);
    font-size: 12.5px;
    font-family: inherit;
    cursor: pointer;
    text-align: left;
    white-space: nowrap;
  }

  .context-menu-item:hover {
    background: rgba(128, 128, 128, 0.08);
  }

  .context-menu-item.active {
    color: var(--md-editor-accent-strong);
  }

  .context-menu-item.danger {
    color: var(--md-editor-danger);
  }

  .context-menu-item.danger:hover {
    background: color-mix(in srgb, var(--md-editor-danger) 8%, transparent);
  }

  .context-menu-item-check {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    font-size: 13px;
    color: var(--md-editor-accent-strong);
    flex-shrink: 0;
  }

  .context-menu-item-label {
    flex: 1;
    min-width: 0;
  }

  .context-menu-item-shortcut {
    color: var(--md-editor-muted-fg);
    font-size: 11px;
    flex-shrink: 0;
  }

  .context-menu-separator {
    height: 1px;
    margin: 3px 6px;
    background: var(--md-editor-border);
  }
</style>
