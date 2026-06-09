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
    type InterfaceLanguagePreference,
    type ShortcutCommandId,
    type ThemePreference,
    type WritingStatsMetric,
  } from '../services/settings';
  import {
    INTERFACE_LANGUAGE_OPTIONS,
    applyInterfaceLanguagePreference,
    getDiagramTypeLabel,
    t,
    type EffectiveInterfaceLocale,
  } from '../i18n';
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
    { id: 'general' as const, labelKey: 'settingsCategoryGeneral', icon: Settings2 },
    { id: 'editor' as const, labelKey: 'settingsCategoryEditor', icon: BookOpenText },
    { id: 'appearance' as const, labelKey: 'settingsCategoryAppearance', icon: Palette },
    { id: 'files' as const, labelKey: 'settingsCategoryFiles', icon: FolderOpen },
    { id: 'images' as const, labelKey: 'settingsCategoryImages', icon: FileImage },
    { id: 'stats' as const, labelKey: 'settingsCategoryStats', icon: BarChart3 },
    { id: 'advanced' as const, labelKey: 'settingsCategoryAdvanced', icon: SlidersHorizontal },
    { id: 'about' as const, labelKey: 'settingsCategoryAbout', icon: Info },
  ];

  let activeCategory: CategoryId = 'general';
  let draftSettings: AppPreferences = { ...DEFAULT_APP_PREFERENCES };
  let interfaceLocale: EffectiveInterfaceLocale = applyInterfaceLanguagePreference(
    draftSettings.interfaceLanguage,
  );
  $: categoryTitles = createCategoryTitles(interfaceLocale);
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
  let filesIntegrationStatusRequested = false;

  function createCategoryTitles(_locale: EffectiveInterfaceLocale): Record<CategoryId, string> {
    return {
      general: t.settingsCategoryGeneral(),
      editor: t.settingsCategoryEditor(),
      appearance: t.settingsCategoryAppearance(),
      files: t.settingsCategoryFiles(),
      images: t.settingsCategoryImages(),
      stats: t.settingsCategoryStats(),
      advanced: t.settingsCategoryAdvanced(),
      about: t.settingsCategoryAboutTitle(),
    };
  }

  const shortcutItems: Array<{ id: ShortcutCommandId; labelKey: string }> = [
    { id: 'new-file', labelKey: 'newMarkdown' },
    { id: 'open-file', labelKey: 'openFile' },
    { id: 'save-file', labelKey: 'save' },
    { id: 'toggle-source', labelKey: 'toggleSourceMode' },
    { id: 'toggle-theme', labelKey: 'toggleThemeLightDark' },
    { id: 'toggle-focus', labelKey: 'showHideExplorer' },
    { id: 'insert-code-block', labelKey: 'insertCodeBlock' },
    { id: 'insert-table', labelKey: 'insertTable' },
    { id: 'insert-math-block', labelKey: 'insertMathBlock' },
    { id: 'menu-link', labelKey: 'editLink' },
    { id: 'menu-clear-format', labelKey: 'clearStyle' },
  ];

  onMount(() => {
    desktopEnabled = isTauriRuntime();
    platformCapabilities = getPlatformCapabilities();
    void loadPreferences();
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

  function selectCategory(categoryId: CategoryId) {
    activeCategory = categoryId;
    if (categoryId === 'files') {
      void ensureFilesIntegrationStatus();
    }
  }

  async function ensureFilesIntegrationStatus() {
    if (filesIntegrationStatusRequested) {
      return;
    }

    filesIntegrationStatusRequested = true;
    await Promise.all([
      refreshMarkdownAssociationStatus(),
      refreshWindowsContextMenuStatus(),
    ]);
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
            showStatus(t.settingsSaved());
          } catch (error) {
            showStatus(error instanceof Error ? error.message : t.settingsSaveFailed());
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
    showStatus(t.settingsSaving());
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
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('refresh_interface_language_chrome').catch(() => undefined);
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
    interfaceLocale = applyInterfaceLanguagePreference(settings.interfaceLanguage);
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

  function setInterfaceLanguage(interfaceLanguage: InterfaceLanguagePreference) {
    updateDraft({ interfaceLanguage });
  }

  function handleInterfaceLanguageChange(event: Event) {
    const nextLanguage = (event.currentTarget as HTMLSelectElement).value;
    if (nextLanguage === 'system' || INTERFACE_LANGUAGE_OPTIONS.some((item) => item.value === nextLanguage)) {
      setInterfaceLanguage(nextLanguage as InterfaceLanguagePreference);
    }
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
      return t.unsupported();
    }
    if (checkingMdAssociation && !mdAssociationStatus) {
      return t.checking();
    }
    if (mdAssociationError) {
      return t.checkFailed();
    }
    if (mdAssociationStatus?.is_default) {
      return t.bound();
    }
    if (mdAssociationStatus?.registered) {
      return t.pendingSelection();
    }
    return t.unbound();
  }

  function getMarkdownAssociationDescription() {
    if (!desktopEnabled) {
      return t.mdAssociationDesktopOnly();
    }
    if (!platformCapabilities.isWindows) {
      return t.mdAssociationWindowsOnly();
    }
    if (mdAssociationError) {
      return mdAssociationError;
    }
    if (checkingMdAssociation && !mdAssociationStatus) {
      return t.mdAssociationCheckingDescription();
    }
    return (
      mdAssociationStatus?.message ??
      t.mdAssociationDefaultDescription()
    );
  }

  function getMarkdownAssociationButtonLabel() {
    if (bindingMdAssociation) {
      return t.opening();
    }
    if (mdAssociationStatus?.is_default) {
      return t.bound();
    }
    if (mdAssociationStatus?.registered) {
      return t.chooseNomo();
    }
    return t.bindMd();
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
      return t.unsupported();
    }
    if (checkingContextMenu && !contextMenuStatus) {
      return t.checking();
    }
    if (contextMenuError) {
      return t.checkFailed();
    }
    return contextMenuStatus?.registered ? t.registered() : t.unregistered();
  }

  function getContextMenuDescription() {
    if (!desktopEnabled) {
      return t.contextMenuDesktopOnly();
    }
    if (!platformCapabilities.isWindows) {
      return t.contextMenuWindowsOnly();
    }
    if (contextMenuError) {
      return contextMenuError;
    }
    if (checkingContextMenu && !contextMenuStatus) {
      return t.contextMenuCheckingDescription();
    }
    return (
      contextMenuStatus?.message ?? t.contextMenuDefaultDescription()
    );
  }

  function getContextMenuButtonLabel() {
    if (registeringContextMenu) {
      return t.registering();
    }
    if (contextMenuStatus?.registered) {
      return t.registered();
    }
    return t.registerContextMenu();
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
  {#key interfaceLocale}
    <title>{t.settingsWindowTitle()}</title>
  {/key}
</svelte:head>

{#key interfaceLocale}
<div class="settings-window-shell" data-interface-locale={interfaceLocale}>
  <aside class="settings-nav" aria-label={t.settingsTitle()}>
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
      <span>{t.settingsTitle()}</span>
    </div>

    <nav>
      {#each categories as category}
        <button
          type="button"
          class:active={activeCategory === category.id}
          aria-label={t[category.labelKey]()}
          aria-current={activeCategory === category.id ? 'page' : undefined}
          on:click={() => {
            selectCategory(category.id);
          }}
        >
          <svelte:component this={category.icon} size={16} aria-hidden="true" />
          <span>{t[category.labelKey]()}</span>
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
        <div class="settings-window-controls" aria-label={t.windowControls()}>
          <button
            type="button"
            class="settings-control-button"
            title={t.minimize()}
            aria-label={t.minimize()}
            on:click={minimizeCurrentWindow}
          >
            <svg width="10" height="1" viewBox="0 0 10 1" aria-hidden="true">
              <line x1="0" y1="0.5" x2="10" y2="0.5" stroke="currentColor" stroke-width="1.5" />
            </svg>
          </button>
          <button
            type="button"
            class="settings-control-button close"
            title={t.close()}
            aria-label={t.close()}
            on:click={handleClose}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      {:else if !desktopEnabled}
        <button type="button" class="close-button" aria-label={t.close()} on:click={handleClose}>
          <X size={18} />
        </button>
      {/if}
    </header>

    {#if !loaded}
      <div class="settings-loading" role="status">{t.settingsLoading()}</div>
    {:else}
      <div class="settings-content">
        {#if activeCategory === 'general'}
          <div class="settings-group">
            <h2>{t.basicBehavior()}</h2>
            <div class="setting-row">
              <div>
                <span class="setting-label">{t.theme()}</span>
                <p>{t.themeDescription()}</p>
              </div>
              <div class="triple-control" role="group" aria-label={t.theme()}>
                <button
                  type="button"
                  class:active={draftSettings.theme === 'light'}
                  aria-pressed={draftSettings.theme === 'light'}
                  on:click={() => setTheme('light')}>{t.themeLight()}</button
                >
                <button
                  type="button"
                  class:active={draftSettings.theme === 'dark'}
                  aria-pressed={draftSettings.theme === 'dark'}
                  on:click={() => setTheme('dark')}>{t.themeDark()}</button
                >
                <button
                  type="button"
                  class:active={draftSettings.theme === 'system'}
                  aria-pressed={draftSettings.theme === 'system'}
                  on:click={() => setTheme('system')}>{t.themeSystem()}</button
                >
              </div>
            </div>

            <div class="setting-row">
              <div>
                <span class="setting-label">{t.editorModeDefault()}</span>
                <p>{t.editorModeDefaultDescription()}</p>
              </div>
              <div class="segmented-control" role="group" aria-label={t.editorModeDefault()}>
                <button
                  type="button"
                  class:active={draftSettings.editorMode === 'semantic'}
                  aria-pressed={draftSettings.editorMode === 'semantic'}
                  on:click={() => setEditorMode('semantic')}>{t.semanticEditing()}</button
                >
                <button
                  type="button"
                  class:active={draftSettings.editorMode === 'source'}
                  aria-pressed={draftSettings.editorMode === 'source'}
                  on:click={() => setEditorMode('source')}>{t.sourceMode()}</button
                >
              </div>
            </div>

            <label class="toggle-row" for="autoSaveEnabled">
              <span>
                <span class="toggle-title">{t.autoSave()}</span>
                <span class="toggle-desc">{t.autoSaveDescription()}</span>
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
                <label for="autoSaveDelayMs" class="setting-label">{t.autoSaveDelay()}</label>
                <p>{t.autoSaveDelayDescription()}</p>
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
                <span class="toggle-title">{t.createSnapshotBeforeSave()}</span>
                <span class="toggle-desc">{t.createSnapshotBeforeSaveDescription()}</span>
              </span>
              <input
                id="createSnapshotBeforeSave"
                type="checkbox"
                checked={draftSettings.createSnapshotBeforeSave}
                on:change={(event) => toggleSetting('createSnapshotBeforeSave', event)}
              />
              <span class="toggle-switch" aria-hidden="true"></span>
            </label>

            <div class="setting-row">
              <div>
                <span class="setting-label">{t.interfaceLanguage()}</span>
                <p>{t.interfaceLanguageDescription()}</p>
              </div>
              <select
                class="select-input"
                aria-label={t.interfaceLanguage()}
                value={draftSettings.interfaceLanguage}
                on:change={handleInterfaceLanguageChange}
              >
                {#each INTERFACE_LANGUAGE_OPTIONS as language}
                  <option value={language.value}>{t[language.labelKey]()}</option>
                {/each}
              </select>
            </div>
          </div>
        {:else if activeCategory === 'editor'}
          <div class="settings-group">
            <h2>{t.editorScale()}</h2>
            <div class="setting-row">
              <div>
                <label for="fontSize" class="setting-label">{t.fontSize()}</label>
                <p>{t.fontSizeDescription()}</p>
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
                <label for="lineHeight" class="setting-label">{t.lineHeight()}</label>
                <p>{t.lineHeightDescription()}</p>
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
                <label for="contentWidthPercent" class="setting-label">{t.contentWidth()}</label>
                <p>{t.contentWidthDescription()}</p>
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
                <span class="setting-label">{t.calloutStyle()}</span>
                <p>{t.calloutStyleDescription()}</p>
              </div>
              <div class="segmented-control" role="group" aria-label={t.calloutStyle()}>
                <button
                  type="button"
                  class:active={draftSettings.blockStyle === 'classic'}
                  aria-pressed={draftSettings.blockStyle === 'classic'}
                  on:click={() => setBlockStyle('classic')}>{t.classic()}</button
                >
                <button
                  type="button"
                  class:active={draftSettings.blockStyle === 'modern'}
                  aria-pressed={draftSettings.blockStyle === 'modern'}
                  on:click={() => setBlockStyle('modern')}>{t.modern()}</button
                >
              </div>
            </div>

            <div class="setting-row">
              <div>
                <label for="largeDocumentLimit" class="setting-label">{t.largeDocumentLimit()}</label>
                <p>{t.largeDocumentLimitDescription()}</p>
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
                <span>{t.charByte()}</span>
              </div>
            </div>

            <div class="setting-row">
              <div>
                <span class="setting-label">{t.defaultIndent()}</span>
                <p>{t.defaultIndentDescription()}</p>
              </div>
              <div class="triple-control" role="group" aria-label={t.defaultIndent()}>
                <button
                  type="button"
                  class:active={draftSettings.codeBlockIndent === 'spaces-2'}
                  aria-pressed={draftSettings.codeBlockIndent === 'spaces-2'}
                  on:click={() => setCodeBlockIndent('spaces-2')}>{t.twoSpaces()}</button
                >
                <button
                  type="button"
                  class:active={draftSettings.codeBlockIndent === 'spaces-4'}
                  aria-pressed={draftSettings.codeBlockIndent === 'spaces-4'}
                  on:click={() => setCodeBlockIndent('spaces-4')}>{t.fourSpaces()}</button
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
                <span class="toggle-title">{t.codeBlockLineNumbers()}</span>
                <span class="toggle-desc">{t.codeBlockLineNumbersDescription()}</span>
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
                <span class="toggle-title">{t.inlineCodeRendering()}</span>
                <span class="toggle-desc">{t.inlineCodeRenderingDescription()}</span>
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
            <h2>{t.visualZoom()}</h2>
            <div class="setting-row">
              <div>
                <label for="zoomPercent" class="setting-label">{t.zoomLevel()}</label>
                <p>{t.zoomLevelDescription()}</p>
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
                <span class="toggle-title">{t.ctrlWheelZoom()}</span>
                <span class="toggle-desc">{t.ctrlWheelZoomDescription()}</span>
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
                <span class="setting-label">{t.customCssTheme()}</span>
                <p>{t.customCssThemeDescription()}</p>
              </div>
              <span class="disabled-pill">{t.futureVersionSupport()}</span>
            </div>
          </div>
        {:else if activeCategory === 'files'}
          <div class="settings-group">
            <h2>{t.filesAndWindows()}</h2>
            <div class="setting-row">
              <div>
                <span class="setting-label">{t.folderOpenDefaultBehavior()}</span>
                <p>{t.folderOpenDefaultBehaviorDescription()}</p>
              </div>
              <div class="triple-control" role="group" aria-label={t.folderOpenDefaultBehavior()}>
                <button
                  type="button"
                  class:active={draftSettings.folderOpenDefaultBehavior === 'ask-every-time'}
                  aria-pressed={draftSettings.folderOpenDefaultBehavior === 'ask-every-time'}
                  on:click={() => setFolderBehavior('ask-every-time')}>{t.askEveryTime()}</button
                >
                <button
                  type="button"
                  class:active={draftSettings.folderOpenDefaultBehavior === 'current-window'}
                  aria-pressed={draftSettings.folderOpenDefaultBehavior === 'current-window'}
                  on:click={() => setFolderBehavior('current-window')}>{t.currentWindow()}</button
                >
                <button
                  type="button"
                  class:active={draftSettings.folderOpenDefaultBehavior === 'new-window'}
                  aria-pressed={draftSettings.folderOpenDefaultBehavior === 'new-window'}
                  on:click={() => setFolderBehavior('new-window')}>{t.newWindow()}</button
                >
              </div>
            </div>

            <label class="toggle-row" for="filePreviewEnabled">
              <span>
                <span class="toggle-title">{t.filePreviewTab()}</span>
                <span class="toggle-desc">{t.filePreviewTabDescription()}</span>
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
                <span class="toggle-title">{t.hideExplorerOnLaunch()}</span>
                <span class="toggle-desc">{t.hideExplorerOnLaunchDescription()}</span>
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
                <span class="toggle-title">{t.closeToTray()}</span>
                <span class="toggle-desc">{t.closeToTrayDescription()}</span>
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
                <span class="setting-label">{t.bindMdDefaultApp()}</span>
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
                <span class="setting-label">{t.registerMdContextMenu()}</span>
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
            <h2>{t.imageImport()}</h2>
            <div class="setting-row">
              <div>
                <span class="setting-label">{t.imageHandlingStrategy()}</span>
                <p>{t.imageHandlingStrategyDescription()}</p>
              </div>
              <div class="quad-control" role="group" aria-label={t.imageHandlingStrategy()}>
                <button
                  type="button"
                  class:active={draftSettings.imageHandlingSettings.imageInsertStrategy ===
                    'copy-current-folder'}
                  aria-pressed={draftSettings.imageHandlingSettings.imageInsertStrategy ===
                    'copy-current-folder'}
                  on:click={() => setImageStrategy('copy-current-folder')}>{t.currentFolder()}</button
                >
                <button
                  type="button"
                  class:active={draftSettings.imageHandlingSettings.imageInsertStrategy ===
                    'copy-assets'}
                  aria-pressed={draftSettings.imageHandlingSettings.imageInsertStrategy ===
                    'copy-assets'}
                  on:click={() => setImageStrategy('copy-assets')}>{t.assetsFolder()}</button
                >
                <button
                  type="button"
                  class:active={draftSettings.imageHandlingSettings.imageInsertStrategy ===
                    'copy-document-assets'}
                  aria-pressed={draftSettings.imageHandlingSettings.imageInsertStrategy ===
                    'copy-document-assets'}
                  on:click={() => setImageStrategy('copy-document-assets')}>{t.documentAssetsFolder()}</button
                >
                <button
                  type="button"
                  class:active={draftSettings.imageHandlingSettings.imageInsertStrategy ===
                    'upload'}
                  aria-pressed={draftSettings.imageHandlingSettings.imageInsertStrategy ===
                    'upload'}
                  on:click={() => setImageStrategy('upload')}>{t.upload()}</button
                >
              </div>
            </div>

            <label class="toggle-row" for="autoDeleteUnusedLocalImages">
              <span>
                <span class="toggle-title">{t.autoCleanLocalImages()}</span>
                <span class="toggle-desc">{t.autoCleanLocalImagesDescription()}</span>
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
                  <span class="setting-label">{t.uploadProvider()}</span>
                  <p>{t.uploadProviderDescription()}</p>
                </div>
                <div class="segmented-control" role="group" aria-label={t.uploadProvider()}>
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
                    <label for="picgoServerUrl" class="setting-label">{t.picgoServerUrl()}</label>
                    <p>{t.picgoServerUrlDescription()}</p>
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
                    <label for="picgoCoreCommand" class="setting-label">{t.picgoCoreCommand()}</label>
                    <p>{t.picgoCoreCommandDescription()}</p>
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
                      >{t.picgoCoreConfigPath()}</label
                    >
                    <p>{t.picgoCoreConfigPathDescription()}</p>
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
                  <span class="setting-label">{t.connectionTest()}</span>
                  <p>{t.connectionTestDescription()}</p>
                </div>
                <button
                  type="button"
                  class="action-button"
                  disabled={!desktopEnabled || picgoTesting}
                  on:click={testPicgoConnection}
                >
                  {picgoTesting ? t.testing() : t.testConnection()}
                </button>
              </div>
            {/if}

            <div class="setting-row">
              <div>
                <label for="defaultImageWidth" class="setting-label">{t.imageDefaultWidth()}</label>
                <p>{t.imageDefaultWidthDescription()}</p>
              </div>
              <input
                id="defaultImageWidth"
                class="text-input compact"
                type="text"
                placeholder={t.emptyPlaceholder()}
                value={draftSettings.imageHandlingSettings.defaultImageWidth}
                on:input={(event) => updateImageStringSetting('defaultImageWidth', event)}
              />
            </div>
            <div class="setting-row">
              <div>
                <span class="setting-label">{t.imageDefaultAlign()}</span>
                <p>{t.imageDefaultAlignDescription()}</p>
              </div>
              <div class="quad-control" role="group" aria-label={t.imageDefaultAlign()}>
                <button
                  type="button"
                  class:active={draftSettings.imageHandlingSettings.defaultImageAlign === 'none'}
                  aria-pressed={draftSettings.imageHandlingSettings.defaultImageAlign === 'none'}
                  on:click={() => setImageDefaultAlign('none')}>{t.followText()}</button
                >
                <button
                  type="button"
                  class:active={draftSettings.imageHandlingSettings.defaultImageAlign === 'left'}
                  aria-pressed={draftSettings.imageHandlingSettings.defaultImageAlign === 'left'}
                  on:click={() => setImageDefaultAlign('left')}>{t.alignLeft()}</button
                >
                <button
                  type="button"
                  class:active={draftSettings.imageHandlingSettings.defaultImageAlign === 'center'}
                  aria-pressed={draftSettings.imageHandlingSettings.defaultImageAlign === 'center'}
                  on:click={() => setImageDefaultAlign('center')}>{t.alignCenter()}</button
                >
                <button
                  type="button"
                  class:active={draftSettings.imageHandlingSettings.defaultImageAlign === 'right'}
                  aria-pressed={draftSettings.imageHandlingSettings.defaultImageAlign === 'right'}
                  on:click={() => setImageDefaultAlign('right')}>{t.alignRight()}</button
                >
              </div>
            </div>
          </div>
        {:else if activeCategory === 'stats'}
          <div class="settings-group">
            <h2>{t.statsAndNavigation()}</h2>
            <label class="toggle-row" for="outlineVisible">
              <span>
                <span class="toggle-title">{t.showDocumentOutline()}</span>
                <span class="toggle-desc">{t.showDocumentOutlineDescription()}</span>
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
                <span class="toggle-title">{t.showDocumentStats()}</span>
                <span class="toggle-desc">{t.showDocumentStatsDescription()}</span>
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
                <span class="setting-label">{t.defaultStatsMetric()}</span>
                <p>{t.defaultStatsMetricDescription()}</p>
              </div>
              <div class="triple-control" role="group" aria-label={t.defaultStatsMetric()}>
                <button
                  type="button"
                  class:active={draftSettings.writingStatsMetric === 'lines'}
                  aria-pressed={draftSettings.writingStatsMetric === 'lines'}
                  on:click={() => setStatsMetric('lines')}>{t.lines()}</button
                >
                <button
                  type="button"
                  class:active={draftSettings.writingStatsMetric === 'words'}
                  aria-pressed={draftSettings.writingStatsMetric === 'words'}
                  on:click={() => setStatsMetric('words')}>{t.words()}</button
                >
                <button
                  type="button"
                  class:active={draftSettings.writingStatsMetric === 'chars'}
                  aria-pressed={draftSettings.writingStatsMetric === 'chars'}
                  on:click={() => setStatsMetric('chars')}>{t.chars()}</button
                >
              </div>
            </div>

            <label class="toggle-row" for="readingTimeVisible">
              <span>
                <span class="toggle-title">{t.readingTime()}</span>
                <span class="toggle-desc">{t.readingTimeDescription()}</span>
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
                <label for="outlineDefaultExpandLevel" class="setting-label">{t.outlineDefaultExpandLevel()}</label
                >
                <p>{t.outlineDefaultExpandLevelDescription()}</p>
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
            <h2>{t.defaultInsertBehavior()}</h2>
            <div class="setting-row">
              <div>
                <label for="defaultCodeBlockLanguage" class="setting-label">{t.defaultCodeBlockLanguage()}</label>
                <p>{t.defaultCodeBlockLanguageDescription()}</p>
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
                <label for="defaultDiagramType" class="setting-label">{t.defaultDiagramType()}</label>
                <p>{t.defaultDiagramTypeDescription()}</p>
              </div>
              <select
                id="defaultDiagramType"
                class="select-input"
                value={draftSettings.defaultDiagramType}
                on:change={(event) => updateStringSetting('defaultDiagramType', event)}
              >
                {#each DIAGRAM_TEMPLATES as template}
                  <option value={template.type}>{getDiagramTypeLabel(template.type)}</option>
                {/each}
              </select>
            </div>

            <div class="shortcut-settings">
              <h2>{t.customShortcuts()}</h2>
              {#each shortcutItems as shortcut}
                <div class="setting-row compact-row">
                  <div>
                    <label for={`shortcut-${shortcut.id}`} class="setting-label"
                      >{t[shortcut.labelKey]()}</label
                    >
                    <p>{t.shortcutDescription()}</p>
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
                <span class="setting-label">{t.exportSettings()}</span>
                <p>{t.exportSettingsDescription()}</p>
              </div>
              <span class="disabled-pill">{t.futureVersionSupport()}</span>
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
                <dt>{t.version()}</dt>
                <dd>{packageInfo.version}</dd>
              </div>
              <div>
                <dt>{t.positioning()}</dt>
                <dd>{t.positioningDescription()}</dd>
              </div>
              <div>
                <dt>{t.platformStrategy()}</dt>
                <dd>{t.platformStrategyDescription()}</dd>
              </div>
            </dl>

            <div class="disabled-row" aria-disabled="true">
              <div>
                <span class="setting-label">{t.updateCheck()}</span>
                <p>{t.updateCheckDescription()}</p>
              </div>
              <span class="disabled-pill">{t.futureVersionSupport()}</span>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </section>
</div>
{/key}

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
