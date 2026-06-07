<script lang="ts">
  import type { DocumentStats } from '../../lib/outline/outlineService';
  import { clickOutside } from '../actions/clickOutside';
  import { pulseOnChange } from '../actions/motion';

  export let stats: DocumentStats;

  let statsOpen = false;

  function toggleStats() {
    statsOpen = !statsOpen;
  }

  function closeStats() {
    statsOpen = false;
  }

  function handleStatsKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      closeStats();
    }
  }
</script>

<footer class="statusbar">
  <div class="statusbar-stats" use:clickOutside={closeStats}>
    <button
      class="statusbar-stats-trigger"
      type="button"
      aria-haspopup="dialog"
      aria-expanded={statsOpen}
      aria-controls="writing-stats-popover"
      title="字数统计"
      use:pulseOnChange={stats.words}
      on:click={toggleStats}
      on:keydown={handleStatsKeydown}
    >
      {stats.words} 词
    </button>

    {#if statsOpen}
      <div
        id="writing-stats-popover"
        class="writing-stats-popover"
        role="dialog"
        aria-labelledby="writing-stats-title"
      >
        <h2 id="writing-stats-title">字数统计</h2>
        <dl>
          <div>
            <dt>{stats.lines}</dt>
            <dd>行</dd>
          </div>
          <div>
            <dt>{stats.words}</dt>
            <dd>词</dd>
          </div>
          <div>
            <dt>{stats.chars}</dt>
            <dd>字符</dd>
          </div>
        </dl>
      </div>
    {/if}
  </div>
</footer>
