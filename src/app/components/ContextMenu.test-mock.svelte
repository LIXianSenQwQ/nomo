<script lang="ts">
  export let x = 0;
  export let y = 0;
  export let items: unknown[] = [];
  export let onClose: () => void = () => undefined;
</script>

{#if items.length > 0}
  <div data-testid="context-menu-mock" data-x={x} data-y={y}>
    <button type="button" on:click={onClose}>close</button>
  </div>
{/if}
