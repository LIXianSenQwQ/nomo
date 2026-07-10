<script lang="ts">
  import type { RecentEntry } from '../../lib/desktop/tauriStorage';
  import type { EditorCommand, EditorMode, InlinePendingMarks } from '../../lib/editor-core';
  import type { FrontMatterBlock } from '../../lib/markdown/frontMatter';
  import type { DocumentStats, OutlineItem } from '../../lib/outline/outlineService';
  import type { ExternalFileChangeState, FileTreeNode, Tab } from '../types';
  import AppTitleBar from './AppTitleBar.svelte';
  import DocumentTabs from './DocumentTabs.svelte';
  import EmptyWorkspace from './EmptyWorkspace.svelte';
  import EditorToolbar from './EditorToolbar.svelte';
  import EditorWorkspace from './EditorWorkspace.svelte';
  import ExplorerSidebar from './ExplorerSidebar.svelte';
  import LinkQuickEditor from './LinkQuickEditor.svelte';
  import SearchReplacePanel from './SearchReplacePanel.svelte';
  import StatusBar from './StatusBar.svelte';
  import SegmentedTextEditorWorkspace from './SegmentedTextEditorWorkspace.svelte';
  import { workspaceSidebarMotion } from '../actions/motion';
  import { t } from '../i18n';

  type StatsMetric = 'lines' | 'words' | 'chars';
  type AppBootState = 'booting' | 'restoring-workspace' | 'opening-file' | 'ready';

  export let interfaceLocale: string;
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
  export let recentFiles: RecentEntry[];
  export let missingRecentPaths: Set<string>;
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
  export let previewTabId: string | null;
  export let markdown: string;
  export let largeDocumentMode: boolean;
  export let frontMatter: FrontMatterBlock | null;
  export let frontMatterEditing: boolean;
  export let frontMatterFocusRequest: number;
  export let frontMatterFocusTarget: 'default' | 'title-value';
  export let readonlyDocumentMode: boolean;
  export let outline: OutlineItem[];
  export let activeOutlineId: string;
  export let collapsedOutlineIds: Set<string>;
  export let visibleOutlineIds: Set<string>;
  export let stats: DocumentStats;
  export let writingStatsVisible: boolean;
  export let writingStatsMetric: StatsMetric;
  export let readingTimeVisible: boolean;
  export let zoomPercent: number;
  export let tablePickerOpen: boolean;
  export let linkPickerOpen: boolean;
  export let linkText: string;
  export let linkHref: string;
  export let linkError: string;
  export let linkCanRemove: boolean;
  export let linkPickerPositionStyle: string;
  export let searchPanelOpen: boolean;
  export let searchReplaceVisible: boolean;
  export let searchQuery: string;
  export let searchReplacement: string;
  export let searchCaseSensitive: boolean;
  export let searchActiveIndex: number;
  export let searchMatchCount: number;
  export let autoSaveEnabled: boolean;
  export let autoSaveDelayMs: number;
  export let segmentedWorkspace: SegmentedTextEditorWorkspace | null = null;

  export let getCompactPath: (path: string) => string;
  export let getFolderName: (path: string) => string;
  export let getDirectoryLabel: (path: string) => string;
  export let toggleMenu: (menu: string) => void;
  export let closeMenu: (menu: string) => void;
  export let toggleTheme: () => void;
  export let minimizeWindow: () => void;
  export let maximizeWindow: () => void;
  export let closeAppWindow: () => void;
  export let exitApp: () => void;
  export let createNewWindow: () => void;
  export let createNewFile: () => void;
  export let openFileDialog: () => void;
  export let openFolderDialog: () => void;
  export let openRecentEntry: (path: string, entryType: 'file' | 'folder') => void;
  export let openPreviewFile: (path: string) => void;
  export let pinPreviewFile: () => void;
  export let clearRecentEntriesList: () => void;
  export let removeRecentEntry: (path: string) => void;
  export let closeCurrentFile: () => void;
  export let closeCurrentWindow: () => void;
  export let saveMarkdownFile: (saveAs?: boolean) => void;
  export let runCommand: (command: EditorCommand) => void;
  export let pendingInlineMarks: InlinePendingMarks;
  export let openTablePicker: () => void;
  export let openLinkPicker: () => void;
  export let openSearchPanel: (replaceVisible?: boolean) => void;
  export let closeSearchPanel: () => void;
  export let updateSearchQuery: (event: Event) => void;
  export let updateSearchReplacement: (event: Event) => void;
  export let toggleSearchCaseSensitive: () => void;
  export let toggleSearchReplaceVisible: () => void;
  export let findPreviousSearchMatch: () => void;
  export let findNextSearchMatch: () => void;
  export let replaceCurrentSearchMatch: () => void;
  export let replaceAllSearchMatches: () => void;
  export let editFrontMatter: () => void;
  export let showUnavailableFeature: (featureName: string) => void;
  export let closeTablePicker: () => void;
  export let closeLinkPicker: () => void;
  export let updateLinkText: (event: Event) => void;
  export let updateLinkHref: (event: Event) => void;
  export let applyLink: () => void;
  export let removeLink: () => void;
  export let insertTableWithSize: (rows: number, columns: number) => void;
  export let openSettings: () => void;
  export let setMode: (mode: EditorMode) => void;
  export let toggleOutlineVisible: () => void;
  export let toggleFocusMode: () => void;
  export let toggleRootFolder: () => void;
  export let toggleFolderCollapse: (folderPath: string) => void;
  export let startResize: (event: MouseEvent) => void;
  export let exportHtml: () => void;
  export let exportPdf: () => void;
  export let switchTab: (tabId: string) => void;
  export let closeTab: (tabId: string, event?: Event) => void;
  export let pinPreviewTab: () => void;
  export let updateContentWidth: (event: Event) => void;
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
  export let setWritingStatsMetric: (metric: StatsMetric) => void;
  export let onZoomChange: (percent: number) => void;
  export let appBootState: AppBootState;
  export let onSourceScroll: (() => void) | undefined = undefined;
  export let onSemanticScroll: (() => void) | undefined = undefined;

  $: hasOpenDocument = appBootState === 'ready' && tabs.length > 0 && Boolean(activeTabId);
  $: activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;
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
    accept=".md,.markdown,text/markdown"
    on:change={openMarkdownFile}
  />

  {#if desktopEnabled}
    <AppTitleBar
      {interfaceLocale}
      {theme}
      {desktopEnabled}
      {activeMenu}
      {recentFiles}
      {missingRecentPaths}
      {mode}
      {focusMode}
      {outlineVisible}
      {getCompactPath}
      {toggleMenu}
      {closeMenu}
      {toggleTheme}
      {minimizeWindow}
      {maximizeWindow}
      {closeAppWindow}
      {exitApp}
      {createNewWindow}
      {createNewFile}
      {openFileDialog}
      {openFolderDialog}
      {openRecentEntry}
      {saveMarkdownFile}
      {clearRecentEntriesList}
      {removeRecentEntry}
      {closeCurrentFile}
      {closeCurrentWindow}
      {runCommand}
      {openTablePicker}
      {openLinkPicker}
      {editFrontMatter}
      {showUnavailableFeature}
      {setMode}
      {toggleOutlineVisible}
      {toggleFocusMode}
      {openSettings}
      {exportHtml}
      {exportPdf}
    />
  {/if}

  <main
    class="workspace"
    style="--sidebar-width: {sidebarWidth}px"
    use:workspaceSidebarMotion={{ focusMode, isResizing }}
  >
    <ExplorerSidebar
      {interfaceLocale}
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
      {openPreviewFile}
      {pinPreviewFile}
      previewNativePath={previewTabId
        ? (tabs.find((t) => t.id === previewTabId)?.nativePath ?? null)
        : null}
      {startResize}
      on:createNode
      on:renameNode
      on:refreshFolder
      on:collapseAll
      on:deleteNode
    />

    <section
      class="editor-shell"
      class:no-open-document={appBootState === 'ready' && !hasOpenDocument}
      aria-label={t.semanticEditorArea()}
    >
      {#if appBootState !== 'ready'}
        <div class="startup-loading" role="status" aria-live="polite">
          <span>正在恢复工作区...</span>
        </div>
      {:else if hasOpenDocument}
        <DocumentTabs
          {interfaceLocale}
          {tabs}
          {activeTabId}
          {previewTabId}
          {switchTab}
          {closeTab}
          {pinPreviewTab}
          {createNewFile}
          {currentFolderPath}
          on:closeOtherTabs
          on:closeTabsToRight
          on:closeAllTabs
        />

        {#if activeTab?.documentKind === 'markdown'}
          <EditorToolbar
            {interfaceLocale}
            {mode}
            {contentWidthPercent}
            {outlineVisible}
            {runCommand}
            {pendingInlineMarks}
            {tablePickerOpen}
            {openTablePicker}
            {closeTablePicker}
            {openLinkPicker}
            {insertTableWithSize}
            {updateContentWidth}
            {setMode}
            {toggleOutlineVisible}
            openSearchPanel={() => openSearchPanel(false)}
          />

          <div data-search-panel>
            <SearchReplacePanel
              {interfaceLocale}
              open={searchPanelOpen}
              replaceVisible={searchReplaceVisible}
              query={searchQuery}
              replacement={searchReplacement}
              caseSensitive={searchCaseSensitive}
              activeIndex={searchActiveIndex}
              matchCount={searchMatchCount}
              readonly={readonlyDocumentMode}
              updateQuery={updateSearchQuery}
              updateReplacement={updateSearchReplacement}
              toggleCaseSensitive={toggleSearchCaseSensitive}
              toggleReplaceVisible={toggleSearchReplaceVisible}
              findPrevious={findPreviousSearchMatch}
              findNext={findNextSearchMatch}
              replaceCurrent={replaceCurrentSearchMatch}
              replaceAll={replaceAllSearchMatches}
              close={closeSearchPanel}
            />
          </div>

          <EditorWorkspace
            {interfaceLocale}
            bind:sourcePane
            bind:semanticPane
            bind:sourceTextarea
            bind:editorHost
            {mode}
            {markdown}
            {largeDocumentMode}
            {frontMatter}
            {frontMatterEditing}
            {frontMatterFocusRequest}
            {frontMatterFocusTarget}
            {readonlyDocumentMode}
            {outlineVisible}
            {outline}
            {activeOutlineId}
            {collapsedOutlineIds}
            {visibleOutlineIds}
            {updateMarkdown}
            {enterFrontMatterEdit}
            {leaveFrontMatterEdit}
            {updateFrontMatterContent}
            {deleteFrontMatter}
            {updateActiveOutlineFromSourceScroll}
            {updateActiveOutlineFromSemanticScroll}
            {onSourceScroll}
            {onSemanticScroll}
            {handleEditorPaste}
            {handleEditorDrop}
            {isOutlineItemExpandable}
            {toggleOutlineItemExpanded}
            {jumpToOutlineItem}
          />

          <LinkQuickEditor
            {interfaceLocale}
            open={linkPickerOpen}
            text={linkText}
            href={linkHref}
            error={linkError}
            canRemove={linkCanRemove}
            positionStyle={linkPickerPositionStyle}
            updateText={updateLinkText}
            updateHref={updateLinkHref}
            {applyLink}
            {removeLink}
            {closeLinkPicker}
          />
        {:else if activeTab?.documentKind === 'text' || activeTab?.documentKind === 'json'}
          {#key activeTab.sessionId}
            <SegmentedTextEditorWorkspace
              bind:this={segmentedWorkspace}
              {interfaceLocale}
              tab={activeTab}
              {autoSaveEnabled}
              {autoSaveDelayMs}
              on:stateChange
              on:status
            />
          {/key}
        {/if}
      {:else}
        <EmptyWorkspace {interfaceLocale} {createNewFile} {openFileDialog} {openFolderDialog} />
      {/if}
    </section>

    {#if hasOpenDocument && activeTab?.documentKind === 'markdown' && writingStatsVisible}
      <StatusBar
        {interfaceLocale}
        {stats}
        activeMetric={writingStatsMetric}
        {readingTimeVisible}
        {zoomPercent}
        onMetricChange={setWritingStatsMetric}
        {onZoomChange}
      />
    {/if}
  </main>
</div>

<style>
  .startup-loading {
    grid-row: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
    color: var(--md-editor-muted-fg);
    font-size: 14px;
    user-select: none;
    -webkit-user-select: none;
  }
</style>
