<script lang="ts">
  import {
    BarChart3,
    BookOpenText,
    Code2,
    FileImage,
    FolderOpen,
    Info,
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
    type CodeBlockIndentPreference,
    type EditorModePreference,
    type FolderOpenDefaultBehavior,
    type ShortcutCommandId,
    type ThemePreference,
    type WritingStatsMetric,
  } from '../services/settings';
  import type {
    ImageDefaultAlign,
    ImageInsertStrategy,
    ImageUploadProvider,
  } from '../../lib/services/render';
  import { getPlatformCapabilities } from '../services/platform';
  import nomoLogoDark from '../../../src-tauri/icons/nomo/source/nomo-app-dark-128.png?url';
  import nomoLogoLight from '../../../src-tauri/icons/nomo/source/nomo-app-light-128.png?url';

  type CategoryId =
    | 'general'
    | 'editor'
    | 'appearance'
    | 'files'
    | 'images'
    | 'stats'
    | 'advanced'
    | 'about';

  type MarkdownAssociationStatus = {
    supported: boolean;
    registered: boolean;
    is_default: boolean;
    default_prog_id: string | null;
    message: string;
  };

  type WindowsContextMenuStatus = {
    supported: boolean;
    registered: boolean;
    message: string;
  };

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
  let statusMessage = '';
  let statusTimer: number | null = null;
  let autoSaveTimer: number | null = null;
  let saveInFlight = false;
  let saveQueued = false;
  let activeSavePromise: Promise<void> | null = null;
  let desktopEnabled = false;
  let platformCapabilities = getPlatformCapabilities();
  let picgoTesting = false;
  let bindingMdAssociation = false;
  let checkingMdAssociation = false;
  let mdAssociationStatus: MarkdownAssociationStatus | null = null;
  let mdAssociationError = '';
  let registeringContextMenu = false;
  let checkingContextMenu = false;
  let contextMenuStatus: WindowsContextMenuStatus | null = null;
  let contextMenuError = '';

  const shortcutItems: Array<{ id: ShortcutCommandId; label: string }> = [
    { id: 'new-file', label: '新建 Markdown' },
    { id: 'open-file', label: '打开文件' },
    { id: 'save-file', label: '保存' },
    { id: 'toggle-source', label: '切换源码模式' },
    { id: 'toggle-theme', label: '主动切换浅 / 深色' },
    { id: 'toggle-focus', label: '显示 / 隐藏资源管理器' },
    { id: 'insert-code-block', label: '插入代码块' },
    { id: 'insert-table', label: '插入表格' },
    { id: 'insert-math-block', label: '插入公式块' },
    { id: 'menu-link', label: '编辑超链接' },
    { id: 'menu-clear-format', label: '清除样式' },
  ];

  onMount(() => {
    desktopEnabled = isTauriRuntime();
    platformCapabilities = getPlatformCapabilities();
    void loadPreferences();
    void refreshMarkdownAssociationStatus();
    void refreshWindowsContextMenuStatus();
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      if (statusTimer !== null) {
        window.clearTimeout(statusTimer);
      }
      if (autoSaveTimer !== null) {
        window.clearTimeout(autoSaveTimer);
      }
      window.removeEventListener('focus', handleWindowFocus);
    };
  });

  function handleWindowFocus() {
    if (activeCategory === 'files') {
      void refreshMarkdownAssociationStatus({ silent: true });
      void refreshWindowsContextMenuStatus({ silent: true });
    }
  }

  async function loadPreferences() {
    draftSettings = await loadAppPreferences(desktopEnabled);
    applySettingsToThisWindow(draftSettings);
    loaded = true;
  }

  async function saveLatestSettings() {
    if (!loaded) {
      return;
    }

    if (saveInFlight) {
      saveQueued = true;
      return activeSavePromise ?? Promise.resolve();
    }

    saveInFlight = true;
    activeSavePromise = (async () => {
      try {
        do {
          saveQueued = false;
          const settingsToSave = draftSettings;
          try {
            const saved = await saveAppPreferences(desktopEnabled, settingsToSave);
            if (draftSettings === settingsToSave) {
              draftSettings = saved;
              applySettingsToThisWindow(saved);
            }
            await emitSettingsUpdated();
            showStatus('已自动保存');
          } catch (error) {
            showStatus(error instanceof Error ? error.message : '保存设置失败');
          }
        } while (saveQueued);
      } finally {
        saveInFlight = false;
        activeSavePromise = null;
      }
    })();

    return activeSavePromise;
  }

  function scheduleAutoSave() {
    if (!loaded) {
      return;
    }

    if (autoSaveTimer !== null) {
      window.clearTimeout(autoSaveTimer);
    }
    showStatus('保存中...');
    autoSaveTimer = window.setTimeout(() => {
      autoSaveTimer = null;
      void saveLatestSettings();
    }, 350);
  }

  async function flushPendingSettingsSave() {
    if (autoSaveTimer !== null) {
      window.clearTimeout(autoSaveTimer);
      autoSaveTimer = null;
    }

    await saveLatestSettings();
  }

  async function handleClose() {
    await flushPendingSettingsSave();
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
    const nextSettings = normalizeAppPreferences({
      ...draftSettings,
      ...patch,
      imageHandlingSettings: patch.imageHandlingSettings ?? draftSettings.imageHandlingSettings,
    });

    draftSettings = nextSettings;
    applySettingsToThisWindow(nextSettings);
    scheduleAutoSave();
  }

  function updateImageSettings(patch: Partial<AppPreferences['imageHandlingSettings']>) {
    updateDraft({
      imageHandlingSettings: {
        ...draftSettings.imageHandlingSettings,
        ...patch,
      },
    });
  }

  async function minimizeCurrentWindow() {
    if (!desktopEnabled) {
      return;
    }

    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('minimize_window').catch(() => undefined);
  }

  async function handleWindowDrag(event: MouseEvent) {
    if (!desktopEnabled || event.buttons !== 1 || event.detail > 1) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest('button,input,select,textarea,label,a')) {
      return;
    }

    if (!target.closest('[data-drag-region]')) {
      return;
    }

    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().startDragging();
    } catch {
      // ignore
    }
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

  function setImageDefaultAlign(defaultImageAlign: ImageDefaultAlign) {
    updateImageSettings({ defaultImageAlign });
  }

  function setCodeBlockIndent(codeBlockIndent: CodeBlockIndentPreference) {
    updateDraft({ codeBlockIndent });
  }

  function updateShortcut(commandId: ShortcutCommandId, event: Event) {
    updateDraft({
      shortcutPreferences: {
        ...draftSettings.shortcutPreferences,
        [commandId]: (event.currentTarget as HTMLInputElement).value,
      },
    });
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

  async function testPicgoConnection() {
    if (!desktopEnabled || picgoTesting) {
      return;
    }
    picgoTesting = true;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<{ ok: boolean; message: string }>('test_picgo_connection', {
        input: {
          provider: draftSettings.imageHandlingSettings.uploadProvider,
          server_url: draftSettings.imageHandlingSettings.picgoServerUrl,
          command: draftSettings.imageHandlingSettings.picgoCoreCommand,
        },
      });
      showStatus(result.message);
    } catch (error) {
      showStatus(error instanceof Error ? error.message : String(error));
    } finally {
      picgoTesting = false;
    }
  }

  async function refreshMarkdownAssociationStatus(options: { silent?: boolean } = {}) {
    if (!desktopEnabled || !platformCapabilities.isWindows || checkingMdAssociation) {
      return;
    }

    checkingMdAssociation = true;
    if (!options.silent) {
      mdAssociationError = '';
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      mdAssociationStatus = await invoke<MarkdownAssociationStatus>(
        'get_markdown_file_association_status',
      );
      mdAssociationError = '';
    } catch (error) {
      mdAssociationError = error instanceof Error ? error.message : String(error);
    } finally {
      checkingMdAssociation = false;
    }
  }

  function getMarkdownAssociationLabel() {
    if (!desktopEnabled || !platformCapabilities.isWindows) {
      return '不支持';
    }
    if (checkingMdAssociation && !mdAssociationStatus) {
      return '检测中';
    }
    if (mdAssociationError) {
      return '检测失败';
    }
    if (mdAssociationStatus?.is_default) {
      return '已绑定';
    }
    if (mdAssociationStatus?.registered) {
      return '待选择';
    }
    return '未绑定';
  }

  function getMarkdownAssociationDescription() {
    if (!desktopEnabled) {
      return '仅 Windows 桌面版可绑定系统默认打开方式。';
    }
    if (!platformCapabilities.isWindows) {
      return '当前默认打开方式绑定仅支持 Windows。';
    }
    if (mdAssociationError) {
      return mdAssociationError;
    }
    if (checkingMdAssociation && !mdAssociationStatus) {
      return '正在读取 Windows 当前 .md 默认打开方式。';
    }
    return (
      mdAssociationStatus?.message ??
      '将 Nomo 注册到 Windows 默认应用候选列表，并在系统设置中完成确认。'
    );
  }

  function getMarkdownAssociationButtonLabel() {
    if (bindingMdAssociation) {
      return '打开中...';
    }
    if (mdAssociationStatus?.is_default) {
      return '已绑定';
    }
    if (mdAssociationStatus?.registered) {
      return '去选择 Nomo';
    }
    return '绑定 .md';
  }

  function getMarkdownAssociationPillClass() {
    if (mdAssociationStatus?.is_default) {
      return 'bound';
    }
    if (mdAssociationError) {
      return 'error';
    }
    if (mdAssociationStatus?.registered) {
      return 'pending';
    }
    return 'idle';
  }

  async function refreshWindowsContextMenuStatus(options: { silent?: boolean } = {}) {
    if (!desktopEnabled || !platformCapabilities.isWindows || checkingContextMenu) {
      return;
    }

    checkingContextMenu = true;
    if (!options.silent) {
      contextMenuError = '';
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      contextMenuStatus = await invoke<WindowsContextMenuStatus>('get_windows_context_menu_status');
      contextMenuError = '';
    } catch (error) {
      contextMenuError = error instanceof Error ? error.message : String(error);
    } finally {
      checkingContextMenu = false;
    }
  }

  function getContextMenuLabel() {
    if (!desktopEnabled || !platformCapabilities.isWindows) {
      return '不支持';
    }
    if (checkingContextMenu && !contextMenuStatus) {
      return '检测中';
    }
    if (contextMenuError) {
      return '检测失败';
    }
    return contextMenuStatus?.registered ? '已注册' : '未注册';
  }

  function getContextMenuDescription() {
    if (!desktopEnabled) {
      return '仅 Windows 桌面版可注册系统右键菜单。';
    }
    if (!platformCapabilities.isWindows) {
      return '当前右键菜单注册仅支持 Windows。';
    }
    if (contextMenuError) {
      return contextMenuError;
    }
    if (checkingContextMenu && !contextMenuStatus) {
      return '正在读取 Windows 当前右键菜单注册状态。';
    }
    return (
      contextMenuStatus?.message ?? '在 .md / .markdown 文件和文件夹右键菜单中加入 Nomo。'
    );
  }

  function getContextMenuButtonLabel() {
    if (registeringContextMenu) {
      return '注册中...';
    }
    if (contextMenuStatus?.registered) {
      return '已注册';
    }
    return '注册右键菜单';
  }

  function getContextMenuPillClass() {
    if (contextMenuStatus?.registered) {
      return 'bound';
    }
    if (contextMenuError) {
      return 'error';
    }
    return 'idle';
  }

  async function registerWindowsContextMenu() {
    if (
      !desktopEnabled ||
      !platformCapabilities.isWindows ||
      registeringContextMenu ||
      contextMenuStatus?.registered
    ) {
      return;
    }

    registeringContextMenu = true;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<{ ok: boolean; message: string }>('register_windows_context_menu');
      showStatus(result.message);
      await refreshWindowsContextMenuStatus({ silent: true });
    } catch (error) {
      showStatus(error instanceof Error ? error.message : String(error));
    } finally {
      registeringContextMenu = false;
    }
  }

  async function bindMarkdownAssociation() {
    if (
      !desktopEnabled ||
      !platformCapabilities.isWindows ||
      bindingMdAssociation ||
      mdAssociationStatus?.is_default
    ) {
      return;
    }
    bindingMdAssociation = true;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<{ ok: boolean; message: string }>(
        'register_markdown_file_association',
      );
      showStatus(result.message);
      await refreshMarkdownAssociationStatus({ silent: true });
    } catch (error) {
      showStatus(error instanceof Error ? error.message : String(error));
    } finally {
      bindingMdAssociation = false;
    }
  }
</script>

<svelte:head>
  <title>偏好设置 - Nomo</title>
</svelte:head>

<div class="settings-window-shell">
  <aside class="settings-nav" aria-label="设置分类">
    <div
      class="settings-brand"
      data-drag-region
      role="presentation"
      on:mousedown={handleWindowDrag}
    >
      <span class="settings-brand-logo" aria-hidden="true">
        <img class="logo-light" src={nomoLogoLight} alt="" draggable="false" />
        <img class="logo-dark" src={nomoLogoDark} alt="" draggable="false" />
      </span>
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
    <header
      class="settings-header"
      data-drag-region
      role="presentation"
      on:mousedown={handleWindowDrag}
    >
      <div class="settings-header-title" data-drag-region>
        <h1 id="settings-title">{categoryTitles[activeCategory]}</h1>
        <span class:visible={statusMessage} role="status" data-drag-region>{statusMessage}</span>
      </div>
      {#if desktopEnabled && platformCapabilities.usesCustomWindowsTitlebar}
        <div class="settings-window-controls" aria-label="窗口控制">
          <button
            type="button"
            class="settings-control-button"
            title="最小化"
            aria-label="最小化"
            on:click={minimizeCurrentWindow}
          >
            <svg width="10" height="1" viewBox="0 0 10 1" aria-hidden="true">
              <line x1="0" y1="0.5" x2="10" y2="0.5" stroke="currentColor" stroke-width="1.5" />
            </svg>
          </button>
          <button
            type="button"
            class="settings-control-button close"
            title="关闭"
            aria-label="关闭偏好设置"
            on:click={handleClose}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      {:else if !desktopEnabled}
        <button type="button" class="close-button" aria-label="关闭偏好设置" on:click={handleClose}>
          <X size={18} />
        </button>
      {/if}
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
              <div class="triple-control" role="group" aria-label="主题">
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
                <button
                  type="button"
                  class:active={draftSettings.theme === 'system'}
                  aria-pressed={draftSettings.theme === 'system'}
                  on:click={() => setTheme('system')}>跟随系统</button
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

            <div class="disabled-row" aria-disabled="true">
              <div>
                <span class="setting-label">界面语言</span>
                <p>后续支持在中文和英文之间切换。</p>
              </div>
              <span class="disabled-pill">中 / 英</span>
            </div>
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

            <div class="setting-row">
              <div>
                <span class="setting-label">默认缩进</span>
                <p>代码块编辑态按 Tab 时使用。</p>
              </div>
              <div class="triple-control" role="group" aria-label="默认缩进">
                <button
                  type="button"
                  class:active={draftSettings.codeBlockIndent === 'spaces-2'}
                  aria-pressed={draftSettings.codeBlockIndent === 'spaces-2'}
                  on:click={() => setCodeBlockIndent('spaces-2')}>2 空格</button
                >
                <button
                  type="button"
                  class:active={draftSettings.codeBlockIndent === 'spaces-4'}
                  aria-pressed={draftSettings.codeBlockIndent === 'spaces-4'}
                  on:click={() => setCodeBlockIndent('spaces-4')}>4 空格</button
                >
                <button
                  type="button"
                  class:active={draftSettings.codeBlockIndent === 'tab'}
                  aria-pressed={draftSettings.codeBlockIndent === 'tab'}
                  on:click={() => setCodeBlockIndent('tab')}>Tab</button
                >
              </div>
            </div>

            <label class="toggle-row" for="codeBlockLineNumbersVisible">
              <span>
                <span class="toggle-title">代码块行号</span>
                <span class="toggle-desc">控制语义编辑区代码块是否显示行号。</span>
              </span>
              <input
                id="codeBlockLineNumbersVisible"
                type="checkbox"
                checked={draftSettings.codeBlockLineNumbersVisible}
                on:change={(event) => toggleSetting('codeBlockLineNumbersVisible', event)}
              />
              <span class="toggle-switch" aria-hidden="true"></span>
            </label>

            <label class="toggle-row" for="inlineCodeRenderingEnabled">
              <span>
                <span class="toggle-title">渲染行内代码</span>
                <span class="toggle-desc"
                  >开启后显示行内代码样式；关闭后显示原始 Markdown 反引号文本。</span
                >
              </span>
              <input
                id="inlineCodeRenderingEnabled"
                type="checkbox"
                checked={draftSettings.inlineCodeRenderingEnabled}
                on:change={(event) => toggleSetting('inlineCodeRenderingEnabled', event)}
              />
              <span class="toggle-switch" aria-hidden="true"></span>
            </label>
          </div>
        {:else if activeCategory === 'appearance'}
          <div class="settings-group">
            <h2>视觉缩放</h2>
            <div class="setting-row">
              <div>
                <label for="zoomPercent" class="setting-label">缩放级别</label>
                <p>调整正文编辑区和源码模式的整体显示比例。</p>
              </div>
              <div class="range-setting">
                <input
                  id="zoomPercent"
                  type="range"
                  min="80"
                  max="160"
                  step="5"
                  value={draftSettings.zoomPercent}
                  on:input={(event) => updateNumberSetting('zoomPercent', event)}
                />
                <output for="zoomPercent">{draftSettings.zoomPercent}%</output>
              </div>
            </div>

            <label class="toggle-row" for="ctrlWheelZoomEnabled">
              <span>
                <span class="toggle-title">Ctrl 滚轮缩放</span>
                <span class="toggle-desc">按住 Ctrl 并滚动鼠标滚轮调整缩放。</span>
              </span>
              <input
                id="ctrlWheelZoomEnabled"
                type="checkbox"
                checked={draftSettings.ctrlWheelZoomEnabled}
                on:change={(event) => toggleSetting('ctrlWheelZoomEnabled', event)}
              />
              <span class="toggle-switch" aria-hidden="true"></span>
            </label>

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

            <div class="setting-row">
              <div>
                <span class="setting-label">绑定 .md 默认打开方式</span>
                <p>{getMarkdownAssociationDescription()}</p>
              </div>
              <div class="association-action">
                <span class={`association-pill ${getMarkdownAssociationPillClass()}`}>
                  {getMarkdownAssociationLabel()}
                </span>
                <button
                  type="button"
                  class="action-button"
                  disabled={!desktopEnabled ||
                    !platformCapabilities.isWindows ||
                    bindingMdAssociation ||
                    checkingMdAssociation ||
                    mdAssociationStatus?.is_default}
                  on:click={bindMarkdownAssociation}
                >
                  {getMarkdownAssociationButtonLabel()}
                </button>
              </div>
            </div>

            <div class="setting-row">
              <div>
                <span class="setting-label">注册 .md 与文件夹右键菜单</span>
                <p>{getContextMenuDescription()}</p>
              </div>
              <div class="association-action">
                <span class={`association-pill ${getContextMenuPillClass()}`}>
                  {getContextMenuLabel()}
                </span>
                <button
                  type="button"
                  class="action-button"
                  disabled={!desktopEnabled ||
                    !platformCapabilities.isWindows ||
                    registeringContextMenu ||
                    checkingContextMenu ||
                    contextMenuStatus?.registered}
                  on:click={registerWindowsContextMenu}
                >
                  {getContextMenuButtonLabel()}
                </button>
              </div>
            </div>
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
              <div class="setting-row">
                <div>
                  <span class="setting-label">连接测试</span>
                  <p>检查当前 PicGo 配置能否被 Nomo 调用。</p>
                </div>
                <button
                  type="button"
                  class="action-button"
                  disabled={!desktopEnabled || picgoTesting}
                  on:click={testPicgoConnection}
                >
                  {picgoTesting ? '测试中...' : '测试连接'}
                </button>
              </div>
            {/if}

            <div class="setting-row">
              <div>
                <label for="defaultImageWidth" class="setting-label">图片默认宽度</label>
                <p>插入图片时自动写入宽度属性，可填 640px、80% 或留空。</p>
              </div>
              <input
                id="defaultImageWidth"
                class="text-input compact"
                type="text"
                placeholder="留空"
                value={draftSettings.imageHandlingSettings.defaultImageWidth}
                on:input={(event) => updateImageStringSetting('defaultImageWidth', event)}
              />
            </div>
            <div class="setting-row">
              <div>
                <span class="setting-label">图片默认对齐</span>
                <p>插入图片时自动写入对齐属性。</p>
              </div>
              <div class="quad-control" role="group" aria-label="图片默认对齐">
                <button
                  type="button"
                  class:active={draftSettings.imageHandlingSettings.defaultImageAlign === 'none'}
                  aria-pressed={draftSettings.imageHandlingSettings.defaultImageAlign === 'none'}
                  on:click={() => setImageDefaultAlign('none')}>跟随正文</button
                >
                <button
                  type="button"
                  class:active={draftSettings.imageHandlingSettings.defaultImageAlign === 'left'}
                  aria-pressed={draftSettings.imageHandlingSettings.defaultImageAlign === 'left'}
                  on:click={() => setImageDefaultAlign('left')}>左对齐</button
                >
                <button
                  type="button"
                  class:active={draftSettings.imageHandlingSettings.defaultImageAlign === 'center'}
                  aria-pressed={draftSettings.imageHandlingSettings.defaultImageAlign === 'center'}
                  on:click={() => setImageDefaultAlign('center')}>居中</button
                >
                <button
                  type="button"
                  class:active={draftSettings.imageHandlingSettings.defaultImageAlign === 'right'}
                  aria-pressed={draftSettings.imageHandlingSettings.defaultImageAlign === 'right'}
                  on:click={() => setImageDefaultAlign('right')}>右对齐</button
                >
              </div>
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

            <div class="setting-row">
              <div>
                <label for="outlineDefaultExpandLevel" class="setting-label">大纲默认展开层级</label
                >
                <p>打开或切换文档时默认展示到指定标题层级。</p>
              </div>
              <div class="range-setting">
                <input
                  id="outlineDefaultExpandLevel"
                  type="range"
                  min="1"
                  max="6"
                  step="1"
                  value={draftSettings.outlineDefaultExpandLevel}
                  on:input={(event) => updateNumberSetting('outlineDefaultExpandLevel', event)}
                />
                <output for="outlineDefaultExpandLevel"
                  >H{draftSettings.outlineDefaultExpandLevel}</output
                >
              </div>
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

            <div class="shortcut-settings">
              <h2>自定义快捷键</h2>
              {#each shortcutItems as shortcut}
                <div class="setting-row compact-row">
                  <div>
                    <label for={`shortcut-${shortcut.id}`} class="setting-label"
                      >{shortcut.label}</label
                    >
                    <p>使用 Ctrl、Shift、Alt 与一个按键组合。</p>
                  </div>
                  <input
                    id={`shortcut-${shortcut.id}`}
                    class="text-input compact"
                    type="text"
                    spellcheck="false"
                    value={draftSettings.shortcutPreferences[shortcut.id]}
                    on:input={(event) => updateShortcut(shortcut.id, event)}
                  />
                </div>
              {/each}
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
            <div class="about-mark" aria-label="Nomo">
              <img class="logo-light" src={nomoLogoLight} alt="" draggable="false" />
              <img class="logo-dark" src={nomoLogoDark} alt="" draggable="false" />
            </div>
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

            <div class="disabled-row" aria-disabled="true">
              <div>
                <span class="setting-label">更新检查</span>
                <p>后续支持检查 Nomo 新版本并提示更新。</p>
              </div>
              <span class="disabled-pill">后续版本支持</span>
            </div>
          </div>
        {/if}
      </div>
    {/if}
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
    height: 42px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 14px;
    color: var(--md-editor-fg);
    font-size: 13px;
    font-weight: 700;
    border-bottom: 1px solid var(--md-editor-border);
    user-select: none;
  }

  .settings-brand-logo {
    width: 22px;
    height: 22px;
    position: relative;
    flex: 0 0 22px;
    display: inline-grid;
    place-items: center;
    overflow: hidden;
    border-radius: 6px;
  }

  .settings-brand-logo img,
  .about-mark img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    user-select: none;
    pointer-events: none;
  }

  .logo-dark {
    display: none;
  }

  :global(:root[data-theme='dark']) .logo-light {
    display: none;
  }

  :global(:root[data-theme='dark']) .logo-dark {
    display: block;
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
    grid-template-rows: auto minmax(0, 1fr);
    min-width: 0;
    min-height: 0;
    background: var(--md-editor-bg);
  }

  .settings-header {
    height: 42px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 0 0 0 16px;
    border-bottom: 1px solid var(--md-editor-border);
    user-select: none;
  }

  .settings-header-title {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .settings-header h1 {
    margin: 0;
    color: var(--md-editor-heading-fg);
    font-size: 14px;
    line-height: 1.2;
    font-weight: 700;
    letter-spacing: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .settings-header-title span {
    flex-shrink: 0;
    color: var(--md-editor-muted-fg);
    font-size: 12px;
    line-height: 1.2;
    opacity: 0;
    transition: opacity 160ms ease;
  }

  .settings-header-title span.visible {
    opacity: 1;
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
    margin-right: 14px;
  }

  .close-button:hover {
    background: var(--md-editor-surface);
    color: var(--md-editor-fg);
  }

  .settings-window-controls {
    display: flex;
    align-self: stretch;
    align-items: stretch;
    flex-shrink: 0;
  }

  .settings-control-button {
    width: 46px;
    height: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--md-editor-muted-fg);
    cursor: pointer;
    transition:
      background-color 150ms ease,
      color 150ms ease;
  }

  .settings-control-button:hover {
    background: rgba(128, 128, 128, 0.15);
    color: var(--md-editor-fg);
  }

  .settings-control-button.close:hover {
    background: #e81123;
    color: #ffffff;
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

  .compact-row {
    min-height: 54px;
    padding: 10px 0;
  }

  .shortcut-settings {
    display: grid;
    gap: 0;
    padding-top: 16px;
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
    max-width: 180px;
    justify-self: end;
  }

  .action-button {
    justify-self: end;
    min-width: 116px;
    height: 34px;
    padding: 0 12px;
    border: 1px solid var(--md-editor-border);
    border-radius: var(--md-editor-radius-sm);
    background: var(--md-editor-accent);
    color: #ffffff;
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition:
      opacity 160ms ease,
      transform 160ms ease,
      background-color 160ms ease;
  }

  .action-button:hover:not(:disabled) {
    opacity: 0.92;
  }

  .action-button:active:not(:disabled) {
    transform: translateY(1px);
  }

  .action-button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .association-action {
    justify-self: end;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    min-width: 0;
  }

  .association-pill {
    min-width: 62px;
    height: 26px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 9px;
    border: 1px solid var(--md-editor-border);
    border-radius: 999px;
    color: var(--md-editor-muted-fg);
    background: color-mix(in srgb, var(--md-editor-surface) 78%, transparent);
    font-size: 12px;
    font-weight: 750;
    line-height: 1;
    white-space: nowrap;
  }

  .association-pill.bound {
    border-color: color-mix(in srgb, #16a34a 58%, var(--md-editor-border));
    color: #15803d;
    background: color-mix(in srgb, #22c55e 12%, var(--md-editor-surface));
  }

  .association-pill.pending {
    border-color: color-mix(in srgb, #d97706 58%, var(--md-editor-border));
    color: #b45309;
    background: color-mix(in srgb, #f59e0b 12%, var(--md-editor-surface));
  }

  .association-pill.error {
    border-color: color-mix(in srgb, #dc2626 58%, var(--md-editor-border));
    color: #b91c1c;
    background: color-mix(in srgb, #ef4444 10%, var(--md-editor-surface));
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
    position: relative;
    display: inline-grid;
    place-items: center;
    margin: 2px 0 16px;
    border-radius: var(--md-editor-radius-md);
    overflow: hidden;
    background: color-mix(in srgb, var(--md-editor-surface) 88%, var(--md-editor-accent));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--md-editor-border) 72%, transparent);
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

    .association-action {
      justify-self: stretch;
      justify-content: space-between;
    }

    .settings-content {
      padding: 18px;
    }
  }
</style>
