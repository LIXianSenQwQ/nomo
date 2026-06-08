<script lang="ts">
  import type { DocumentStats } from '../../lib/outline/outlineService';
  import { clickOutside } from '../actions/clickOutside';
  import { pulseOnChange } from '../actions/motion';
  import { t } from '../i18n';

  type StatsMetric = 'lines' | 'words' | 'chars';

  export let interfaceLocale: string;
  export let stats: DocumentStats;
  export let activeMetric: StatsMetric = 'words';
  export let readingTimeVisible = false;
  export let onMetricChange: (metric: StatsMetric) => void = () => undefined;

  let statsOpen = false;

  $: statsOptions = [
    { key: 'lines' as const, label: t.lines(), value: stats.lines, unit: t.lineUnit() },
    { key: 'words' as const, label: t.words(), value: stats.words, unit: t.wordUnit() },
    { key: 'chars' as const, label: t.chars(), value: stats.chars, unit: t.charUnit() },
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

{#key interfaceLocale}
<div class="statusbar" aria-label={t.documentStats()} data-interface-locale={interfaceLocale}>
  <div class="statusbar-stats" use:clickOutside={closeStats}>
    <button
      class="statusbar-stats-trigger"
      type="button"
      aria-haspopup="dialog"
      aria-expanded={statsOpen}
      aria-controls="writing-stats-popover"
      title={t.wordCountStats()}
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
        <h2 id="writing-stats-title">{t.documentStats()}</h2>
        {#if readingTimeVisible}
          <div class="reading-time">{t.estimatedReadingMinutes({ minutes: stats.readingMinutes })}</div>
        {/if}
        <div class="writing-stats-options" role="group" aria-label={t.selectStatsMetric()}>
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
{/key}
