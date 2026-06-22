# 阅读位置持久化功能计划

## 摘要

为 Nomo Markdown 编辑器实现跨会话的阅读位置持久化。每个 Markdown 文件在关闭后再次打开时，恢复到上次阅读位置。语义模式和源码模式分别保存阅读位置。支持标签页切换保存、防抖写入、多窗口最后写入者获胜等机制。

## 当前状态分析

### 已有基础

* **大纲滚动定位工具** (`src/app/services/outlineNavigation.ts`): 提供 `OutlineScrollAnchor` 类型、`getSemanticScrollAnchor()` / `getSourceScrollAnchor()` 捕获锚点、`scrollSemanticToAnchor()` / `scrollSourceToAnchor()` 恢复锚点。可直接复用。

* **模式切换锚点恢复** (`src/app/services/editorInteractionController.ts`): 已有 `setMode()` 内保存和恢复滚动位置的逻辑，使用 `scheduleAfterFrames` 等待渲染完成。

* **工作区状态持久化** (`src/app/App.svelte`): 已有 `persistWorkspaceState()` / `flushPersistWorkspaceState()` 将 `WorkspaceState` 保存到 Tauri 后端 config.json。

* **Tab 状态管理** (`src/app/services/tabs.ts`): `writeActiveTabState()` 将活跃标签状态写入 tabs 数组。

### 缺失部分

1. `Tab` 类型和 `ActiveTabState` 中无阅读位置字段。
2. 标签切换时 `loadTabState()` 不保存/恢复滚动位置。
3. 无持久化到磁盘的阅读位置存储机制。
4. 无明确的"渲染完成"回调，需通过 RAF 重试检测。
5. 无跳转意图检测逻辑来跳过阅读位置恢复。

## 提议的变更

### 1. 数据模型扩展

#### 文件: `src/app/types.ts`

**新增** **`ReadingPosition`** **接口:**

```typescript
export interface ReadingPosition {
  /** 语义模式滚动锚点 */
  semanticAnchor: OutlineScrollAnchor | null;
  /** 源码模式滚动锚点 */
  sourceAnchor: OutlineScrollAnchor | null;
  /** 最后更新时间戳，用于多窗口冲突解决 */
  updatedAt: number;
}
```

**修改** **`Tab`** **接口:**

```typescript
export interface Tab {
  // ... 现有字段 ...
  /** 当前文件的阅读位置（按模式分别存储） */
  readingPosition: ReadingPosition;
}
```

**修改** **`WorkspaceState`** **接口:**

添加独立的 `readingPositions` 映射，按标准化 filePath 存储，不依赖 tabId：

```typescript
export interface WorkspaceState {
  tabs: Tab[];
  activeTabId: string;
  currentFolderPath?: string;
  /** 按标准化 filePath 存储的阅读位置映射 */
  readingPositions?: Record<string, ReadingPosition>;
}
```

#### 文件: `src/app/services/tabs.ts`

**修改** **`ActiveTabState`** **接口:**

```typescript
export interface ActiveTabState {
  // ... 现有字段 ...
  readingPosition: ReadingPosition;
}
```

**修改** **`createBlankTab()`:**

初始化空的 `readingPosition`：

```typescript
export function createBlankTab(fileName = 'untitled.md', filePath = t.untitledMarkdown()): Tab {
  return {
    // ... 现有字段 ...
    readingPosition: {
      semanticAnchor: null,
      sourceAnchor: null,
      updatedAt: 0,
    },
  };
}
```

### 2. 阅读位置服务

#### 新建文件: `src/app/services/readingPosition.ts`

职责：阅读位置的内存管理、防抖持久化、多窗口冲突解决、LRU 清理。

```typescript
import type { OutlineScrollAnchor } from './outlineNavigation';
import type { ReadingPosition } from '../types';
import { updateAppSetting, listAppSettings } from '../../lib/desktop/tauriStorage';

const READING_POSITIONS_KEY = 'readingPositions';
const MAX_ENTRIES = 300;
const DEBOUNCE_MS = 1500;

interface ReadingPositionStore {
  /** 内存中的阅读位置映射，key 为标准化后的 filePath */
  positions: Map<string, ReadingPosition>;
  /** 防抖定时器 */
  debounceTimer: number | null;
  /** 是否正在写入 */
  isWriting: boolean;
}

const store: ReadingPositionStore = {
  positions: new Map(),
  debounceTimer: null,
  isWriting: false,
};

/** 标准化 filePath 作为存储 key */
function normalizeFilePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase();
}

/** 从后端配置加载阅读位置 */
export async function loadReadingPositions(): Promise<Map<string, ReadingPosition>> {
  try {
    const settings = await listAppSettings();
    const setting = settings.find((s) => s.key === READING_POSITIONS_KEY);
    if (!setting) return new Map();
    const record = JSON.parse(setting.valueJson) as Record<string, ReadingPosition>;
    const map = new Map<string, ReadingPosition>();
    for (const [key, value] of Object.entries(record)) {
      if (isValidReadingPosition(value)) {
        map.set(key, value);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

/** 保存阅读位置到内存（防抖写入） */
export function saveReadingPositionToMemory(
  filePath: string,
  semanticAnchor: OutlineScrollAnchor | null,
  sourceAnchor: OutlineScrollAnchor | null,
): void {
  const key = normalizeFilePath(filePath);
  const existing = store.positions.get(key);
  const updatedAt = Date.now();

  // 多窗口场景：如果内存中的记录比当前新，不覆盖
  if (existing && existing.updatedAt > updatedAt) {
    return;
  }

  store.positions.set(key, {
    semanticAnchor,
    sourceAnchor,
    updatedAt,
  });

  schedulePersist();
}

/** 立即强制保存（用于切换标签页、关闭窗口等场景） */
export function flushReadingPositions(): Promise<void> {
  return persistReadingPositions();
}

/** 获取阅读位置 */
export function getReadingPosition(filePath: string): ReadingPosition | undefined {
  return store.positions.get(normalizeFilePath(filePath));
}

/** 防抖调度持久化 */
function schedulePersist(): void {
  if (store.debounceTimer !== null) {
    window.clearTimeout(store.debounceTimer);
  }
  store.debounceTimer = window.setTimeout(() => {
    store.debounceTimer = null;
    persistReadingPositions();
  }, DEBOUNCE_MS);
}

/** 实际持久化到后端配置 */
async function persistReadingPositions(): Promise<void> {
  if (store.isWriting) return;
  store.isWriting = true;

  try {
    // 读取后端现有数据，进行最后写入者获胜的合并
    const existing = await loadReadingPositions();
    const merged = mergeReadingPositions(existing, store.positions);
    const trimmed = trimToRecentEntries(merged, MAX_ENTRIES);
    const record = Object.fromEntries(trimmed.entries());
    await updateAppSetting(READING_POSITIONS_KEY, record);
    store.positions = trimmed;
  } catch {
    // 忽略持久化失败
  } finally {
    store.isWriting = false;
  }
}

/** 合并两个阅读位置映射，按 updatedAt 解决冲突 */
function mergeReadingPositions(
  existing: Map<string, ReadingPosition>,
  memory: Map<string, ReadingPosition>,
): Map<string, ReadingPosition> {
  const merged = new Map(existing);
  for (const [key, value] of memory.entries()) {
    const existingValue = merged.get(key);
    if (!existingValue || value.updatedAt >= existingValue.updatedAt) {
      merged.set(key, value);
    }
  }
  return merged;
}

/** 按 updatedAt 排序，只保留最近 N 条 */
function trimToRecentEntries(
  map: Map<string, ReadingPosition>,
  limit: number,
): Map<string, ReadingPosition> {
  if (map.size <= limit) return new Map(map);
  const entries = Array.from(map.entries());
  entries.sort((a, b) => b[1].updatedAt - a[1].updatedAt);
  return new Map(entries.slice(0, limit));
}

function isValidReadingPosition(value: unknown): value is ReadingPosition {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<ReadingPosition>;
  return typeof v.updatedAt === 'number';
}
```

### 3. 滚动位置捕获与恢复

#### 文件: `src/app/App.svelte`

**A. 在** **`saveActiveTabState()`** **中捕获阅读位置:**

```typescript
function saveActiveTabState() {
  if (!activeTabId) return;

  // 捕获当前阅读位置
  const semanticPane = semanticPane; // 已有变量
  const sourcePane = sourcePane; // 已有变量
  const currentOutline = outline; // 已有变量

  let semanticAnchor: OutlineScrollAnchor | null = null;
  let sourceAnchor: OutlineScrollAnchor | null = null;

  if (semanticPane) {
    semanticAnchor = getSemanticScrollAnchor(currentOutline, semanticPane, semanticPane.scrollTop);
  }
  if (sourcePane) {
    const lineHeight = getSourceLineHeight(sourceTextarea);
    sourceAnchor = getSourceScrollAnchor(currentOutline, sourcePane.scrollTop, lineHeight, sourceTextarea, sourcePane);
  }

  // 保存到当前 Tab
  const activeTab = tabs.find((t) => t.id === activeTabId);
  if (activeTab) {
    activeTab.readingPosition = {
      semanticAnchor,
      sourceAnchor,
      updatedAt: Date.now(),
    };
    // 同时持久化到全局存储
    if (activeTab.filePath) {
      saveReadingPositionToMemory(activeTab.filePath, semanticAnchor, sourceAnchor);
    }
  }

  tabs = writeActiveTabState(tabs, activeTabId, {
    markdown,
    savedMarkdown,
    dirty,
    version,
    fileName,
    filePath,
    nativePath,
    largeDocumentMode,
    readonlyDocumentMode,
    externalFileChange,
    lastKnownModifiedAt,
    readingPosition: activeTab?.readingPosition ?? {
      semanticAnchor: null,
      sourceAnchor: null,
      updatedAt: 0,
    },
  });
  persistWorkspaceState();
}
```

**B. 在** **`loadTabState()`** **中恢复阅读位置:**

修改 `loadTabState()`，在 `editor.setMarkdown()` 完成后异步恢复阅读位置：

```typescript
function loadTabState(tab: Tab) {
  isSwitchingTab = true;
  try {
    // ... 现有字段恢复逻辑 ...

    if (editor) {
      const nextMode = largeDocumentMode ? 'source' : mode;
      editor.updateOptions({
        readonly: readonlyDocumentMode,
        mode: nextMode,
      });
      mode = nextMode;
      editor.setMarkdown(markdown, {
        reason: 'switch-tab',
        dirty: tab.dirty,
        savedMarkdown,
      });
    }

    // ... 现有大纲分析逻辑 ...

    // 恢复阅读位置（延迟到渲染完成后）
    const shouldRestorePosition = !hasExplicitJumpIntent();
    if (shouldRestorePosition) {
      scheduleRestoreReadingPosition(tab, mode);
    }
  } finally {
    isSwitchingTab = false;
  }
}
```

**C. 新增** **`scheduleRestoreReadingPosition()`:**

```typescript
function scheduleRestoreReadingPosition(tab: Tab, targetMode: EditorMode, attempts = 120) {
  const semanticPane = semanticPane;
  const sourcePane = sourcePane;
  const currentOutline = outline;

  if (targetMode === 'semantic' && semanticPane) {
    // 语义模式：等待 ProseMirror DOM 渲染完成
    const anchor = tab.readingPosition?.semanticAnchor;
    if (!anchor) return;

    const tryRestore = () => {
      const headingAnchors = getSemanticHeadingAnchors(semanticPane, currentOutline);
      const maxScroll = getMaxScrollTop(semanticPane);

      if (headingAnchors.length > 0 || maxScroll > 0 || attempts <= 0) {
        scrollSemanticToAnchor(currentOutline, semanticPane, anchor);
        return;
      }
      requestAnimationFrame(() => scheduleRestoreReadingPosition(tab, targetMode, attempts - 1));
    };
    requestAnimationFrame(tryRestore);
  } else if (targetMode === 'source' && sourcePane) {
    // 源码模式：等待 textarea 布局完成
    const anchor = tab.readingPosition?.sourceAnchor;
    if (!anchor) return;

    const tryRestore = () => {
      const maxScroll = getMaxScrollTop(sourcePane);
      if (maxScroll > 0 || attempts <= 0) {
        scrollSourceToAnchor(currentOutline, sourcePane, sourceTextarea, anchor);
        return;
      }
      requestAnimationFrame(() => scheduleRestoreReadingPosition(tab, targetMode, attempts - 1));
    };
    requestAnimationFrame(tryRestore);
  }
}
```

**D. 新增** **`hasExplicitJumpIntent()`:**

```typescript
let lastSetMarkdownReason = '';

function hasExplicitJumpIntent(): boolean {
  const jumpReasons = [
    'search-jump',
    'outline-jump',
    'line-jump',
    'goto-line',
    'preview-open',
  ];
  return jumpReasons.includes(lastSetMarkdownReason);
}
```

在 `syncFromEditor()` 中记录 reason：

```typescript
function syncFromEditor(event: EditorChangeEvent) {
  lastSetMarkdownReason = event.reason;
  // ... 现有逻辑 ...
}
```

**E. 在标签切换和关闭时强制保存:**

修改 `switchTab()`：

```typescript
function switchTab(tabId: string) {
  if (!tabId || activeTabId === tabId) return;
  saveActiveTabState(); // 保存当前标签阅读位置
  // ... 现有逻辑 ...
}
```

修改 `closeTab()`：

```typescript
async function closeTab(tabId: string, event?: Event) {
  // 关闭前保存阅读位置
  if (activeTabId === tabId) {
    saveActiveTabState();
  }
  // ... 现有逻辑 ...
}
```

**F. 在窗口关闭和应用退出时强制刷新:**

在 `closeCurrentWindow()` 和 `requestExitApp()` 中调用 `flushReadingPositions()`：

```typescript
async function closeCurrentWindow() {
  // ... 现有逻辑 ...
  flushPersistWorkspaceState();
  await flushReadingPositions(); // 新增
  // ... 现有逻辑 ...
}

async function requestExitApp() {
  // ... 现有逻辑 ...
  flushPersistWorkspaceState();
  await flushReadingPositions(); // 新增
  // ... 现有逻辑 ...
}
```

**G. 在** **`onMount`** **中加载阅读位置:**

```typescript
onMount(async () => {
  // ... 现有逻辑 ...
  if (desktopEnabled) {
    // 加载持久化的阅读位置到内存
    const loadedPositions = await loadReadingPositions();
    for (const [key, value] of loadedPositions.entries()) {
      // 合并到对应 Tab 中
      const matchingTab = tabs.find((t) => normalizeFilePath(t.filePath) === key);
      if (matchingTab) {
        matchingTab.readingPosition = value;
      }
    }
  }
  // ... 现有逻辑 ...
});
```

**H. 在** **`onDestroy`** **中强制保存:**

```typescript
onDestroy(() => {
  flushPersistWorkspaceState();
  flushReadingPositions(); // 新增
  // ... 现有清理逻辑 ...
});
```

### 4. 编辑器核心 reason 扩展

#### 文件: `src/lib/editor-core/types.ts`

**修改** **`SetMarkdownOptions`:**

```typescript
export interface SetMarkdownOptions {
  reason?:
    | 'programmatic-update'
    | 'source-input'
    | 'open-file'
    | 'save-file'
    | 'switch-tab'
    | 'restore-snapshot'
    | 'search-jump'      // 新增：搜索跳转
    | 'outline-jump'     // 新增：大纲跳转
    | 'line-jump'        // 新增：行号跳转
    | 'goto-line';       // 新增：跳转到行
  dirty?: boolean;
  savedMarkdown?: string;
}
```

### 5. 调用方传入跳转 reason

#### 文件: `src/app/services/outlineInteractionController.ts`

在大纲点击跳转时传入 `outline-jump` reason：

```typescript
// 在 jumpToOutlineItem 中，调用 editor.setMarkdown 时传入 reason: 'outline-jump'
```

#### 文件: `src/app/services/searchReplace.ts`

在搜索结果跳转时传入 `search-jump` reason：

```typescript
// 在 selectActiveSearchMatch 中，调用 editor.setMarkdown 或相关跳转时传入 reason: 'search-jump'
```

#### 文件: `src/app/App.svelte`

在 `selectSourceSearchMatch()` 中传入 `search-jump`：

```typescript
async function selectSourceSearchMatch(match: EditorSearchMatch, focusEditor = true) {
  // ... 现有逻辑 ...
  // 此处是源码模式下的搜索匹配跳转，需要标记为 search-jump
  lastSetMarkdownReason = 'search-jump';
  // ... 现有逻辑 ...
}
```

### 6. 滚动事件监听

#### 文件: `src/app/components/EditorWorkspace.svelte`

在 `sourcePane` 和 `semanticPane` 的 scroll 事件中，只更新内存，不立即持久化：

已有 `on:scroll` 事件绑定到 `updateActiveOutlineFromSourceScroll` 和 `updateActiveOutlineFromSemanticScroll`。需要在 App.svelte 中额外处理滚动时的阅读位置更新：

```typescript
// App.svelte 中新增滚动处理
let scrollDebounceTimer: number | null = null;

function handleSemanticScroll() {
  if (scrollDebounceTimer !== null) {
    window.clearTimeout(scrollDebounceTimer);
  }
  scrollDebounceTimer = window.setTimeout(() => {
    scrollDebounceTimer = null;
    saveActiveTabState();
  }, 1500);
}

function handleSourceScroll() {
  if (scrollDebounceTimer !== null) {
    window.clearTimeout(scrollDebounceTimer);
  }
  scrollDebounceTimer = window.setTimeout(() => {
    scrollDebounceTimer = null;
    saveActiveTabState();
  }, 1500);
}
```

将这两个 handler 通过 props 传递给 `EditorWorkspace.svelte`，或在 `EditorWorkspace.svelte` 中直接触发父组件的保存逻辑。

更简洁的方式：在 `EditorWorkspace.svelte` 的 scroll 事件中，通过 dispatch 自定义事件通知父组件：

```svelte
<!-- EditorWorkspace.svelte -->
<section
  bind:this={sourcePane}
  class="editor-pane source-pane"
  on:scroll={() => {
    updateActiveOutlineFromSourceScroll();
    dispatch('sourceScroll');
  }}
>

<section
  bind:this={semanticPane}
  class="semantic-pane"
  on:scroll={() => {
    updateActiveOutlineFromSemanticScroll();
    dispatch('semanticScroll');
  }}
>
```

App.svelte 中监听：

```svelte
<EditorWorkspace
  ...
  on:sourceScroll={handleSourceScroll}
  on:semanticScroll={handleSemanticScroll}
/>
```

### 7. 导出新增接口

#### 文件: `src/lib/editor-core/index.ts`

确保 `OutlineScrollAnchor` 类型被正确导出（如果尚未导出）。

#### 文件: `src/app/services/outlineNavigation.ts`

确保以下函数被导出：

* `getSemanticScrollAnchor`

* `getSourceScrollAnchor`

* `scrollSemanticToAnchor`

* `scrollSourceToAnchor`

* `getSemanticHeadingAnchors` (内部使用，可保持不导出)

* `getMaxScrollTop` (新增导出)

### 8. 测试策略

#### 单元测试: `src/app/services/readingPosition.test.ts`

* `normalizeFilePath()` 的路径标准化逻辑

* `mergeReadingPositions()` 的冲突解决逻辑

* `trimToRecentEntries()` 的 LRU 清理逻辑

* `isValidReadingPosition()` 的校验逻辑

#### 集成测试: `src/app/App.readingPosition.test.ts` (新建)

* 打开文件后滚动，关闭再打开是否恢复位置

* 模式切换后分别保存不同位置

* 标签页切换后位置是否正确保存

* 明确跳转意图时是否跳过恢复

* 多窗口场景下最后写入者获胜

## 假设与决策

1. **持久化存储**: 使用 Tauri 后端 `config.json`，key 为 `readingPositions`。支持多窗口最后写入者获胜。
2. **跳转意图检测**: 通过 `setMarkdown` 的 `reason` 字段判断。需要修改所有明确跳转的调用方传入特定 reason。
3. **渲染完成检测**: 使用 `requestAnimationFrame` 重试（最多 120 次），检测 `scrollHeight > 0` 或标题锚点存在。
4. **锚点优先策略**: 恢复时优先使用 `OutlineScrollAnchor`（基于大纲标题 + 段落进度），锚点失效时回退到 `documentProgress`（已由 `outlineNavigation.ts` 支持）。
5. **数量限制**: 最多保留 300 个文件的阅读位置，按 `updatedAt` 排序清理旧记录。
6. **标准化路径**: 使用 `replace(/\\/g, '/').replace(/\/$/, '').toLowerCase()` 标准化路径作为存储 key。
7. **防抖延迟**: 滚动停止后 1500ms 防抖写入；切换标签页、关闭窗口时立即强制保存。

## 验证步骤

1. 打开一个 Markdown 文件，滚动到中间位置。
2. 切换到另一个标签页，再切回原标签页，确认位置保持。
3. 关闭文件，重新打开，确认恢复到上次阅读位置。
4. 在语义模式和源码模式分别滚动到不同位置，切换模式确认各自独立保存。
5. 使用大纲跳转或搜索跳转，确认不恢复阅读位置。
6. 打开多个窗口，在不同窗口中滚动同一文件，确认最后写入者获胜。
7. 检查 config.json 中 `readingPositions` 字段是否正确存储。
8. 运行 `npm run test` 确保所有测试通过。

