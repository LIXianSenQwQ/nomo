<script lang="ts">
  import { ChevronDown } from '@lucide/svelte';
  import { slide } from 'svelte/transition';
  import type { EditorMode } from '../../lib/editor-core';
  import type { FrontMatterBlock } from '../../lib/markdown/frontMatter';
  import type { OutlineItem } from '../../lib/outline/outlineService';
  import type { ExternalFileChangeState } from '../types';
  import {
    modePaneMotion,
    motionIn,
    outlinePanelTransition,
    outlineRowTransition,
    transitionDuration,
  } from '../actions/motion';
  import FrontMatterCard from './FrontMatterCard.svelte';
  import { t } from '../i18n';

  export let interfaceLocale: string;
  export let mode: EditorMode;
  export let markdown: string;
  export let largeDocumentMode: boolean;
  export let frontMatter: FrontMatterBlock | null;
  export let frontMatterEditing: boolean;
  export let frontMatterFocusRequest: number;
  export let frontMatterFocusTarget: 'default' | 'title-value';
  export let readonlyDocumentMode: boolean;
  export let externalFileChange: ExternalFileChangeState;
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
  export let reloadExternalFile: () => void;
  export let overwriteExternalFile: () => void;
  export let updateMarkdown: (event: Event) => void;
  export let enterFrontMatterEdit: () => void;
  export let leaveFrontMatterEdit: () => void;
  export let updateFrontMatterContent: (content: string) => void;
  export let deleteFrontMatter: () => void;
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

  // 拆分标题中的数字前缀与正文，如 "1.2 标题" → ["1.2 ", "标题"]
  function splitTitleNumber(title: string): [string, string] {
    const match = title.match(/^(\d+(?:\.\d+)*\.?\s*)/);
    return match ? [match[1], title.slice(match[1].length)] : ['', title];
  }
</script>

{#key interfaceLocale}
{#if externalFileChange.type !== 'none'}
  <div
    class="desktop-alert"
    role="status"
    use:motionIn={{ kind: 'panel', y: -8 }}
    transition:slide={{ duration: transitionDuration('panel') }}
  >
    <strong>{t.externalFileChanged()}</strong>
    <span>{externalFileChange.message}</span>
    <div class="desktop-alert-actions">
      {#if externalFileChange.type === 'modified'}
        <button type="button" on:click={reloadExternalFile}>{t.reloadExternalVersion()}</button>
      {/if}
      <button type="button" on:click={() => saveMarkdownFile(true)}>{t.saveAsCurrentContent()}</button>
      {#if externalFileChange.type === 'modified'}
        <button type="button" class="danger" on:click={overwriteExternalFile}>
          {t.overwriteExternalVersion()}
        </button>
      {/if}
    </div>
  </div>
{/if}

<div
  class="editor-grid"
  class:source-only={mode === 'source'}
  use:modePaneMotion={{ mode, disabled: largeDocumentMode }}
>
  <section
    bind:this={sourcePane}
    class="editor-pane source-pane"
    aria-label={t.markdownSource()}
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
    aria-label={t.semanticEditorArea()}
    on:scroll={updateActiveOutlineFromSemanticScroll}
    on:paste={handleEditorPaste}
    on:drop={handleEditorDrop}
    on:dragover|preventDefault
  >
    <div class="document-layout">
      {#if frontMatter}
        <FrontMatterCard
          {frontMatter}
          {interfaceLocale}
          editing={frontMatterEditing}
          focusRequest={frontMatterFocusRequest}
          focusTarget={frontMatterFocusTarget}
          readonly={readonlyDocumentMode}
          enterEdit={enterFrontMatterEdit}
          leaveEdit={leaveFrontMatterEdit}
          updateContent={updateFrontMatterContent}
          {deleteFrontMatter}
        />
      {/if}
      <div bind:this={editorHost} class="prosemirror-host"></div>
    </div>
  </section>

  {#if outlineVisible}
    <aside class="content-outline" aria-label={t.documentOutline()} transition:outlinePanelTransition>
      <strong>{t.documentOutline()}</strong>
      {#if outline.length > 0}
        <div class="content-outline-list">
          {#each outline as item, index (item.id)}
            {#if visibleOutlineIds.has(item.id)}
              <div
                class:active={activeOutlineId === item.id}
                class="content-outline-row"
                style={`padding-left: ${(item.level - 1) * 16}px`}
                transition:outlineRowTransition
              >
                {#if isOutlineItemExpandable(index)}
                  <button
                    type="button"
                    class:collapsed={collapsedOutlineIds.has(item.id)}
                    class="outline-toggle"
                    title={collapsedOutlineIds.has(item.id) ? t.expandHeading() : t.collapseHeading()}
                    aria-label={collapsedOutlineIds.has(item.id)
                      ? t.expandNamedHeading({ title: item.title })
                      : t.collapseNamedHeading({ title: item.title })}
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
                  <span>
                    {#if splitTitleNumber(item.title)[0]}
                      <span class="outline-num">{splitTitleNumber(item.title)[0]}</span
                      >{splitTitleNumber(item.title)[1]}
                    {:else}
                      {item.title}
                    {/if}
                  </span>
                </button>
              </div>
            {/if}
          {/each}
        </div>
      {:else}
        <p>{t.documentHasNoHeadings()}</p>
      {/if}
    </aside>
  {/if}
</div>
{/key}
