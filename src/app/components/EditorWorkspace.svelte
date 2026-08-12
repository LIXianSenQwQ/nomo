<script lang="ts">
  import { ChevronDown, ChevronsDownUp, ChevronsUpDown } from '@lucide/svelte';
  import { onDestroy } from 'svelte';
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
    planOutlineSectionMove,
    type OutlineDropPlacement,
  } from '../../lib/outline/outlineReorder';
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
  export let collapseOutlineToDefaultLevel: () => void = () => undefined;
  export let toggleOutlineVisible: () => void = () => undefined;
  export let jumpToOutlineItem: (item: OutlineItem) => void;
  export let moveOutlineSection: (request: {
    sourceIndex: number;
    targetIndex: number;
    placement: 'before' | 'inside' | 'after';
  }) => boolean;
  export let onSourceScroll: (() => void) | undefined = undefined;
  export let onSemanticScroll: (() => void) | undefined = undefined;

  interface PendingOutlineDrag {
    pointerId: number;
    startX: number;
    startY: number;
    sourceIndex: number;
    row: HTMLElement;
  }

  let outlinePanel: HTMLElement;
  let pendingOutlineDrag: PendingOutlineDrag | null = null;
  let outlineDragging = false;
  let outlineDragPreview: HTMLElement | null = null;
  let outlineDropTargetIndex = -1;
  let outlineDropPlacement: OutlineDropPlacement | null = null;
  let outlineDropValid = false;
  let suppressOutlineClick = false;
  let outlineExpandTimer: ReturnType<typeof setTimeout> | null = null;
  let outlineExpandTargetIndex = -1;
  let outlineAutoScrollFrame = 0;
  let outlinePointerX = 0;
  let outlinePointerY = 0;
  let hasExpandableOutline = false;
  let hasCollapsedExpandableOutline = false;

  $: hasExpandableOutline = outline.some((_item, index) => isOutlineItemExpandable(index));
  $: hasCollapsedExpandableOutline = outline.some(
    (item, index) => isOutlineItemExpandable(index) && collapsedOutlineIds.has(item.id),
  );

  const sourceImeFallback = createSourceTextareaImePunctuationFallback();

  function toggleAllOutlineItems() {
    if (hasCollapsedExpandableOutline) {
      expandAllOutline();
      return;
    }
    collapseOutlineToDefaultLevel();
  }

  function handleOutlineToggle(event: MouseEvent, item: OutlineItem) {
    event.preventDefault();
    event.stopPropagation();
    toggleOutlineItemExpanded(item);
  }

  function handleOutlineLinkClick(event: MouseEvent, item: OutlineItem) {
    if (suppressOutlineClick) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    jumpToOutlineItem(item);
  }

  function handleOutlinePointerDown(event: PointerEvent, sourceIndex: number) {
    if (
      readonlyDocumentMode ||
      event.button !== 0 ||
      !event.isPrimary ||
      event.pointerType === 'touch' ||
      (event.target as HTMLElement | null)?.closest('.outline-toggle')
    ) {
      return;
    }
    const row = event.currentTarget as HTMLElement;
    pendingOutlineDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      sourceIndex,
      row,
    };
    outlinePointerX = event.clientX;
    outlinePointerY = event.clientY;
    row.setPointerCapture?.(event.pointerId);
  }

  function handleOutlinePointerMove(event: PointerEvent) {
    const pending = pendingOutlineDrag;
    if (!pending || event.pointerId !== pending.pointerId) return;
    outlinePointerX = event.clientX;
    outlinePointerY = event.clientY;
    if (!outlineDragging) {
      const distance = Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY);
      if (distance < 5) return;
      beginOutlineDrag(pending, event.clientX, event.clientY);
    }
    event.preventDefault();
    positionOutlineDragPreview(event.clientX, event.clientY);
    updateOutlineDropTarget(event.clientX, event.clientY);
    scheduleOutlineAutoScroll();
  }

  function beginOutlineDrag(pending: PendingOutlineDrag, clientX: number, clientY: number) {
    outlineDragging = true;
    suppressOutlineClick = true;
    const preview = pending.row.cloneNode(true) as HTMLElement;
    const rect = pending.row.getBoundingClientRect();
    preview.classList.add('outline-drag-preview');
    preview.style.width = `${rect.width}px`;
    preview.setAttribute('aria-hidden', 'true');
    document.body.appendChild(preview);
    outlineDragPreview = preview;
    positionOutlineDragPreview(clientX, clientY);
  }

  function positionOutlineDragPreview(clientX: number, clientY: number) {
    if (!outlineDragPreview) return;
    outlineDragPreview.style.transform = `translate3d(${clientX + 12}px, ${clientY + 12}px, 0)`;
  }

  function updateOutlineDropTarget(clientX: number, clientY: number) {
    const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const row = element?.closest<HTMLElement>('[data-outline-index]');
    if (!row || !outlinePanel?.contains(row) || !pendingOutlineDrag) {
      clearOutlineDropTarget();
      return;
    }
    const targetIndex = Number(row.dataset.outlineIndex);
    const rect = row.getBoundingClientRect();
    const relativeY = rect.height > 0 ? (clientY - rect.top) / rect.height : 0.5;
    const placement: OutlineDropPlacement =
      relativeY < 0.3 ? 'before' : relativeY > 0.7 ? 'after' : 'inside';
    const plan = planOutlineSectionMove(outline, {
      sourceIndex: pendingOutlineDrag.sourceIndex,
      targetIndex,
      placement,
    });
    outlineDropTargetIndex = targetIndex;
    outlineDropPlacement = placement;
    outlineDropValid = plan.ok;
    scheduleCollapsedOutlineExpansion(targetIndex);
  }

  function clearOutlineDropTarget() {
    outlineDropTargetIndex = -1;
    outlineDropPlacement = null;
    outlineDropValid = false;
    clearOutlineExpandTimer();
  }

  function scheduleCollapsedOutlineExpansion(targetIndex: number) {
    if (
      targetIndex === outlineExpandTargetIndex ||
      !isOutlineItemExpandable(targetIndex) ||
      !collapsedOutlineIds.has(outline[targetIndex]?.id)
    ) {
      if (!collapsedOutlineIds.has(outline[targetIndex]?.id)) clearOutlineExpandTimer();
      return;
    }
    clearOutlineExpandTimer();
    outlineExpandTargetIndex = targetIndex;
    outlineExpandTimer = setTimeout(() => {
      const item = outline[targetIndex];
      if (outlineDragging && item && collapsedOutlineIds.has(item.id)) {
        toggleOutlineItemExpanded(item);
      }
      clearOutlineExpandTimer();
    }, 500);
  }

  function clearOutlineExpandTimer() {
    if (outlineExpandTimer) clearTimeout(outlineExpandTimer);
    outlineExpandTimer = null;
    outlineExpandTargetIndex = -1;
  }

  function scheduleOutlineAutoScroll() {
    if (outlineAutoScrollFrame) return;
    outlineAutoScrollFrame = requestAnimationFrame(runOutlineAutoScroll);
  }

  function runOutlineAutoScroll() {
    outlineAutoScrollFrame = 0;
    if (!outlineDragging || !outlinePanel) return;
    const rect = outlinePanel.getBoundingClientRect();
    const edge = 36;
    let delta = 0;
    if (outlinePointerY < rect.top + edge) {
      delta = -Math.ceil(((rect.top + edge - outlinePointerY) / edge) * 12);
    } else if (outlinePointerY > rect.bottom - edge) {
      delta = Math.ceil(((outlinePointerY - (rect.bottom - edge)) / edge) * 12);
    }
    if (delta !== 0) {
      outlinePanel.scrollTop += delta;
      updateOutlineDropTarget(outlinePointerX, outlinePointerY);
      scheduleOutlineAutoScroll();
    }
  }

  function handleOutlinePointerUp(event: PointerEvent) {
    const pending = pendingOutlineDrag;
    if (!pending || event.pointerId !== pending.pointerId) return;
    if (outlineDragging && outlineDropTargetIndex >= 0 && outlineDropPlacement) {
      moveOutlineSection({
        sourceIndex: pending.sourceIndex,
        targetIndex: outlineDropTargetIndex,
        placement: outlineDropPlacement,
      });
    }
    finishOutlineDrag();
  }

  function cancelOutlineDrag() {
    if (!pendingOutlineDrag) return;
    if (outlineDragging) suppressOutlineClick = true;
    finishOutlineDrag();
  }

  function finishOutlineDrag() {
    const pending = pendingOutlineDrag;
    if (pending?.row.hasPointerCapture?.(pending.pointerId)) {
      pending.row.releasePointerCapture(pending.pointerId);
    }
    pendingOutlineDrag = null;
    outlineDragging = false;
    outlineDragPreview?.remove();
    outlineDragPreview = null;
    clearOutlineDropTarget();
    if (outlineAutoScrollFrame) cancelAnimationFrame(outlineAutoScrollFrame);
    outlineAutoScrollFrame = 0;
    setTimeout(() => {
      suppressOutlineClick = false;
    }, 0);
  }

  function handleOutlineWindowKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && pendingOutlineDrag) {
      event.preventDefault();
      cancelOutlineDrag();
    }
  }

  onDestroy(() => {
    outlineDragPreview?.remove();
    clearOutlineExpandTimer();
    if (outlineAutoScrollFrame) cancelAnimationFrame(outlineAutoScrollFrame);
  });

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

<svelte:window
  on:pointermove={handleOutlinePointerMove}
  on:pointerup={handleOutlinePointerUp}
  on:pointercancel={cancelOutlineDrag}
  on:blur={cancelOutlineDrag}
  on:keydown={handleOutlineWindowKeydown}
/>

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
        bind:this={outlinePanel}
        class="content-outline"
        class:outline-dragging={outlineDragging}
        class:outline-readonly={readonlyDocumentMode}
        aria-label={t.documentOutline()}
        transition:outlinePanelTransition
        on:contextmenu={handleOutlineContextMenu}
      >
        <div class="content-outline-header">
          <strong>{t.documentOutline()}</strong>
          {#if hasExpandableOutline}
            <button
              type="button"
              class="outline-bulk-toggle"
              title={hasCollapsedExpandableOutline
                ? t.expandAllOutline()
                : t.collapseOutlineToDefaultLevel()}
              aria-label={hasCollapsedExpandableOutline
                ? t.expandAllOutline()
                : t.collapseOutlineToDefaultLevel()}
              on:click={toggleAllOutlineItems}
            >
              {#if hasCollapsedExpandableOutline}
                <ChevronsUpDown size={15} />
              {:else}
                <ChevronsDownUp size={15} />
              {/if}
            </button>
          {/if}
        </div>
        {#if outline.length > 0}
          <div class="content-outline-list">
            {#each outline as item, index (item.id)}
              {#if visibleOutlineIds.has(item.id)}
                <div
                  class:active={activeOutlineId === item.id}
                  class:outline-drag-source={outlineDragging && pendingOutlineDrag?.sourceIndex === index}
                  class:outline-drop-before={
                    outlineDropValid && outlineDropTargetIndex === index && outlineDropPlacement === 'before'
                  }
                  class:outline-drop-inside={
                    outlineDropValid && outlineDropTargetIndex === index && outlineDropPlacement === 'inside'
                  }
                  class:outline-drop-after={
                    outlineDropValid && outlineDropTargetIndex === index && outlineDropPlacement === 'after'
                  }
                  class:outline-drop-invalid={
                    outlineDragging && !outlineDropValid && outlineDropTargetIndex === index
                  }
                  class="content-outline-row"
                  data-outline-index={index}
                  role="group"
                  style={`padding-left: ${(item.level - 1) * 16}px`}
                  transition:outlineRowTransition
                  on:pointerdown={(event) => handleOutlinePointerDown(event, index)}
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
                    on:click={(event) => handleOutlineLinkClick(event, item)}
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
