<script lang="ts">
  import { ChevronDown, ChevronUp, Replace, Search, X } from '@lucide/svelte';
  import { t } from '../i18n';

  export let interfaceLocale: string;
  export let open: boolean;
  export let replaceVisible: boolean;
  export let query: string;
  export let replacement: string;
  export let caseSensitive: boolean;
  export let activeIndex: number;
  export let matchCount: number;
  export let readonly: boolean;
  export let updateQuery: (event: Event) => void;
  export let updateReplacement: (event: Event) => void;
  export let toggleCaseSensitive: () => void;
  export let toggleReplaceVisible: () => void;
  export let findPrevious: () => void;
  export let findNext: () => void;
  export let replaceCurrent: () => void;
  export let replaceAll: () => void;
  export let close: () => void;

  let searchInput: HTMLInputElement;

  $: if (open && searchInput) {
    queueMicrotask(() => {
      searchInput?.focus();
      searchInput?.select();
    });
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (event.shiftKey) {
        findPrevious();
      } else {
        findNext();
      }
    }
  }
</script>

{#key interfaceLocale}
{#if open}
  <div class="search-replace-panel" role="search" aria-label={t.searchReplace()}>
    <div class="search-row">
      <label class="search-field">
        <Search size={15} aria-hidden="true" />
        <span class="sr-only">{t.search()}</span>
        <input
          bind:this={searchInput}
          value={query}
          placeholder={t.searchInDocument()}
          on:input={updateQuery}
          on:keydown={handleKeydown}
        />
      </label>
      <span class="search-count" aria-live="polite">
        {#if query}
          {matchCount === 0 ? t.noSearchResults() : t.searchMatchCount({
            current: activeIndex + 1,
            total: matchCount,
          })}
        {:else}
          {t.searchReady()}
        {/if}
      </span>
      <button
        type="button"
        class:active={caseSensitive}
        title={t.matchCase()}
        aria-label={t.matchCase()}
        aria-pressed={caseSensitive}
        on:click={toggleCaseSensitive}
      >
        Aa
      </button>
      <button
        type="button"
        title={t.previousMatch()}
        aria-label={t.previousMatch()}
        disabled={matchCount === 0}
        on:click={findPrevious}
      >
        <ChevronUp size={16} />
      </button>
      <button
        type="button"
        title={t.nextMatch()}
        aria-label={t.nextMatch()}
        disabled={matchCount === 0}
        on:click={findNext}
      >
        <ChevronDown size={16} />
      </button>
      <button
        type="button"
        class:active={replaceVisible}
        title={t.replace()}
        aria-label={t.replace()}
        aria-pressed={replaceVisible}
        on:click={toggleReplaceVisible}
      >
        <Replace size={15} />
      </button>
      <button type="button" title={t.closeSearch()} aria-label={t.closeSearch()} on:click={close}>
        <X size={15} />
      </button>
    </div>

    {#if replaceVisible}
      <div class="replace-row">
        <label class="replace-field">
          <Replace size={15} aria-hidden="true" />
          <span class="sr-only">{t.replaceWith()}</span>
          <input
            value={replacement}
            placeholder={t.replaceWith()}
            disabled={readonly}
            on:input={updateReplacement}
            on:keydown={handleKeydown}
          />
        </label>
        <button
          type="button"
          class="text-action"
          disabled={readonly || matchCount === 0}
          on:click={replaceCurrent}
        >
          {t.replace()}
        </button>
        <button
          type="button"
          class="text-action"
          disabled={readonly || matchCount === 0}
          on:click={replaceAll}
        >
          {t.replaceAll()}
        </button>
      </div>
    {/if}
  </div>
{/if}
{/key}

<style>
  .search-replace-panel {
    position: relative;
    z-index: 50;
    display: grid;
    gap: 6px;
    width: min(640px, 100%);
    padding: 8px 10px;
    border: 1px solid color-mix(in srgb, var(--md-editor-accent) 18%, var(--md-editor-border));
    border-radius: var(--md-editor-radius-md);
    background: color-mix(in srgb, var(--md-editor-surface) 96%, var(--md-editor-accent) 4%);
    box-shadow: 0 16px 36px rgba(15, 23, 42, 0.14);
  }

  .search-row,
  .replace-row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .search-field,
  .replace-field {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 160px;
    height: 30px;
    padding: 0 8px;
    border: 1px solid var(--md-editor-border);
    border-radius: var(--md-editor-radius-sm);
    background: var(--md-editor-bg);
    color: var(--md-editor-muted-fg);
  }

  .search-field {
    flex: 1 1 260px;
  }

  .replace-field {
    flex: 1 1 260px;
    margin-left: 0;
  }

  input {
    width: 100%;
    min-width: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--md-editor-fg);
    font: inherit;
  }

  input::placeholder {
    color: var(--md-editor-muted-fg);
  }

  .search-count {
    min-width: 72px;
    color: var(--md-editor-muted-fg);
    font-size: 12px;
    text-align: center;
    white-space: nowrap;
  }

  button {
    display: inline-grid;
    place-items: center;
    min-width: 30px;
    height: 30px;
    padding: 0 8px;
    border: 1px solid var(--md-editor-border);
    border-radius: var(--md-editor-radius-sm);
    background: var(--md-editor-bg);
    color: var(--md-editor-muted-fg);
    cursor: pointer;
  }

  button:hover:not(:disabled),
  button.active {
    border-color: color-mix(in srgb, var(--md-editor-accent) 35%, var(--md-editor-border));
    background: var(--md-editor-surface);
    color: var(--md-editor-accent-strong);
  }

  button:disabled {
    cursor: default;
    opacity: 0.45;
  }

  .text-action {
    width: auto;
    min-width: 64px;
    padding: 0 10px;
    font-size: 12px;
    font-weight: 600;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (max-width: 720px) {
    .search-replace-panel {
      width: 100%;
    }

    .search-row,
    .replace-row {
      flex-wrap: wrap;
    }

    .search-count {
      order: 3;
      width: 100%;
      text-align: left;
    }
  }
</style>
