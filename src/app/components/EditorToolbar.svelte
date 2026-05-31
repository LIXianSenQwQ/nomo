<script lang="ts">
  import {
    Bold,
    Braces,
    CheckSquare,
    Code2,
    FolderOpen,
    Heading1,
    Image,
    Italic,
    List,
    PanelRightClose,
    PanelRightOpen,
    Pilcrow,
    Quote,
    Save,
    Sigma,
    Table2
  } from '@lucide/svelte';
  import type { EditorCommand, EditorMode } from '../../lib/editor-core';

  export let mode: EditorMode;
  export let fontSize: number;
  export let lineHeight: number;
  export let contentWidthPercent: number;
  export let outlineVisible: boolean;
  export let openFileDialog: () => void;
  export let saveMarkdownFile: (saveAs?: boolean) => void;
  export let runCommand: (command: EditorCommand) => void;
  export let updateFontSize: (event: Event) => void;
  export let updateLineHeight: (event: Event) => void;
  export let updateContentWidth: (event: Event) => void;
  export let setMode: (mode: EditorMode) => void;
  export let toggleOutlineVisible: () => void;
  export let toggleFocusMode: () => void;
</script>

<div class="toolbar" aria-label="格式工具">
  <button title="打开 Markdown" on:click={openFileDialog}>
    <FolderOpen size={17} />
  </button>
  <button title="导出保存" on:click={() => saveMarkdownFile()}>
    <Save size={17} />
  </button>
  <span class="divider"></span>
  <button title="标题" on:click={() => runCommand({ type: 'setHeading', level: 1 })}>
    <Heading1 size={17} />
  </button>
  <button title="粗体" on:click={() => runCommand({ type: 'toggleBold' })}>
    <Bold size={17} />
  </button>
  <button title="斜体" on:click={() => runCommand({ type: 'toggleItalic' })}>
    <Italic size={17} />
  </button>
  <button title="引用" on:click={() => runCommand({ type: 'toggleBlockquote' })}>
    <Quote size={17} />
  </button>
  <button title="列表" on:click={() => runCommand({ type: 'toggleBulletList' })}>
    <List size={17} />
  </button>
  <button title="任务列表" on:click={() => runCommand({ type: 'toggleTaskList' })}>
    <CheckSquare size={17} />
  </button>
  <button title="表格" on:click={() => runCommand({ type: 'insertTable', rows: 2, columns: 3 })}>
    <Table2 size={17} />
  </button>
  <button title="代码块" on:click={() => runCommand({ type: 'insertCodeBlock', language: 'ts', code: 'console.log(\"NewMd\");' })}>
    <Code2 size={17} />
  </button>
  <button title="数学公式" on:click={() => runCommand({ type: 'insertMathBlock', tex: 'E = mc^2' })}>
    <Sigma size={17} />
  </button>
  <button title="图片" on:click={() => runCommand({ type: 'insertImage', src: './assets/image.png', alt: 'image' })}>
    <Image size={17} />
  </button>
  <button title="Mermaid 占位" on:click={() => runCommand({ type: 'insertMermaidBlock', code: 'flowchart TD\\n  A --> B' })}>
    <Braces size={17} />
  </button>
  <span class="divider"></span>
  <label class="range-control" title="字号">
    <span>{fontSize}px</span>
    <input type="range" min="14" max="22" step="1" value={fontSize} on:input={updateFontSize} />
  </label>
  <label class="range-control" title="行高">
    <span>{lineHeight.toFixed(2)}</span>
    <input type="range" min="1.4" max="2.1" step="0.05" value={lineHeight} on:input={updateLineHeight} />
  </label>
  <label class="range-control width-control" title="内容宽度">
    <span>{contentWidthPercent}%</span>
    <input type="range" min="45" max="90" step="1" value={contentWidthPercent} on:input={updateContentWidth} />
  </label>
  <span class="toolbar-spacer"></span>
  <div class="mode-switch" aria-label="编辑模式">
    <button class:active={mode === 'semantic'} on:click={() => setMode('semantic')}>语义</button>
    <button class:active={mode === 'source'} on:click={() => setMode('source')}>源码</button>
  </div>
  <button
    class="icon-button"
    class:active={outlineVisible}
    title={outlineVisible ? '隐藏文档大纲' : '显示文档大纲'}
    aria-label={outlineVisible ? '隐藏文档大纲' : '显示文档大纲'}
    aria-pressed={outlineVisible}
    on:click={toggleOutlineVisible}
  >
    {#if outlineVisible}
      <PanelRightClose size={18} />
    {:else}
      <PanelRightOpen size={18} />
    {/if}
  </button>
  <button class="icon-button" title="专注模式" on:click={toggleFocusMode}>
    <Pilcrow size={18} />
  </button>
</div>
