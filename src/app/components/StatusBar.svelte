<script lang="ts">
  import type { EditorMode } from '../../lib/editor-core';
  import type { DocumentStats } from '../../lib/outline/outlineService';

  export let dirty: boolean;
  export let statusMessage: string;
  export let version: number;
  export let stats: DocumentStats;
  export let mode: EditorMode;
  export let readonlyDocumentMode: boolean;
</script>

<footer class="statusbar">
  <span>{dirty ? '未保存更改' : '已同步'}</span>
  <span>{statusMessage}</span>
  <span>version {version}</span>
  <span>{stats.chars} chars</span>
  <span>{stats.words} words</span>
  <span>{mode}</span>
  {#if readonlyDocumentMode}
    <span>readonly</span>
  {/if}
</footer>
