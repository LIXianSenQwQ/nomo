<script lang="ts">
  import {
    AlignHorizontalSpaceAround,
    Bold,
    BookOpenText,
    Braces,
    CheckSquare,
    Code2,
    CodeXml,
    Heading1,
    Highlighter,
    Italic,
    Link,
    List,
    ListTree,
    MessageSquare,
    Info,
    Quote,
    Search,
    Sigma,
    Strikethrough,
    Superscript,
    Table2,
    TableOfContents,
    Underline,
  } from '@lucide/svelte';
  import {
    DIAGRAM_TEMPLATES,
    type DiagramType,
    type EditorCommand,
    type EditorMode,
    type InlinePendingMarks,
  } from '../../lib/editor-core';
  import { clickOutside } from '../actions/clickOutside';
  import { modeSwitchIndicator } from '../actions/motion';
  import { getDiagramTypeLabel, t } from '../i18n';

  export let interfaceLocale: string;
  export let mode: EditorMode;
  export let contentWidthPercent: number;
  export let outlineVisible: boolean;
  export let runCommand: (command: EditorCommand) => void;
  export let pendingInlineMarks: InlinePendingMarks;
  export let tablePickerOpen: boolean;
  export let openTablePicker: () => void;
  export let closeTablePicker: () => void;
  export let openLinkPicker: () => void;
  export let insertTableWithSize: (rows: number, columns: number) => void;
  export let updateContentWidth: (event: Event) => void;
  export let setMode: (mode: EditorMode) => void;
  export let toggleOutlineVisible: () => void;
  export let openSearchPanel: () => void;

  const tableRows = [1, 2, 3, 4, 5];
  const tableColumns = [1, 2, 3, 4, 5, 6];
  let previewRows = 3;
  let previewColumns = 4;
  let diagramPickerOpen = false;

  function toggleTablePicker() {
    if (tablePickerOpen) {
      closeTablePicker();
      return;
    }
    previewRows = 3;
    previewColumns = 4;
    openTablePicker();
  }

  function handleTablePickerKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeTablePicker();
    }
  }

  function closeDiagramPicker() {
    diagramPickerOpen = false;
  }

  function insertBlankDiagram() {
    runCommand({ type: 'insertMermaidBlock' });
    closeDiagramPicker();
  }

  function insertDiagram(diagramType: DiagramType) {
    runCommand({ type: 'insertDiagramBlock', diagramType });
    closeDiagramPicker();
  }

  function handleDiagramPickerKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDiagramPicker();
    }
  }
</script>

{#key interfaceLocale}
<div class="toolbar" aria-label={t.formatToolbar()} data-interface-locale={interfaceLocale}>
  <button
    title={t.title()}
    aria-label={t.setHeadingOne()}
    on:mousedown|preventDefault
    on:click={() => runCommand({ type: 'setHeading', level: 1 })}
  >
    <Heading1 size={17} />
  </button>
  <button
    title={t.bold()}
    aria-label={t.toggleBold()}
    class:active={pendingInlineMarks.strong}
    on:mousedown|preventDefault
    on:click={() => runCommand({ type: 'toggleBold' })}
  >
    <Bold size={17} />
  </button>
  <button
    title={t.italic()}
    aria-label={t.toggleItalic()}
    class:active={pendingInlineMarks.em}
    on:mousedown|preventDefault
    on:click={() => runCommand({ type: 'toggleItalic' })}
  >
    <Italic size={17} />
  </button>
  <button
    title={t.strikethrough()}
    aria-label={t.toggleStrikethrough()}
    class:active={pendingInlineMarks.strikethrough}
    on:mousedown|preventDefault
    on:click={() => runCommand({ type: 'toggleStrikethrough' })}
  >
    <Strikethrough size={17} />
  </button>
  <button
    title={t.underline()}
    aria-label={t.toggleUnderline()}
    class:active={pendingInlineMarks.underline}
    on:mousedown|preventDefault
    on:click={() => runCommand({ type: 'toggleUnderline' })}
  >
    <Underline size={17} />
  </button>
  <button
    title={t.highlight()}
    aria-label={t.toggleHighlight()}
    class:active={pendingInlineMarks.highlight}
    on:mousedown|preventDefault
    on:click={() => runCommand({ type: 'toggleHighlight' })}
  >
    <Highlighter size={17} />
  </button>
  <button
    title={t.link()}
    aria-label={t.editLink()}
    on:mousedown|preventDefault
    on:click={openLinkPicker}
  >
    <Link size={17} />
  </button>
  <button
    title={t.inlineComment()}
    aria-label={t.insertInlineComment()}
    on:mousedown|preventDefault
    on:click={() => runCommand({ type: 'insertCommentInline' })}
  >
    <MessageSquare size={17} />
  </button>
  <button
    title={t.quote()}
    aria-label={t.toggleQuote()}
    on:mousedown|preventDefault
    on:click={() => runCommand({ type: 'toggleBlockquote' })}
  >
    <Quote size={17} />
  </button>
  <button
    title={t.callout()}
    aria-label={t.insertCallout()}
    on:mousedown|preventDefault
    on:click={() => runCommand({ type: 'insertCallout' })}
  >
    <Info size={17} />
  </button>
  <button
    title={t.list()}
    aria-label={t.toggleList()}
    on:mousedown|preventDefault
    on:click={() => runCommand({ type: 'toggleBulletList' })}
  >
    <List size={17} />
  </button>
  <button
    title={t.taskList()}
    aria-label={t.toggleTaskList()}
    on:mousedown|preventDefault
    on:click={() => runCommand({ type: 'toggleTaskList' })}
  >
    <CheckSquare size={17} />
  </button>
  <div class="table-picker-anchor" use:clickOutside={closeTablePicker}>
    <button
      title={t.table()}
      aria-haspopup="dialog"
      aria-expanded={tablePickerOpen}
      aria-label={t.insertTable()}
      class:active={tablePickerOpen}
      on:click|stopPropagation={toggleTablePicker}
    >
      <Table2 size={17} />
    </button>
    {#if tablePickerOpen}
      <div
        class="table-picker-popover"
        role="dialog"
        aria-label={t.chooseTableSize()}
        tabindex="-1"
        on:keydown={handleTablePickerKeydown}
      >
        <div class="table-picker-header">
          <span>{t.table()}</span>
          <strong>{previewRows} × {previewColumns}</strong>
        </div>
        <div class="table-picker-grid" aria-label={t.tableRowsColumns()}>
          {#each tableRows as row}
            {#each tableColumns as column}
              <button
                type="button"
                class="table-picker-cell"
                class:active={row <= previewRows && column <= previewColumns}
                aria-label={t.insertTableSize({ rows: row, columns: column })}
                on:mouseenter={() => {
                  previewRows = row;
                  previewColumns = column;
                }}
                on:focus={() => {
                  previewRows = row;
                  previewColumns = column;
                }}
                on:click={() => insertTableWithSize(row, column)}
              ></button>
            {/each}
          {/each}
        </div>
      </div>
    {/if}
  </div>
  <button
    title={t.codeBlock()}
    aria-label={t.insertCodeBlock()}
    on:click={() => runCommand({ type: 'insertCodeBlock' })}
  >
    <Code2 size={17} />
  </button>
  <button
    title={t.mathFormula()}
    aria-label={t.insertMathFormula()}
    on:click={() => runCommand({ type: 'insertMathBlock', tex: 'E = mc^2' })}
  >
    <Sigma size={17} />
  </button>
  <div class="diagram-picker-anchor" use:clickOutside={closeDiagramPicker}>
    <button
      title={t.diagram()}
      aria-haspopup="menu"
      aria-expanded={diagramPickerOpen}
      aria-label={t.insertDiagram()}
      class:active={diagramPickerOpen}
      on:click|stopPropagation={() => {
        diagramPickerOpen = !diagramPickerOpen;
      }}
    >
      <Braces size={17} />
    </button>
    {#if diagramPickerOpen}
      <div
        class="diagram-picker-popover"
        role="menu"
        aria-label={t.insertDiagram()}
        tabindex="-1"
        on:keydown={handleDiagramPickerKeydown}
      >
        <div class="diagram-picker-header">{t.diagram()}</div>
        <button type="button" role="menuitem" on:click={insertBlankDiagram}>
          <span>{t.blankDiagram()}</span>
          <small>mermaid</small>
        </button>
        <div class="diagram-picker-header">{t.template()}</div>
        {#each DIAGRAM_TEMPLATES as template}
          <button type="button" role="menuitem" on:click={() => insertDiagram(template.type)}>
            <span>{getDiagramTypeLabel(template.type)}</span>
            <small>{template.type}</small>
          </button>
        {/each}
      </div>
    {/if}
  </div>
  <button
    title={t.insertFootnote()}
    aria-label={t.insertFootnote()}
    on:mousedown|preventDefault
    on:click={() => runCommand({ type: 'insertFootnote' })}
  >
    <Superscript size={17} />
  </button>
  <button
    title={t.insertToc()}
    aria-label={t.insertToc()}
    on:mousedown|preventDefault
    on:click={() => runCommand({ type: 'insertToc' })}
  >
    <TableOfContents size={17} />
  </button>
  <span class="divider"></span>
  <span class="toolbar-spacer"></span>
  <button
    class="icon-button"
    title={t.searchReplace()}
    aria-label={t.searchReplace()}
    on:click={openSearchPanel}
  >
    <Search size={18} />
  </button>
  <label class="range-control width-control" title={t.contentWidth()}>
    <AlignHorizontalSpaceAround size={16} aria-hidden="true" />
    <span>{contentWidthPercent}%</span>
    <input
      type="range"
      min="45"
      max="90"
      step="1"
      value={contentWidthPercent}
      on:input={updateContentWidth}
    />
  </label>
  <div class="mode-switch" aria-label={t.mode()} use:modeSwitchIndicator={{ mode }}>
    <button
      title={t.semanticEditingTitle()}
      aria-label={t.semanticEditing()}
      aria-pressed={mode === 'semantic'}
      class:active={mode === 'semantic'}
      on:click={() => setMode('semantic')}
    >
      <BookOpenText size={17} />
    </button>
    <button
      title={t.sourceModeTitle()}
      aria-label={t.sourceMode()}
      aria-pressed={mode === 'source'}
      class:active={mode === 'source'}
      on:click={() => setMode('source')}
    >
      <CodeXml size={17} />
    </button>
  </div>
  <button
    class="icon-button"
    class:active={outlineVisible}
    title={outlineVisible ? t.hideOutline() : t.showOutline()}
    aria-label={outlineVisible ? t.hideOutline() : t.showOutline()}
    aria-pressed={outlineVisible}
    on:click={toggleOutlineVisible}
  >
    <ListTree size={18} />
  </button>
</div>
{/key}
