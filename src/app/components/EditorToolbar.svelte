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
    PanelLeftClose,
    PanelLeftOpen,
    Quote,
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

  export let mode: EditorMode;
  export let focusMode: boolean;
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
  export let toggleFocusMode: () => void;

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

<div class="toolbar" aria-label="格式工具">
  <button
    title="标题"
    aria-label="设置为一级标题"
    on:mousedown|preventDefault
    on:click={() => runCommand({ type: 'setHeading', level: 1 })}
  >
    <Heading1 size={17} />
  </button>
  <button
    title="粗体"
    aria-label="切换粗体"
    class:active={pendingInlineMarks.strong}
    on:mousedown|preventDefault
    on:click={() => runCommand({ type: 'toggleBold' })}
  >
    <Bold size={17} />
  </button>
  <button
    title="斜体"
    aria-label="切换斜体"
    class:active={pendingInlineMarks.em}
    on:mousedown|preventDefault
    on:click={() => runCommand({ type: 'toggleItalic' })}
  >
    <Italic size={17} />
  </button>
  <button
    title="删除线"
    aria-label="切换删除线"
    class:active={pendingInlineMarks.strikethrough}
    on:mousedown|preventDefault
    on:click={() => runCommand({ type: 'toggleStrikethrough' })}
  >
    <Strikethrough size={17} />
  </button>
  <button
    title="下划线"
    aria-label="切换下划线"
    class:active={pendingInlineMarks.underline}
    on:mousedown|preventDefault
    on:click={() => runCommand({ type: 'toggleUnderline' })}
  >
    <Underline size={17} />
  </button>
  <button
    title="高亮"
    aria-label="切换高亮"
    class:active={pendingInlineMarks.highlight}
    on:mousedown|preventDefault
    on:click={() => runCommand({ type: 'toggleHighlight' })}
  >
    <Highlighter size={17} />
  </button>
  <button
    title="超链接"
    aria-label="编辑超链接"
    on:mousedown|preventDefault
    on:click={openLinkPicker}
  >
    <Link size={17} />
  </button>
  <button
    title="行内注释"
    aria-label="插入行内注释"
    on:mousedown|preventDefault
    on:click={() => runCommand({ type: 'insertCommentInline' })}
  >
    <MessageSquare size={17} />
  </button>
  <button
    title="引用"
    aria-label="切换引用"
    on:mousedown|preventDefault
    on:click={() => runCommand({ type: 'toggleBlockquote' })}
  >
    <Quote size={17} />
  </button>
  <button
    title="提示块"
    aria-label="插入提示块"
    on:mousedown|preventDefault
    on:click={() => runCommand({ type: 'insertCallout' })}
  >
    <Info size={17} />
  </button>
  <button
    title="列表"
    aria-label="切换列表"
    on:mousedown|preventDefault
    on:click={() => runCommand({ type: 'toggleBulletList' })}
  >
    <List size={17} />
  </button>
  <button
    title="任务列表"
    aria-label="切换任务列表"
    on:mousedown|preventDefault
    on:click={() => runCommand({ type: 'toggleTaskList' })}
  >
    <CheckSquare size={17} />
  </button>
  <div class="table-picker-anchor" use:clickOutside={closeTablePicker}>
    <button
      title="表格"
      aria-haspopup="dialog"
      aria-expanded={tablePickerOpen}
      aria-label="插入表格"
      class:active={tablePickerOpen}
      on:click|stopPropagation={toggleTablePicker}
    >
      <Table2 size={17} />
    </button>
    {#if tablePickerOpen}
      <div
        class="table-picker-popover"
        role="dialog"
        aria-label="选择表格尺寸"
        tabindex="-1"
        on:keydown={handleTablePickerKeydown}
      >
        <div class="table-picker-header">
          <span>表格</span>
          <strong>{previewRows} × {previewColumns}</strong>
        </div>
        <div class="table-picker-grid" aria-label="表格行列">
          {#each tableRows as row}
            {#each tableColumns as column}
              <button
                type="button"
                class="table-picker-cell"
                class:active={row <= previewRows && column <= previewColumns}
                aria-label={`插入 ${row} 行 ${column} 列表格`}
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
    title="代码块"
    aria-label="插入代码块"
    on:click={() => runCommand({ type: 'insertCodeBlock' })}
  >
    <Code2 size={17} />
  </button>
  <button
    title="数学公式"
    aria-label="插入数学公式"
    on:click={() => runCommand({ type: 'insertMathBlock', tex: 'E = mc^2' })}
  >
    <Sigma size={17} />
  </button>
  <div class="diagram-picker-anchor" use:clickOutside={closeDiagramPicker}>
    <button
      title="图表"
      aria-haspopup="menu"
      aria-expanded={diagramPickerOpen}
      aria-label="插入图表"
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
        aria-label="插入图表"
        tabindex="-1"
        on:keydown={handleDiagramPickerKeydown}
      >
        <div class="diagram-picker-header">图表</div>
        {#each DIAGRAM_TEMPLATES as template}
          <button type="button" role="menuitem" on:click={() => insertDiagram(template.type)}>
            <span>{template.label}</span>
            <small>{template.type}</small>
          </button>
        {/each}
      </div>
    {/if}
  </div>
  <button
    title="插入脚注"
    aria-label="插入脚注"
    on:mousedown|preventDefault
    on:click={() => runCommand({ type: 'insertFootnote' })}
  >
    <Superscript size={17} />
  </button>
  <button
    title="插入正文目录"
    aria-label="插入目录"
    on:mousedown|preventDefault
    on:click={() => runCommand({ type: 'insertToc' })}
  >
    <TableOfContents size={17} />
  </button>
  <span class="divider"></span>
  <span class="toolbar-spacer"></span>
  <label class="range-control width-control" title="内容宽度">
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
  <div class="mode-switch" aria-label="编辑模式">
    <button
      title="语义编辑"
      aria-label="切换到语义编辑"
      aria-pressed={mode === 'semantic'}
      class:active={mode === 'semantic'}
      on:click={() => setMode('semantic')}
    >
      <BookOpenText size={17} />
    </button>
    <button
      title="源码模式"
      aria-label="切换到源码模式"
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
    title={outlineVisible ? '隐藏文档大纲' : '显示文档大纲'}
    aria-label={outlineVisible ? '隐藏文档大纲' : '显示文档大纲'}
    aria-pressed={outlineVisible}
    on:click={toggleOutlineVisible}
  >
    <ListTree size={18} />
  </button>
  <button
    class="icon-button"
    title={focusMode ? '显示资源管理器侧边栏' : '隐藏资源管理器侧边栏'}
    aria-label={focusMode ? '显示资源管理器侧边栏' : '隐藏资源管理器侧边栏'}
    aria-pressed={!focusMode}
    on:click={toggleFocusMode}
  >
    {#if focusMode}
      <PanelLeftOpen size={18} />
    {:else}
      <PanelLeftClose size={18} />
    {/if}
  </button>
</div>
