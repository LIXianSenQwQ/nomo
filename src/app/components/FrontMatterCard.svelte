<script lang="ts">
  import { tick } from 'svelte';
  import { FileText, PencilLine, Trash2 } from '@lucide/svelte';
  import { fade } from 'svelte/transition';
  import type { FrontMatterBlock } from '../../lib/markdown/frontMatter';
  import { motionIn, transitionDuration } from '../actions/motion';

  export let frontMatter: FrontMatterBlock;
  export let editing: boolean;
  export let readonly = false;
  export let enterEdit: () => void;
  export let leaveEdit: () => void;
  export let updateContent: (content: string) => void;
  export let deleteFrontMatter: () => void;

  let textarea: HTMLTextAreaElement;
  let confirmingDelete = false;

  $: if (editing && textarea) {
    tick().then(() => {
      textarea?.focus();
    });
  }

  function handleInput(event: Event) {
    if (readonly) {
      return;
    }
    updateContent((event.currentTarget as HTMLTextAreaElement).value);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      leaveEdit();
    }
  }

  function handleFocusOut(event: FocusEvent) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget instanceof Node) {
      if (event.currentTarget.contains(nextTarget)) {
        return;
      }
    }
    leaveEdit();
  }

  function requestDelete(event: MouseEvent) {
    event.stopPropagation();
    if (readonly) {
      return;
    }
    if (confirmingDelete) {
      confirmingDelete = false;
      deleteFrontMatter();
      return;
    }
    confirmingDelete = true;
  }

  function resetDeleteConfirmation() {
    confirmingDelete = false;
  }
</script>

{#if editing}
  <section
    class="front-matter-card is-editing"
    aria-label="文档元数据编辑态"
    use:motionIn={{ kind: 'panel', y: 8 }}
    transition:fade={{ duration: transitionDuration('mode') }}
    on:focusout={handleFocusOut}
  >
    <div class="front-matter-editor-shell">
      <textarea
        bind:this={textarea}
        aria-label="编辑文档元数据内容"
        spellcheck="false"
        readonly={readonly}
        value={frontMatter.content}
        on:input={handleInput}
        on:keydown={handleKeydown}
      ></textarea>
    </div>
    {#if frontMatter.fields.parseWarning}
      <p class="front-matter-warning">{frontMatter.fields.parseWarning}</p>
    {/if}
  </section>
{:else}
  <section
    class="front-matter-card"
    aria-label={readonly ? '查看文档元数据' : '编辑文档元数据'}
    use:motionIn={{ kind: 'panel', y: 8 }}
    transition:fade={{ duration: transitionDuration('mode') }}
  >
    <span class="front-matter-icon" aria-hidden="true"><FileText size={18} /></span>
    <button
      type="button"
      class="front-matter-main"
      disabled={readonly}
      on:focus={enterEdit}
      on:click={enterEdit}
    >
      <span class="front-matter-kicker">
        <strong class="front-matter-title">{frontMatter.fields.title || '文档元数据'}</strong>
        {#if frontMatter.fields.status}
          <span class="front-matter-status">{frontMatter.fields.status}</span>
        {/if}
      </span>
      <span class="front-matter-meta">
        {#if frontMatter.fields.created}
          <span>创建 {frontMatter.fields.created}</span>
        {/if}
        {#if frontMatter.fields.updated}
          <span>更新 {frontMatter.fields.updated}</span>
        {/if}
        {#if frontMatter.fields.extraFieldCount > 0}
          <span>更多元数据 {frontMatter.fields.extraFieldCount}</span>
        {/if}
      </span>
      {#if frontMatter.fields.tags.length > 0}
        <span class="front-matter-tags" aria-label="标签">
          {#each frontMatter.fields.tags as tag}
            <span>{tag}</span>
          {/each}
        </span>
      {/if}
      {#if frontMatter.fields.parseWarning}
        <span class="front-matter-warning">{frontMatter.fields.parseWarning}</span>
      {/if}
    </button>
    <span class="front-matter-actions">
      <span class="front-matter-edit-hint" aria-hidden="true"><PencilLine size={16} /></span>
      <button
        type="button"
        class:confirming={confirmingDelete}
        class="front-matter-delete"
        disabled={readonly}
        title={confirmingDelete ? '确认删除元数据' : '删除元数据'}
        aria-label={confirmingDelete ? '确认删除元数据' : '删除元数据'}
        on:click={requestDelete}
        on:blur={resetDeleteConfirmation}
      >
        {#if confirmingDelete}
          <span>确认删除</span>
        {:else}
          <Trash2 size={16} />
        {/if}
      </button>
    </span>
  </section>
{/if}
