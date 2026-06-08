<script lang="ts">
  import {
    BarChart3,
    BookOpenText,
    Code2,
    FileImage,
    FolderOpen,
    Info,
    MonitorCog,
    Palette,
    Settings2,
    SlidersHorizontal,
    X,
  } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import { DIAGRAM_TEMPLATES } from '../../lib/editor-core/diagramTemplates';
  import { isTauriRuntime } from '../../lib/desktop/tauriStorage';
  import packageInfo from '../../../package.json';
  import {
    DEFAULT_APP_PREFERENCES,
    SETTINGS_UPDATED_EVENT,
    applyBlockStyleSetting,
    applyEditorLayoutSettings,
    applyThemeSetting,
    applyTypographySettings,
    loadAppPreferences,
    normalizeAppPreferences,
    saveAppPreferences,
    type AppPreferences,
    type BlockStylePreference,
    type EditorModePreference,
    type FolderOpenDefaultBehavior,
    type ThemePreference,
    type WritingStatsMetric,
  } from '../services/settings';
  import type { ImageInsertStrategy, ImageUploadProvider } from '../../lib/services/render';

  type CategoryId =
    | 'general'
    | 'editor'
    | 'appearance'
    | 'files'
    | 'images'
    | 'stats'
    | 'advanced'
    | 'about';

  const categories = [
    { id: 'general' as const, label: '通用', icon: Settings2 },
    { id: 'editor' as const, label: '编辑器', icon: BookOpenText },
    { id: 'appearance' as const, label: '外观', icon: Palette },
    { id: 'files' as const, label: '文件与窗口', icon: FolderOpen },
    { id: 'images' as const, label: '图片', icon: FileImage },
    { id: 'stats' as const, label: '统计与大纲', icon: BarChart3 },
    { id: 'advanced' as const, label: '高级', icon: SlidersHorizontal },
    { id: 'about' as const, label: '关于', icon: Info },
  ];

  const categoryTitles: Record<CategoryId, string> = {
    general: '通用',
    editor: '编辑器',
    appearance: '外观',
    files: '文件与窗口',
    images: '图片',
    stats: '统计与大纲',
    advanced: '高级',
    about: '关于 Nomo',
  };

  let activeCategory: CategoryId = 'general';
  let draftSettings: AppPreferences = { ...DEFAULT_APP_PREFERENCES };
  let loaded = false;
  let saving = false;
  let statusMessage = '';
  let statusTimer: number | null = null;
  let desktopEnabled = false;

  onMount(() => {
    desktopEnabled = isTauriRuntime();
    void loadPreferences();

    return () => {
      if (statusTimer !== null) {
        window.clearTimeout(statusTimer);
      }
    };
  });

  async function loadPreferences() {
    draftSettings = await loadAppPreferences(desktopEnabled);
    applySettingsToThisWindow(draftSettings);
    loaded = true;
  }

  async function handleSave() {
    saving = true;
    try {
      const saved = await saveAppPreferences(desktopEnabled, draftSettings);
      draftSettings = saved;
      applySettingsToThisWindow(saved);
      await emitSettingsUpdated();
      showStatus('设置已保存');
    } catch (error) {
      showStatus(error instanceof Error ? error.message : '保存设置失败');
    } finally {
      saving = false;
    }
  }

  async function handleCancel() {
    await closeCurrentWindow();
  }

  async function emitSettingsUpdated() {
    if (!desktopEnabled) {
      return;
    }
    const { emit } = await import('@tauri-apps/api/event');
    await emit(SETTINGS_UPDATED_EVENT, { source: 'settings-window' }).catch(() => undefined);
  }

  async function closeCurrentWindow() {
    if (!desktopEnabled) {
      window.close();
      return;
    }
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('close_window').catch(() => undefined);
  }

  function applySettingsToThisWindow(settings: AppPreferences) {
    applyThemeSetting(settings.theme);
    applyTypographySettings(settings.fontSize, settings.lineHeight);
    applyEditorLayoutSettings(settings.contentWidthPercent);
    applyBlockStyleSetting(settings.blockStyle);
  }

  function showStatus(message: string) {
    statusMessage = message;
    if (statusTimer !== null) {
      window.clearTimeout(statusTimer);
    }
    statusTimer = window.setTimeout(() => {
      statusMessage = '';
      statusTimer = null;
    }, 1800);
  }

  function updateDraft(patch: Partial<AppPreferences>) {
    draftSettings = normalizeAppPreferences({
      ...draftSettings,
      ...patch,
      imageHandlingSettings: patch.imageHandlingSettings ?? draftSettings.imageHandlingSettings,
    });
  }

  function updateImageSettings(patch: Partial<AppPreferences['imageHandlingSettings']>) {
    updateDraft({
      imageHandlingSettings: {
        ...draftSettings.imageHandlingSettings,
        ...patch,
      },
    });
  }

  function setTheme(theme: ThemePreference) {
    updateDraft({ theme });
  }

  function setEditorMode(editorMode: EditorModePreference) {
    updateDraft({ editorMode });
  }

  function setBlockStyle(blockStyle: BlockStylePreference) {
    updateDraft({ blockStyle });
  }

  function setFolderBehavior(folderOpenDefaultBehavior: FolderOpenDefaultBehavior) {
    updateDraft({ folderOpenDefaultBehavior });
  }

  function setStatsMetric(writingStatsMetric: WritingStatsMetric) {
    updateDraft({ writingStatsMetric });
  }

  function setImageStrategy(imageInsertStrategy: ImageInsertStrategy) {
    updateImageSettings({ imageInsertStrategy });
  }

  function setUploadProvider(uploadProvider: ImageUploadProvider) {
    updateImageSettings({ uploadProvider });
  }

  function updateNumberSetting(key: keyof AppPreferences, event: Event) {
    updateDraft({ [key]: Number((event.currentTarget as HTMLInputElement).value) });
  }

  function updateStringSetting(key: keyof AppPreferences, event: Event) {
    updateDraft({ [key]: (event.currentTarget as HTMLInputElement).value });
  }

  function updateImageStringSetting(
    key: keyof AppPreferences['imageHandlingSettings'],
    event: Event,
  ) {
    updateImageSettings({ [key]: (event.currentTarget as HTMLInputElement).value });
  }

  function toggleSetting(key: keyof AppPreferences, event: Event) {
    updateDraft({ [key]: (event.currentTarget as HTMLInputElement).checked });
  }

  function toggleImageSetting(key: keyof AppPreferences['imageHandlingSettings'], event: Event) {
    updateImageSettings({ [key]: (event.currentTarget as HTMLInputElement).checked });
  }
</script>

<svelte:head>
  <title>偏好设置 - Nomo</title>
</svelte:head>

<div class="settings-window-shell">
  <aside class="settings-nav" aria-label="设置分类">
    <div class="settings-brand" data-tauri-drag-region>
      <MonitorCog size={20} aria-hidden="true" />
      <span>偏好设置</span>
    </div>

    <nav>
      {#each categories as category}
        <button
          type="button"
          class:active={activeCategory === category.id}
          aria-label={category.label}
          aria-current={activeCategory === category.id ? 'page' : undefined}
          on:click={() => {
            activeCategory = category.id;
          }}
        >
          <svelte:component this={category.icon} size={16} aria-hidden="true" />
          <span>{category.label}</span>
        </button>
      {/each}
    </nav>
  </aside>

  <section class="settings-main" aria-labelledby="settings-title">
    <header class="settings-header" data-tauri-drag-region>
      <div>
        <h1 id="settings-title">{categoryTitles[activeCategory]}</h1>
        <p>调整 Nomo 的本地编辑、窗口和渲染偏好。</p>
      </div>
      <button type="button" class="close-button" aria-label="关闭偏好设置" on:click={handleCancel}>
        <X size={18} />
      </button>
    </header>

    {#if !loaded}
      <div class="settings-loading" role="status">正在读取设置...</div>
    {:else}
      <div class="settings-content">
        {#if activeCategory === 'general'}
          <div class="settings-group">
            <h2>基础行为</h2>
            <div class="setting-row">
              <div>
                <span class="setting-label">主题</span>
                <p>保存后同步到主窗口和渲染服务。</p>
              </div>
              <div class="segmented-control" role="group" aria-label="主题">
                <button
                  type="button"
                  class:active={draftSettings.theme === 'light'}
                  aria-pressed={draftSettings.theme === 'light'}
                  on:click={() => setTheme('light')}>浅色</button
                >
                <button
                  type="button"
                  class:active={draftSettings.theme === 'dark'}
                  aria-pressed={draftSettings.theme === 'dark'}
                  on:click={() => setTheme('dark')}>深色</button
                >
              </div>
            </div>

            <div class="setting-row">
              <div>
                <span class="setting-label">启动默认编辑模式</span>
                <p>用于下次打开文档时的默认编辑形态。</p>
              </div>
              <div class="segmented-control" role="group" aria-label="启动默认编辑模式">
                <button
                  type="button"
                  class:active={draftSettings.editorMode === 'semantic'}
                  aria-pressed={draftSettings.editorMode === 'semantic'}
                  on:click={() => setEditorMode('semantic')}>语义编辑</button
                >
                <button
                  type="button"
                  class:active={draftSettings.editorMode === 'source'}
                  aria-pressed={draftSettings.editorMode === 'source'}
                  on:click={() => setEditorMode('source')}>源码模式</button
                >
              </div>
            </div>

            <label class="toggle-row" for="autoSaveEnabled">
              <span>
                <span class="toggle-title">自动保存</span>
                <span class="toggle-desc">编辑后自动写入当前本地文件。</span>
              </span>
              <input
                id="autoSaveEnabled"
                type="checkbox"
                checked={draftSettings.autoSaveEnabled}
                on:change={(event) => toggleSetting('autoSaveEnabled', event)}
              />
              <span class="toggle-switch" aria-hidden="true"></span>
            </label>

            <div class="setting-row">
              <div>
                <label for="autoSaveDelayMs" class="setting-label">自动保存延迟</label>
                <p>输入停止后等待多久再保存。</p>
              </div>
              <div class="range-setting">
                <input
                  id="autoSaveDelayMs"
                  type="range"
                  min="500"
                  max="5000"
                  step="100"
                  value={draftSettings.autoSaveDelayMs}
                  on:input={(event) => updateNumberSetting('autoSaveDelayMs', event)}
                />
                <output for="autoSaveDelayMs">{draftSettings.autoSaveDelayMs}ms</output>
              </div>
            </div>

            <label class="toggle-row" for="createSnapshotBeforeSave">
              <span>
                <span class="toggle-title">保存前创建快照</span>
                <span class="toggle-desc"
                  >保存本地文件前记录一份 Markdown 快照，便于恢复误覆盖。</span
                >
              </span>
              <input
                id="createSnapshotBeforeSave"
                type="checkbox"
                checked={draftSettings.createSnapshotBeforeSave}
                on:change={(event) => toggleSetting('createSnapshotBeforeSave', event)}
              />
              <span class="toggle-switch" aria-hidden="true"></span>
            </label>
          </div>
        {:else if activeCategory === 'editor'}
          <div class="settings-group">
            <h2>编辑尺度</h2>
            <div class="setting-row">
              <div>
                <label for="fontSize" class="setting-label">字号</label>
                <p>影响语义编辑区和源码模式的正文大小。</p>
              </div>
              <div class="range-setting">
                <input
                  id="fontSize"
                  type="range"
                  min="14"
                  max="22"
                  step="1"
                  value={draftSettings.fontSize}
                  on:input={(event) => updateNumberSetting('fontSize', event)}
                />
                <output for="fontSize">{draftSettings.fontSize}px</output>
              </div>
            </div>

            <div class="setting-row">
              <div>
                <label for="lineHeight" class="setting-label">行高</label>
                <p>提升长文档阅读和编辑的舒适度。</p>
              </div>
              <div class="range-setting">
                <input
                  id="lineHeight"
                  type="range"
                  min="1.4"
                  max="2.1"
                  step="0.05"
                  value={draftSettings.lineHeight}
                  on:input={(event) => updateNumberSetting('lineHeight', event)}
                />
                <output for="lineHeight">{draftSettings.lineHeight.toFixed(2)}</output>
              </div>
            </div>

            <div class="setting-row">
              <div>
                <label for="contentWidthPercent" class="setting-label">内容宽度</label>
                <p>控制编辑正文在窗口中的最大占比。</p>
              </div>
              <div class="range-setting">
                <input
                  id="contentWidthPercent"
                  type="range"
                  min="45"
                  max="90"
                  step="1"
                  value={draftSettings.contentWidthPercent}
                  on:input={(event) => updateNumberSetting('contentWidthPercent', event)}
                />
                <output for="contentWidthPercent">{draftSettings.contentWidthPercent}%</output>
              </div>
            </div>

            <div class="setting-row">
              <div>
                <span class="setting-label">Callout 样式</span>
                <p>控制提示块和引用块的视觉密度。</p>
              </div>
              <div class="segmented-control" role="group" aria-label="Callout 样式">
                <button
                  type="button"
                  class:active={draftSettings.blockStyle === 'classic'}
                  aria-pressed={draftSettings.blockStyle === 'classic'}
                  on:click={() => setBlockStyle('classic')}>经典</button
                >
                <button
                  type="button"
                  class:active={draftSettings.blockStyle === 'modern'}
                  aria-pressed={draftSettings.blockStyle === 'modern'}
                  on:click={() => setBlockStyle('modern')}>现代</button
                >
              </div>
            </div>

            <div class="setting-row">
              <div>
                <label for="largeDocumentLimit" class="setting-label">大文件阈值</label>
                <p>超过阈值后使用只读源码模式，避免语义解析阻塞窗口。</p>
              </div>
              <div class="number-field">
                <input
                  id="largeDocumentLimit"
                  type="number"
                  min="100000"
                  max="1000000"
                  step="10000"
                  value={draftSettings.largeDocumentLimit}
                  on:input={(event) => updateNumberSetting('largeDocumentLimit', event)}
                />
                <span>字符 / 字节</span>
              </div>
            </div>
          </div>
        {:else if activeCategory === 'appearance'}
          <div class="settings-group">
            <h2>视觉占位</h2>
            <div class="disabled-row" aria-disabled="true">
              <div>
                <span class="setting-label">系统主题跟随</span>
                <p>后续版本支持。当前使用手动浅色 / 深色切换。</p>
              </div>
              <span class="disabled-pill">后续版本支持</span>
            </div>
            <div class="disabled-row" aria-disabled="true">
              <div>
                <span class="setting-label">自定义 CSS 主题</span>
                <p>后续接入主题文件后开放，不影响当前 CSS 变量主题。</p>
              </div>
              <span class="disabled-pill">后续版本支持</span>
            </div>
          </div>
        {:else if activeCategory === 'files'}
          <div class="settings-group">
            <h2>文件与窗口</h2>
            <div class="setting-row">
              <div>
                <span class="setting-label">打开文件夹默认行为</span>
                <p>选择是否复用当前窗口，或总是打开新窗口。</p>
              </div>
              <div class="triple-control" role="group" aria-label="打开文件夹默认行为">
                <button
                  type="button"
                  class:active={draftSettings.folderOpenDefaultBehavior === 'ask-every-time'}
                  aria-pressed={draftSettings.folderOpenDefaultBehavior === 'ask-every-time'}
                  on:click={() => setFolderBehavior('ask-every-time')}>每次询问</button
                >
                <button
                  type="button"
                  class:active={draftSettings.folderOpenDefaultBehavior === 'current-window'}
                  aria-pressed={draftSettings.folderOpenDefaultBehavior === 'current-window'}
                  on:click={() => setFolderBehavior('current-window')}>当前窗口</button
                >
                <button
                  type="button"
                  class:active={draftSettings.folderOpenDefaultBehavior === 'new-window'}
                  aria-pressed={draftSettings.folderOpenDefaultBehavior === 'new-window'}
                  on:click={() => setFolderBehavior('new-window')}>新窗口</button
                >
              </div>
            </div>

            <label class="toggle-row" for="filePreviewEnabled">
              <span>
                <span class="toggle-title">文件预览标签</span>
                <span class="toggle-desc">单击文件时复用预览标签，编辑或双击后固定。</span>
              </span>
              <input
                id="filePreviewEnabled"
                type="checkbox"
                checked={draftSettings.filePreviewEnabled}
                on:change={(event) => toggleSetting('filePreviewEnabled', event)}
              />
              <span class="toggle-switch" aria-hidden="true"></span>
            </label>

            <label class="toggle-row" for="sidebarHidden">
              <span>
                <span class="toggle-title">启动时隐藏资源管理器侧边栏</span>
                <span class="toggle-desc">下次打开后保持侧边栏收起。</span>
              </span>
              <input
                id="sidebarHidden"
                type="checkbox"
                checked={draftSettings.sidebarHidden}
                on:change={(event) => toggleSetting('sidebarHidden', event)}
              />
              <span class="toggle-switch" aria-hidden="true"></span>
            </label>

            <label class="toggle-row" for="closeToTrayEnabled">
              <span>
                <span class="toggle-title">关闭到托盘</span>
                <span class="toggle-desc">关闭主编辑窗口时隐藏到系统托盘，退出应用不受影响。</span>
              </span>
              <input
                id="closeToTrayEnabled"
                type="checkbox"
                checked={draftSettings.closeToTrayEnabled}
                on:change={(event) => toggleSetting('closeToTrayEnabled', event)}
              />
              <span class="toggle-switch" aria-hidden="true"></span>
            </label>
          </div>
        {:else if activeCategory === 'images'}
          <div class="settings-group">
            <h2>图片导入</h2>
            <div class="setting-row">
              <div>
                <span class="setting-label">图片处理方式</span>
                <p>粘贴、拖放和上传图片时使用的默认策略。</p>
              </div>
              <div class="quad-control" role="group" aria-label="图片处理方式">
                <button
                  type="button"
                  class:active={draftSettings.imageHandlingSettings.imageInsertStrategy ===
                    'copy-current-folder'}
                  aria-pressed={draftSettings.imageHandlingSettings.imageInsertStrategy ===
                    'copy-current-folder'}
                  on:click={() => setImageStrategy('copy-current-folder')}>当前文件夹</button
                >
                <button
                  type="button"
                  class:active={draftSettings.imageHandlingSettings.imageInsertStrategy ===
                    'copy-assets'}
                  aria-pressed={draftSettings.imageHandlingSettings.imageInsertStrategy ===
                    'copy-assets'}
                  on:click={() => setImageStrategy('copy-assets')}>assets</button
                >
                <button
                  type="button"
                  class:active={draftSettings.imageHandlingSettings.imageInsertStrategy ===
                    'copy-document-assets'}
                  aria-pressed={draftSettings.imageHandlingSettings.imageInsertStrategy ===
                    'copy-document-assets'}
                  on:click={() => setImageStrategy('copy-document-assets')}>文档.assets</button
                >
                <button
                  type="button"
                  class:active={draftSettings.imageHandlingSettings.imageInsertStrategy ===
                    'upload'}
                  aria-pressed={draftSettings.imageHandlingSettings.imageInsertStrategy ===
                    'upload'}
                  on:click={() => setImageStrategy('upload')}>上传</button
                >
              </div>
            </div>

            <label class="toggle-row" for="autoDeleteUnusedLocalImages">
              <span>
                <span class="toggle-title">自动清理本地图片</span>
                <span class="toggle-desc">图片引用完全移除后，同步删除对应本地文件。</span>
              </span>
              <input
                id="autoDeleteUnusedLocalImages"
                type="checkbox"
                checked={draftSettings.imageHandlingSettings.autoDeleteUnusedLocalImages}
                on:change={(event) => toggleImageSetting('autoDeleteUnusedLocalImages', event)}
              />
              <span class="toggle-switch" aria-hidden="true"></span>
            </label>

            {#if draftSettings.imageHandlingSettings.imageInsertStrategy === 'upload'}
              <div class="setting-row">
                <div>
                  <span class="setting-label">上传方式</span>
                  <p>PicGo 适合常驻服务，PicGo-Core 适合命令行工作流。</p>
                </div>
                <div class="segmented-control" role="group" aria-label="图片上传方式">
                  <button
                    type="button"
                    class:active={draftSettings.imageHandlingSettings.uploadProvider === 'picgo'}
                    aria-pressed={draftSettings.imageHandlingSettings.uploadProvider === 'picgo'}
                    on:click={() => setUploadProvider('picgo')}>PicGo</button
                  >
                  <button
                    type="button"
                    class:active={draftSettings.imageHandlingSettings.uploadProvider ===
                      'picgo-core'}
                    aria-pressed={draftSettings.imageHandlingSettings.uploadProvider ===
                      'picgo-core'}
                    on:click={() => setUploadProvider('picgo-core')}>PicGo-Core</button
                  >
                </div>
              </div>

              {#if draftSettings.imageHandlingSettings.uploadProvider === 'picgo'}
                <div class="setting-row">
                  <div>
                    <label for="picgoServerUrl" class="setting-label">PicGo Server 地址</label>
                    <p>用于调用本机 PicGo 服务上传图片。</p>
                  </div>
                  <input
                    id="picgoServerUrl"
                    class="text-input"
                    type="url"
                    value={draftSettings.imageHandlingSettings.picgoServerUrl}
                    on:input={(event) => updateImageStringSetting('picgoServerUrl', event)}
                  />
                </div>
              {:else}
                <div class="setting-row">
                  <div>
                    <label for="picgoCoreCommand" class="setting-label">PicGo-Core 命令</label>
                    <p>例如 picgo、npx picgo 或完整可执行文件路径。</p>
                  </div>
                  <input
                    id="picgoCoreCommand"
                    class="text-input"
                    type="text"
                    value={draftSettings.imageHandlingSettings.picgoCoreCommand}
                    on:input={(event) => updateImageStringSetting('picgoCoreCommand', event)}
                  />
                </div>
                <div class="setting-row">
                  <div>
                    <label for="picgoCoreConfigPath" class="setting-label"
                      >PicGo-Core 配置文件路径</label
                    >
                    <p>可留空，使用 PicGo-Core 默认配置。</p>
                  </div>
                  <input
                    id="picgoCoreConfigPath"
                    class="text-input"
                    type="text"
                    value={draftSettings.imageHandlingSettings.picgoCoreConfigPath}
                    on:input={(event) => updateImageStringSetting('picgoCoreConfigPath', event)}
                  />
                </div>
              {/if}
            {/if}

            <div class="disabled-row" aria-disabled="true">
              <div>
                <span class="setting-label">图片默认宽度</span>
                <p>后续会接入图片节点属性默认值。</p>
              </div>
              <span class="disabled-pill">后续版本支持</span>
            </div>
            <div class="disabled-row" aria-disabled="true">
              <div>
                <span class="setting-label">图片默认对齐</span>
                <p>后续会接入图片节点属性默认值。</p>
              </div>
              <span class="disabled-pill">后续版本支持</span>
            </div>
          </div>
        {:else if activeCategory === 'stats'}
          <div class="settings-group">
            <h2>统计与导航</h2>
            <label class="toggle-row" for="outlineVisible">
              <span>
                <span class="toggle-title">显示文档大纲</span>
                <span class="toggle-desc">在编辑区右侧显示当前文档标题导航。</span>
              </span>
              <input
                id="outlineVisible"
                type="checkbox"
                checked={draftSettings.outlineVisible}
                on:change={(event) => toggleSetting('outlineVisible', event)}
              />
              <span class="toggle-switch" aria-hidden="true"></span>
            </label>

            <label class="toggle-row" for="writingStatsVisible">
              <span>
                <span class="toggle-title">显示文档统计</span>
                <span class="toggle-desc">在正文右下角显示当前文档的轻量统计。</span>
              </span>
              <input
                id="writingStatsVisible"
                type="checkbox"
                checked={draftSettings.writingStatsVisible}
                on:change={(event) => toggleSetting('writingStatsVisible', event)}
              />
              <span class="toggle-switch" aria-hidden="true"></span>
            </label>

            <div class="setting-row">
              <div>
                <span class="setting-label">默认统计类型</span>
                <p>决定状态栏默认展示行数、词数或字符数。</p>
              </div>
              <div class="triple-control" role="group" aria-label="默认统计类型">
                <button
                  type="button"
                  class:active={draftSettings.writingStatsMetric === 'lines'}
                  aria-pressed={draftSettings.writingStatsMetric === 'lines'}
                  on:click={() => setStatsMetric('lines')}>行数</button
                >
                <button
                  type="button"
                  class:active={draftSettings.writingStatsMetric === 'words'}
                  aria-pressed={draftSettings.writingStatsMetric === 'words'}
                  on:click={() => setStatsMetric('words')}>词数</button
                >
                <button
                  type="button"
                  class:active={draftSettings.writingStatsMetric === 'chars'}
                  aria-pressed={draftSettings.writingStatsMetric === 'chars'}
                  on:click={() => setStatsMetric('chars')}>字符</button
                >
              </div>
            </div>

            <label class="toggle-row" for="readingTimeVisible">
              <span>
                <span class="toggle-title">阅读时间</span>
                <span class="toggle-desc">在统计弹层中显示由当前 Markdown 派生的阅读时长。</span>
              </span>
              <input
                id="readingTimeVisible"
                type="checkbox"
                checked={draftSettings.readingTimeVisible}
                on:change={(event) => toggleSetting('readingTimeVisible', event)}
              />
              <span class="toggle-switch" aria-hidden="true"></span>
            </label>

            <div class="disabled-row" aria-disabled="true">
              <div>
                <span class="setting-label">大纲默认展开层级</span>
                <p>后续会接入 Outline 展开状态策略。</p>
              </div>
              <span class="disabled-pill">后续版本支持</span>
            </div>
          </div>
        {:else if activeCategory === 'advanced'}
          <div class="settings-group">
            <h2>默认插入行为</h2>
            <div class="setting-row">
              <div>
                <label for="defaultCodeBlockLanguage" class="setting-label">代码块默认语言</label>
                <p>菜单或快捷键插入代码块时使用。</p>
              </div>
              <input
                id="defaultCodeBlockLanguage"
                class="text-input compact"
                type="text"
                spellcheck="false"
                value={draftSettings.defaultCodeBlockLanguage}
                on:input={(event) => updateStringSetting('defaultCodeBlockLanguage', event)}
              />
            </div>

            <div class="setting-row">
              <div>
                <label for="defaultDiagramType" class="setting-label">Mermaid 默认图表类型</label>
                <p>菜单插入图表时使用。</p>
              </div>
              <select
                id="defaultDiagramType"
                class="select-input"
                value={draftSettings.defaultDiagramType}
                on:change={(event) => updateStringSetting('defaultDiagramType', event)}
              >
                {#each DIAGRAM_TEMPLATES as template}
                  <option value={template.type}>{template.label}</option>
                {/each}
              </select>
            </div>

            <div class="disabled-row" aria-disabled="true">
              <div>
                <span class="setting-label">自定义快捷键</span>
                <p>当前快捷键仍由应用菜单和命令系统固定定义。</p>
              </div>
              <span class="disabled-pill">后续版本支持</span>
            </div>
            <div class="disabled-row" aria-disabled="true">
              <div>
                <span class="setting-label">导出设置</span>
                <p>完整导出管线不在当前阶段。</p>
              </div>
              <span class="disabled-pill">后续版本支持</span>
            </div>
          </div>
        {:else if activeCategory === 'about'}
          <div class="settings-group about-group">
            <h2>Nomo</h2>
            <div class="about-mark">N</div>
            <dl>
              <div>
                <dt>版本</dt>
                <dd>{packageInfo.version}</dd>
              </div>
              <div>
                <dt>定位</dt>
                <dd>本地优先、Markdown-first 的轻量桌面 Markdown 编辑器。</dd>
              </div>
              <div>
                <dt>平台策略</dt>
                <dd>当前版本优先保证 Windows 的文件、窗口和快捷键体验。</dd>
              </div>
            </dl>
          </div>
        {/if}
      </div>
    {/if}

    <footer class="settings-footer">
      <span class:visible={statusMessage} role="status">{statusMessage}</span>
      <button type="button" class="secondary-button" on:click={handleCancel}>取消</button>
      <button
        type="button"
        class="primary-button"
        disabled={saving || !loaded}
        on:click={handleSave}
      >
        {saving ? '保存中...' : '保存'}
      </button>
    </footer>
  </section>
</div>

<style>
  :global(body) {
    overflow: hidden;
  }

  .settings-window-shell {
    width: 100vw;
    height: 100vh;
    min-height: 0;
    display: grid;
    grid-template-columns: 212px minmax(0, 1fr);
    background: var(--md-editor-bg);
    color: var(--md-editor-fg);
    font-family: var(--md-editor-font-body);
  }

  .settings-nav {
    border-right: 1px solid var(--md-editor-border);
    background: color-mix(in srgb, var(--md-editor-rail) 78%, var(--md-editor-bg));
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .settings-brand {
    height: 64px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 18px;
    color: var(--md-editor-fg);
    font-size: 14px;
    font-weight: 700;
    border-bottom: 1px solid var(--md-editor-border);
    user-select: none;
  }

  .settings-brand :global(svg) {
    color: var(--md-editor-accent);
  }

  .settings-nav nav {
    display: grid;
    gap: 4px;
    padding: 12px 10px;
  }

  .settings-nav button {
    width: 100%;
    min-height: 38px;
    display: flex;
    align-items: center;
    gap: 10px;
    border: 0;
    border-radius: var(--md-editor-radius-sm);
    background: transparent;
    color: var(--md-editor-muted-fg);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
    transition:
      background-color 160ms ease,
      color 160ms ease;
  }

  .settings-nav button:hover {
    background: color-mix(in srgb, var(--md-editor-accent) 9%, transparent);
    color: var(--md-editor-fg);
  }

  .settings-nav button.active {
    background: var(--md-editor-sidebar-active);
    color: var(--md-editor-accent-strong);
  }

  .settings-main {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-width: 0;
    min-height: 0;
    background: var(--md-editor-bg);
  }

  .settings-header {
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 0 22px;
    border-bottom: 1px solid var(--md-editor-border);
    user-select: none;
  }

  .settings-header h1 {
    margin: 0;
    color: var(--md-editor-heading-fg);
    font-size: 18px;
    line-height: 1.2;
    font-weight: 750;
    letter-spacing: 0;
  }

  .settings-header p {
    margin: 4px 0 0;
    color: var(--md-editor-muted-fg);
    font-size: 12px;
    line-height: 1.45;
  }

  .close-button {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: var(--md-editor-radius-sm);
    background: transparent;
    color: var(--md-editor-muted-fg);
    cursor: pointer;
  }

  .close-button:hover {
    background: var(--md-editor-surface);
    color: var(--md-editor-fg);
  }

  .settings-content,
  .settings-loading {
    min-height: 0;
    overflow-y: auto;
    padding: 22px;
  }

  .settings-loading {
    color: var(--md-editor-muted-fg);
    font-size: 14px;
  }

  .settings-group {
    display: grid;
    gap: 0;
    max-width: 740px;
  }

  .settings-group h2 {
    margin: 0;
    padding: 0 0 12px;
    color: var(--md-editor-heading-fg);
    font-size: 13px;
    font-weight: 750;
    letter-spacing: 0;
  }

  .setting-row,
  .toggle-row,
  .disabled-row {
    min-height: 64px;
    display: grid;
    grid-template-columns: minmax(220px, 1fr) minmax(220px, 300px);
    align-items: center;
    gap: 22px;
    padding: 14px 0;
    border-top: 1px solid color-mix(in srgb, var(--md-editor-border) 72%, transparent);
  }

  .toggle-row {
    cursor: pointer;
  }

  .setting-label,
  .toggle-title {
    display: block;
    color: var(--md-editor-fg);
    font-size: 13px;
    font-weight: 650;
    line-height: 1.35;
  }

  .setting-row p,
  .disabled-row p,
  .toggle-desc {
    display: block;
    margin: 4px 0 0;
    color: var(--md-editor-muted-fg);
    font-size: 12px;
    line-height: 1.45;
  }

  .segmented-control,
  .triple-control,
  .quad-control {
    display: grid;
    gap: 4px;
    padding: 4px;
    border: 1px solid var(--md-editor-border);
    border-radius: var(--md-editor-radius-md);
    background: color-mix(in srgb, var(--md-editor-surface) 82%, var(--md-editor-bg));
  }

  .segmented-control {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .triple-control {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .quad-control {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .segmented-control button,
  .triple-control button,
  .quad-control button {
    min-width: 0;
    min-height: 34px;
    border: 0;
    border-radius: var(--md-editor-radius-sm);
    background: transparent;
    color: var(--md-editor-muted-fg);
    font: inherit;
    font-size: 12px;
    font-weight: 650;
    cursor: pointer;
    transition:
      background-color 160ms ease,
      color 160ms ease,
      box-shadow 160ms ease;
  }

  .segmented-control button:hover,
  .triple-control button:hover,
  .quad-control button:hover {
    background: color-mix(in srgb, var(--md-editor-accent) 8%, transparent);
    color: var(--md-editor-fg);
  }

  .segmented-control button.active,
  .triple-control button.active,
  .quad-control button.active {
    background: var(--md-editor-bg);
    color: var(--md-editor-accent-strong);
    box-shadow: 0 1px 8px color-mix(in srgb, #020617 10%, transparent);
  }

  .range-setting {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 74px;
    align-items: center;
    gap: 12px;
  }

  .range-setting input {
    width: 100%;
    accent-color: var(--md-editor-accent);
  }

  .range-setting output,
  .number-field span {
    color: var(--md-editor-muted-fg);
    font-family: var(--md-editor-font-mono);
    font-size: 12px;
    text-align: right;
  }

  .number-field {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
  }

  .text-input,
  .select-input,
  .number-field input {
    width: 100%;
    min-width: 0;
    height: 34px;
    padding: 0 10px;
    border: 1px solid var(--md-editor-border);
    border-radius: var(--md-editor-radius-sm);
    background: var(--md-editor-surface);
    color: var(--md-editor-fg);
    font: inherit;
    font-size: 13px;
    outline: none;
  }

  .text-input.compact {
    max-width: 140px;
    justify-self: end;
  }

  .toggle-row input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .toggle-switch {
    justify-self: end;
    position: relative;
    width: 42px;
    height: 24px;
    border-radius: 999px;
    border: 1px solid var(--md-editor-border);
    background: color-mix(in srgb, var(--md-editor-muted-fg) 16%, var(--md-editor-bg));
    transition:
      background-color 160ms ease,
      border-color 160ms ease;
  }

  .toggle-switch::before {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 18px;
    height: 18px;
    border-radius: 999px;
    background: var(--md-editor-bg);
    box-shadow: 0 1px 4px color-mix(in srgb, #020617 20%, transparent);
    transition: transform 160ms ease;
  }

  .toggle-row input:checked + .toggle-switch {
    border-color: var(--md-editor-accent);
    background: var(--md-editor-accent);
  }

  .toggle-row input:checked + .toggle-switch::before {
    transform: translateX(18px);
  }

  .disabled-row {
    opacity: 0.76;
  }

  .disabled-pill {
    justify-self: end;
    padding: 5px 9px;
    border: 1px solid var(--md-editor-border);
    border-radius: 999px;
    color: var(--md-editor-muted-fg);
    background: color-mix(in srgb, var(--md-editor-surface) 72%, transparent);
    font-size: 12px;
    font-weight: 650;
    white-space: nowrap;
  }

  .about-group {
    max-width: 640px;
  }

  .about-mark {
    width: 54px;
    height: 54px;
    display: grid;
    place-items: center;
    margin: 2px 0 16px;
    border-radius: var(--md-editor-radius-md);
    background: var(--md-editor-accent);
    color: white;
    font-size: 24px;
    font-weight: 800;
  }

  .about-group dl {
    display: grid;
    gap: 0;
    margin: 0;
  }

  .about-group dl > div {
    display: grid;
    grid-template-columns: 92px minmax(0, 1fr);
    gap: 18px;
    padding: 13px 0;
    border-top: 1px solid color-mix(in srgb, var(--md-editor-border) 72%, transparent);
  }

  .about-group dt {
    color: var(--md-editor-muted-fg);
    font-size: 12px;
    font-weight: 650;
  }

  .about-group dd {
    margin: 0;
    color: var(--md-editor-fg);
    font-size: 13px;
    line-height: 1.55;
  }

  .settings-footer {
    min-height: 58px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    padding: 10px 22px;
    border-top: 1px solid var(--md-editor-border);
    background: color-mix(in srgb, var(--md-editor-bg) 94%, var(--md-editor-surface));
  }

  .settings-footer span {
    margin-right: auto;
    color: var(--md-editor-muted-fg);
    font-size: 12px;
    opacity: 0;
    transition: opacity 160ms ease;
  }

  .settings-footer span.visible {
    opacity: 1;
  }

  .primary-button,
  .secondary-button {
    min-width: 76px;
    height: 34px;
    border-radius: var(--md-editor-radius-sm);
    font: inherit;
    font-size: 13px;
    font-weight: 650;
    cursor: pointer;
  }

  .primary-button {
    border: 1px solid var(--md-editor-accent);
    background: var(--md-editor-accent);
    color: white;
  }

  .primary-button:disabled {
    cursor: not-allowed;
    opacity: 0.62;
  }

  .secondary-button {
    border: 1px solid var(--md-editor-border);
    background: var(--md-editor-surface);
    color: var(--md-editor-fg);
  }

  button:focus-visible,
  input:focus-visible,
  select:focus-visible,
  .toggle-row input:focus-visible + .toggle-switch {
    outline: 2px solid var(--md-editor-accent);
    outline-offset: 2px;
  }

  @media (max-width: 760px) {
    .settings-window-shell {
      grid-template-columns: 64px minmax(0, 1fr);
    }

    .settings-brand span,
    .settings-nav button span {
      display: none;
    }

    .settings-brand,
    .settings-nav button {
      justify-content: center;
      padding-left: 0;
      padding-right: 0;
    }

    .setting-row,
    .toggle-row,
    .disabled-row {
      grid-template-columns: minmax(0, 1fr);
      gap: 10px;
    }

    .settings-content {
      padding: 18px;
    }
  }
</style>
