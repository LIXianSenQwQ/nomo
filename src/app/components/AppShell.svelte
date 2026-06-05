<script lang="ts">
  import type { RecentDocument } from '../../lib/desktop/tauriStorage';
  import type { EditorCommand, EditorMode, InlinePendingMarks } from '../../lib/editor-core';
  import type { FrontMatterBlock } from '../../lib/markdown/frontMatter';
  import type { DocumentStats, OutlineItem } from '../../lib/outline/outlineService';
  import type { FileTreeNode, Tab } from '../types';
  import AppTitleBar from './AppTitleBar.svelte';
  import DocumentTabs from './DocumentTabs.svelte';
  import EditorToolbar from './EditorToolbar.svelte';
  import EditorWorkspace from './EditorWorkspace.svelte';
  import ExplorerSidebar from './ExplorerSidebar.svelte';
  import StatusBar from './StatusBar.svelte';

  export let focusMode: boolean;
  export let isResizing: boolean;
  export let contentWidthPercent: number;
  export let fileInput: HTMLInputElement;
  export let sourcePane: HTMLElement;
  export let semanticPane: HTMLElement;
  export let sourceTextarea: HTMLTextAreaElement;
  export let editorHost: HTMLDivElement;
  export let theme: 'light' | 'dark';
  export let desktopEnabled: boolean;
  export let activeMenu: string | null;
  export let recentFiles: RecentDocument[];
  export let mode: EditorMode;
  export let outlineVisible: boolean;
  export let currentFolderPath: string;
  export let rootFolderExpanded: boolean;
  export let folderTree: FileTreeNode[];
  export let expandedFolders: Set<string>;
  export let nativePath: string | null;
  export let dirty: boolean;
  export let fileName: string;
  export let filePath: string;
  export let sidebarWidth: number;
  export let tabs: Tab[];
  export let activeTabId: string;
  export let fontSize: number;
  export let lineHeight: number;
  export let blockStyle: 'classic' | 'modern';
  export let markdown: string;
  export let frontMatter: FrontMatterBlock | null;
  export let frontMatterEditing: boolean;
  export let readonlyDocumentMode: boolean;
  export let externalFileWarning: string;
  export let outline: OutlineItem[];
  export let activeOutlineId: string;
  export let collapsedOutlineIds: Set<string>;
  export let visibleOutlineIds: Set<string>;
  export let statusMessage: string;
  export let version: number;
  export let stats: DocumentStats;
  export let tablePickerOpen: boolean;

  export let getCompactPath: (path: string) => string;
  export let getFolderName: (path: string) => string;
  export let getDirectoryLabel: (path: string) => string;
  export let toggleMenu: (menu: string) => void;
  export let closeMenu: (menu: string) => void;
  export let toggleTheme: () => void;
  export let minimizeWindow: () => void;
  export let maximizeWindow: () => void;
  export let closeAppWindow: () => void;
  export let createNewWindow: () => void;
  export let createNewFile: () => void;
  export let openFileDialog: () => void;
  export let openFolderDialog: () => void;
  export let openRecentFile: (path: string) => void;
  export let saveMarkdownFile: (saveAs?: boolean) => void;
  export let runCommand: (command: EditorCommand) => void;
  export let pendingInlineMarks: InlinePendingMarks;
  export let openTablePicker: () => void;
  export let editFrontMatter: () => void;
  export let showUnavailableFeature: (featureName: string) => void;
  export let closeTablePicker: () => void;
  export let insertTableWithSize: (rows: number, columns: number) => void;
  export let openSettings: () => void;
  export let setMode: (mode: EditorMode) => void;
  export let toggleOutlineVisible: () => void;
  export let toggleFocusMode: () => void;
  export let toggleRootFolder: () => void;
  export let toggleFolderCollapse: (folderPath: string) => void;
  export let startResize: (event: MouseEvent) => void;
  export let switchTab: (tabId: string) => void;
  export let closeTab: (tabId: string, event?: Event) => void;
  export let updateFontSize: (event: Event) => void;
  export let updateLineHeight: (event: Event) => void;
  export let updateContentWidth: (event: Event) => void;
  export let updateBlockStyle: (blockStyle: 'classic' | 'modern') => void;
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
  export let openMarkdownFile: (event: Event) => void;
</script>

<div
  class="app-layout"
  class:focus-mode={focusMode}
  class:resizing={isResizing}
  style={`--md-editor-content-width-percent: ${contentWidthPercent}`}
>
  <input
    bind:this={fileInput}
    class="file-input"
    type="file"
    accept=".md,.markdown,text/markdown,text/plain"
    on:change={openMarkdownFile}
  />

  <AppTitleBar
    {theme}
    {desktopEnabled}
    {activeMenu}
    {recentFiles}
    {mode}
    {outlineVisible}
    {getCompactPath}
    {toggleMenu}
    {closeMenu}
    {toggleTheme}
    {minimizeWindow}
    {maximizeWindow}
    {closeAppWindow}
    {createNewWindow}
    {createNewFile}
    {openFileDialog}
    {openFolderDialog}
    {openRecentFile}
    {saveMarkdownFile}
    {runCommand}
    {openTablePicker}
    {editFrontMatter}
    {showUnavailableFeature}
    {setMode}
    {toggleOutlineVisible}
    {toggleFocusMode}
    {openSettings}
  />

  <main class="workspace" style="--sidebar-width: {sidebarWidth}px">
    <ExplorerSidebar
      {currentFolderPath}
      {rootFolderExpanded}
      {folderTree}
      {expandedFolders}
      {nativePath}
      {dirty}
      {fileName}
      {filePath}
      {isResizing}
      {getFolderName}
      {getDirectoryLabel}
      {toggleRootFolder}
      {toggleFolderCollapse}
      {openRecentFile}
      {startResize}
      on:createNode
      on:renameNode
    />

    <section class="editor-shell" aria-label="编辑器">
      <DocumentTabs {tabs} {activeTabId} {switchTab} {closeTab} {createNewFile} />

      <EditorToolbar
        {mode}
        {fontSize}
        {lineHeight}
        {contentWidthPercent}
        {blockStyle}
        {outlineVisible}
        {openFileDialog}
        {saveMarkdownFile}
        {runCommand}
        {pendingInlineMarks}
        {tablePickerOpen}
        {openTablePicker}
        {closeTablePicker}
        {insertTableWithSize}
        {updateFontSize}
        {updateLineHeight}
        {updateContentWidth}
        {updateBlockStyle}
        {setMode}
        {toggleOutlineVisible}
        {toggleFocusMode}
      />

      <EditorWorkspace
        bind:sourcePane
        bind:semanticPane
        bind:sourceTextarea
        bind:editorHost
        {mode}
        {markdown}
        {frontMatter}
        {frontMatterEditing}
        {readonlyDocumentMode}
        {externalFileWarning}
        {outlineVisible}
        {outline}
        {activeOutlineId}
        {collapsedOutlineIds}
        {visibleOutlineIds}
        {saveMarkdownFile}
        {updateMarkdown}
        {enterFrontMatterEdit}
        {leaveFrontMatterEdit}
        {updateFrontMatterContent}
        {deleteFrontMatter}
        {updateActiveOutlineFromSourceScroll}
        {updateActiveOutlineFromSemanticScroll}
        {handleEditorPaste}
        {handleEditorDrop}
        {isOutlineItemExpandable}
        {toggleOutlineItemExpanded}
        {jumpToOutlineItem}
      />

      <StatusBar {dirty} {statusMessage} {version} {stats} {mode} {readonlyDocumentMode} />
    </section>
  </main>
</div>
