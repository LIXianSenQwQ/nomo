<script lang="ts">
  import { ChevronDown } from '@lucide/svelte';
  import type { EditorMode } from '../../lib/editor-core';
  import type { OutlineItem } from '../../lib/outline/outlineService';

  export let mode: EditorMode;
  export let markdown: string;
  export let readonlyDocumentMode: boolean;
  export let externalFileWarning: string;
  export let outlineVisible: boolean;
  export let outline: OutlineItem[];
  export let activeOutlineId: string;
  export let collapsedOutlineIds: Set<string>;
  export let visibleOutlineIds: Set<string>;
  export let sourceTextarea: HTMLTextAreaElement;
  export let sourcePane: HTMLElement;
  export let semanticPane: HTMLElement;
  export let editorHost: HTMLDivElement;
  export let saveMarkdownFile: (saveAs?: boolean) => void;
  export let updateMarkdown: (event: Event) => void;
  export let updateActiveOutlineFromSourceScroll: () => void;
  export let updateActiveOutlineFromSemanticScroll: () => void;
  export let handleEditorPaste: (event: ClipboardEvent) => void;
  export let handleEditorDrop: (event: DragEvent) => void;
  export let isOutlineItemExpandable: (index: number) => boolean;
  export let toggleOutlineItemExpanded: (item: OutlineItem) => void;
  export let jumpToOutlineItem: (item: OutlineItem) => void;

  function handleOutlineToggle(event: MouseEvent, item: OutlineItem) {
    event.preventDefault();
    event.stopPropagation();
    toggleOutlineItemExpanded(item);
  }
</script>

{#if externalFileWarning}
  <div class="desktop-alert" role="status">
    <strong>文件状态</strong>
    <span>{externalFileWarning}</span>
    <button on:click={() => saveMarkdownFile(true)}>另存为</button>
  </div>
{/if}

<div class="editor-grid" class:source-only={mode === 'source'}>
  <section
    bind:this={sourcePane}
    class="editor-pane source-pane"
    aria-label="Markdown 源文本"
    on:scroll={updateActiveOutlineFromSourceScroll}
  >
    <div class="document-layout">
      <textarea
        bind:this={sourceTextarea}
        class="source-editor"
        value={markdown}
        readonly={readonlyDocumentMode}
        on:input={updateMarkdown}
        on:paste={handleEditorPaste}
        on:drop={handleEditorDrop}
        spellcheck="false"
      ></textarea>
    </div>
  </section>

  <section
    bind:this={semanticPane}
    class="semantic-pane"
    aria-label="语义编辑区"
    on:scroll={updateActiveOutlineFromSemanticScroll}
    on:paste={handleEditorPaste}
    on:drop={handleEditorDrop}
    on:dragover|preventDefault
  >
    <div class="document-layout">
      <div bind:this={editorHost} class="prosemirror-host"></div>
    </div>
  </section>

  {#if outlineVisible}
    <aside class="content-outline" aria-label="文档大纲">
      <strong>文档大纲</strong>
      {#if outline.length > 0}
        <div class="content-outline-list">
          {#each outline as item, index (item.id)}
            {#if visibleOutlineIds.has(item.id)}
              <div
                class:active={activeOutlineId === item.id}
                class="content-outline-row"
                style={`padding-left: ${(item.level - 1) * 16}px`}
              >
                {#if isOutlineItemExpandable(index)}
                  <button
                    type="button"
                    class:collapsed={collapsedOutlineIds.has(item.id)}
                    class="outline-toggle"
                    title={collapsedOutlineIds.has(item.id) ? '展开标题' : '折叠标题'}
                    aria-label={collapsedOutlineIds.has(item.id)
                      ? `展开 ${item.title}`
                      : `折叠 ${item.title}`}
                    aria-expanded={!collapsedOutlineIds.has(item.id)}
                    on:click={(event) => handleOutlineToggle(event, item)}
                  >
                    <ChevronDown size={13} />
                  </button>
                {:else}
                  <span class="outline-toggle-placeholder"></span>
                {/if}
                <button
                  type="button"
                  class="outline-link"
                  title={item.title}
                  on:click={() => jumpToOutlineItem(item)}
                >
                  <span>{item.title}</span>
                </button>
              </div>
            {/if}
          {/each}
        </div>
      {:else}
        <p>当前文档还没有标题</p>
      {/if}
    </aside>
  {/if}
</div>
