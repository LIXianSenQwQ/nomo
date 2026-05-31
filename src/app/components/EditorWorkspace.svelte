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
  export let isOutlineItemVisible: (index: number) => boolean;
  export let isOutlineItemExpandable: (index: number) => boolean;
  export let isOutlineItemExpanded: (item: OutlineItem) => boolean;
  export let toggleOutlineItemExpanded: (item: OutlineItem) => void;
  export let jumpToOutlineItem: (item: OutlineItem) => void;
</script>

{#if externalFileWarning}
  <div class="desktop-alert" role="status">
    <strong>文件状态</strong>
    <span>{externalFileWarning}</span>
    <button on:click={() => saveMarkdownFile(true)}>另存为</button>
  </div>
{/if}

<div class="editor-grid" class:source-only={mode === 'source'}>
  <section bind:this={sourcePane} class="editor-pane source-pane" aria-label="Markdown 源文本" on:scroll={updateActiveOutlineFromSourceScroll}>
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

  <section bind:this={semanticPane} class="semantic-pane" aria-label="语义编辑区" on:scroll={updateActiveOutlineFromSemanticScroll} on:paste={handleEditorPaste} on:drop={handleEditorDrop} on:dragover|preventDefault>
    <div class="document-layout">
      <div bind:this={editorHost} class="prosemirror-host"></div>
    </div>
  </section>

  {#if outlineVisible}
    <aside class="content-outline" aria-label="文档大纲">
      <strong>文档大纲</strong>
      {#if outline.length > 0}
        <div class="content-outline-list">
          {#each outline as item, index}
            {#if isOutlineItemVisible(index)}
              <div class:active={activeOutlineId === item.id} class="content-outline-row" style={`padding-left: ${(item.level - 1) * 16}px`}>
                {#if isOutlineItemExpandable(index)}
                  <button
                    type="button"
                    class:collapsed={!isOutlineItemExpanded(item)}
                    class="outline-toggle"
                    title={isOutlineItemExpanded(item) ? '折叠标题' : '展开标题'}
                    aria-label={isOutlineItemExpanded(item) ? `折叠 ${item.title}` : `展开 ${item.title}`}
                    aria-expanded={isOutlineItemExpanded(item)}
                    on:click={() => toggleOutlineItemExpanded(item)}
                  >
                    <ChevronDown size={13} />
                  </button>
                {:else}
                  <span class="outline-toggle-placeholder"></span>
                {/if}
                <button type="button" class="outline-link" title={item.title} on:click={() => jumpToOutlineItem(item)}>
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
