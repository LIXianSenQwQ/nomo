<script lang="ts">
  import { ChevronDown } from '@lucide/svelte';
  import { slide } from 'svelte/transition';
  import type {
    ContextMenuItem,
    ContextMenuRequest,
    EditorMode,
  } from '../../lib/editor-core';
  import { createSourceTextareaImePunctuationFallback } from '../../lib/input/windowsImePunctuationFallback';
  import type { FrontMatterBlock } from '../../lib/markdown/frontMatter';
  import type { OutlineItem } from '../../lib/outline/outlineService';
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
  export let outlineVisible: boolean;
  export let outline: OutlineItem[];
  export let activeOutlineId: string;
  export let collapsedOutlineIds: Set<string>;
  export let visibleOutlineIds: Set<string>;
  export let sourceTextarea: HTMLTextAreaElement;
  export let sourcePane: HTMLElement;
  export let semanticPane: HTMLElement;
  export let editorHost: HTMLDivElement;
  export let updateMarkdown: (event: Event) => void;
  export let enterFrontMatterEdit: () => void;
  export let leaveFrontMatterEdit: () => void;
  export let updateFrontMatterContent: (content: string) => void;
  export let deleteFrontMatter: () => void;
  export let updateActiveOutlineFromSourceScroll: () => void;
  export let updateActiveOutlineFromSemanticScroll: () => void;
  export let handleEditorPaste: (event: ClipboardEvent) => void;
  export let handleEditorDrop: (event: DragEvent) => void;
  export let handleWorkspaceContextMenu: (event: MouseEvent) => void;
  export let openContextMenu: (request: ContextMenuRequest) => void = () => undefined;
  export let copyContextText: (text: string) => void | Promise<void> = () => undefined;
  export let isOutlineItemExpandable: (index: number) => boolean;
  export let toggleOutlineItemExpanded: (item: OutlineItem) => void;
  export let expandAllOutline: () => void = () => undefined;
  export let collapseAllOutline: () => void = () => undefined;
  export let toggleOutlineVisible: () => void = () => undefined;
  export let jumpToOutlineItem: (item: OutlineItem) => void;
  export let onSourceScroll: (() => void) | undefined = undefined;
  export let onSemanticScroll: (() => void) | undefined = undefined;

  const sourceImeFallback = createSourceTextareaImePunctuationFallback();

  function handleOutlineToggle(event: MouseEvent, item: OutlineItem) {
    event.preventDefault();
    event.stopPropagation();
    toggleOutlineItemExpanded(item);
  }

  function handleSemanticContextMenu(event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    if (!target || target.closest('input, textarea, select')) {
      return;
    }
    if (target.closest('.front-matter-card')) {
      event.preventDefault();
      return;
    }
    if (target.closest('.prosemirror-host')) return;
    handleWorkspaceContextMenu(event);
  }

  function outlineSeparator(): ContextMenuItem {
    return { label: '', separator: true };
  }

  function buildOutlineViewItems(): ContextMenuItem[] {
    const expandableItems = outline.filter((_item, index) => isOutlineItemExpandable(index));
    const allExpandableItemsCollapsed =
      expandableItems.length > 0 && expandableItems.every((item) => collapsedOutlineIds.has(item.id));
    return [
      {
        label: t.expandAll(),
        icon: 'expand',
        disabled: collapsedOutlineIds.size === 0,
        action: expandAllOutline,
      },
      {
        label: t.collapseAll(),
        icon: 'collapse',
        disabled: expandableItems.length === 0 || allExpandableItemsCollapsed,
        action: collapseAllOutline,
      },
      outlineSeparator(),
      { label: t.hideOutline(), icon: 'outline', action: toggleOutlineVisible },
    ];
  }

  function handleOutlineContextMenu(event: MouseEvent) {
    if (event.defaultPrevented) return;
    event.preventDefault();
    openContextMenu({
      x: event.clientX,
      y: event.clientY,
      items: buildOutlineViewItems(),
    });
  }

  function handleOutlineItemContextMenu(event: MouseEvent, item: OutlineItem, index: number) {
    event.preventDefault();
    const expandable = isOutlineItemExpandable(index);
    const items: ContextMenuItem[] = [
      {
        label: t.jumpToHeading({ title: item.title }),
        icon: 'jump',
        action: () => jumpToOutlineItem(item),
      },
      { label: t.copyHeading(), icon: 'copy', action: () => copyContextText(item.title) },
    ];
    if (expandable) {
      items.push({
        label: collapsedOutlineIds.has(item.id) ? t.expandHeading() : t.collapseHeading(),
        icon: collapsedOutlineIds.has(item.id) ? 'expand' : 'collapse',
        action: () => toggleOutlineItemExpanded(item),
      });
    }
    items.push(outlineSeparator(), ...buildOutlineViewItems());
    openContextMenu({ x: event.clientX, y: event.clientY, items });
  }

  // 拆分标题中的数字前缀与正文，如 "1.2 标题" → ["1.2 ", "标题"]
  function splitTitleNumber(title: string): [string, string] {
    const match = title.match(/^(\d+(?:\.\d+)*\.?\s*)/);
    return match ? [match[1], title.slice(match[1].length)] : ['', title];
  }
</script>

{#key interfaceLocale}
  <div
    class="editor-grid"
    class:source-only={mode === 'source'}
    use:modePaneMotion={{ mode, disabled: largeDocumentMode }}
  >
    <section
      bind:this={sourcePane}
      class="editor-pane source-pane"
      aria-label={t.markdownSource()}
      on:scroll={() => {
        updateActiveOutlineFromSourceScroll();
        onSourceScroll?.();
      }}
      on:contextmenu|preventDefault
    >
      <div class="document-layout">
        <textarea
          bind:this={sourceTextarea}
          class="source-editor"
          value={markdown}
          readonly={readonlyDocumentMode}
          on:keydown={sourceImeFallback.handleKeydown}
          on:keyup={sourceImeFallback.handleKeyup}
          on:beforeinput={sourceImeFallback.handleBeforeInput}
          on:input={(event) => {
            sourceImeFallback.handleInput();
            updateMarkdown(event);
          }}
          on:compositionstart={sourceImeFallback.handleCompositionStart}
          on:compositionupdate={sourceImeFallback.handleCompositionUpdate}
          on:compositionend={sourceImeFallback.handleCompositionEnd}
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
      on:scroll={() => {
        updateActiveOutlineFromSemanticScroll();
        onSemanticScroll?.();
      }}
      on:paste={handleEditorPaste}
      on:drop={handleEditorDrop}
      on:dragover|preventDefault
      on:contextmenu={handleSemanticContextMenu}
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
      <aside
        class="content-outline"
        aria-label={t.documentOutline()}
        transition:outlinePanelTransition
        on:contextmenu={handleOutlineContextMenu}
      >
        <strong>{t.documentOutline()}</strong>
        {#if outline.length > 0}
          <div class="content-outline-list">
            {#each outline as item, index (item.id)}
              {#if visibleOutlineIds.has(item.id)}
                <div
                  class:active={activeOutlineId === item.id}
                  class="content-outline-row"
                  role="group"
                  style={`padding-left: ${(item.level - 1) * 16}px`}
                  transition:outlineRowTransition
                  on:contextmenu={(event) => handleOutlineItemContextMenu(event, item, index)}
                >
                  {#if isOutlineItemExpandable(index)}
                    <button
                      type="button"
                      class:collapsed={collapsedOutlineIds.has(item.id)}
                      class="outline-toggle"
                      title={collapsedOutlineIds.has(item.id)
                        ? t.expandHeading()
                        : t.collapseHeading()}
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
