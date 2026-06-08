<script lang="ts">
  import type { DocumentStats } from '../../lib/outline/outlineService';
  import { clickOutside } from '../actions/clickOutside';
  import { pulseOnChange } from '../actions/motion';

  type StatsMetric = 'lines' | 'words' | 'chars';

  export let stats: DocumentStats;
  export let activeMetric: StatsMetric = 'words';
  export let readingTimeVisible = false;
  export let onMetricChange: (metric: StatsMetric) => void = () => undefined;

  let statsOpen = false;

  $: statsOptions = [
    { key: 'lines' as const, label: '行数', value: stats.lines, unit: '行' },
    { key: 'words' as const, label: '词数', value: stats.words, unit: '词' },
    { key: 'chars' as const, label: '字符', value: stats.chars, unit: '字符' },
  ];

  $: activeStatsOption =
    statsOptions.find((option) => option.key === activeMetric) ?? statsOptions[1];

  function toggleStats() {
    statsOpen = !statsOpen;
  }

  function selectMetric(metric: StatsMetric) {
    onMetricChange(metric);
    closeStats();
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

<div class="statusbar" aria-label="文档统计">
  <div class="statusbar-stats" use:clickOutside={closeStats}>
    <button
      class="statusbar-stats-trigger"
      type="button"
      aria-haspopup="dialog"
      aria-expanded={statsOpen}
      aria-controls="writing-stats-popover"
      title="字数统计"
      use:pulseOnChange={activeStatsOption.value}
      on:click={toggleStats}
      on:keydown={handleStatsKeydown}
    >
      {activeStatsOption.value}
      {activeStatsOption.unit}
    </button>

    {#if statsOpen}
      <div
        id="writing-stats-popover"
        class="writing-stats-popover"
        role="dialog"
        aria-labelledby="writing-stats-title"
      >
        <h2 id="writing-stats-title">文档统计</h2>
        {#if readingTimeVisible}
          <div class="reading-time">预计阅读 {stats.readingMinutes} 分钟</div>
        {/if}
        <div class="writing-stats-options" role="group" aria-label="选择显示的统计类型">
          {#each statsOptions as option (option.key)}
            <button
              class="writing-stats-option"
              class:active={activeMetric === option.key}
              type="button"
              aria-pressed={activeMetric === option.key}
              on:click={() => selectMetric(option.key)}
            >
              <span>{option.label}</span>
              <strong>{option.value}</strong>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>
