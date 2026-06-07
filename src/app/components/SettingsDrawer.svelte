<script lang="ts">
  import { X } from '@lucide/svelte';
  import { fade, slide } from 'svelte/transition';
  import type { EditorMode } from '../../lib/editor-core';
  import type {
    ImageHandlingSettings,
    ImageInsertStrategy,
    ImageUploadProvider,
  } from '../../lib/services/render';
  import { normalizeImageSettings } from '../services/settings';

  interface EditorAppearanceSettings {
    fontSize: number;
    lineHeight: number;
    blockStyle: 'classic' | 'modern';
  }

  interface WorkspaceBehaviorSettings {
    folderOpenDefaultBehavior: 'current-window' | 'new-window' | 'ask-every-time';
    filePreviewEnabled: boolean;
    autoSaveEnabled: boolean;
    closeToTrayEnabled: boolean;
    editorMode: EditorMode;
    sidebarHidden: boolean;
    outlineVisible: boolean;
  }

  export let isOpen: boolean;
  export let imageSettings: ImageHandlingSettings;
  export let fontSize: number;
  export let lineHeight: number;
  export let blockStyle: 'classic' | 'modern';
  export let filePreviewEnabled: boolean;
  export let autoSaveEnabled: boolean;
  export let closeToTrayEnabled: boolean;
  export let editorMode: EditorMode;
  export let sidebarHidden: boolean;
  export let outlineVisible: boolean;
  export let folderOpenDefaultBehavior: 'current-window' | 'new-window' | 'ask-every-time';
  export let closeSettings: () => void;
  export let saveSettings: (
    nextImageSettings: ImageHandlingSettings,
    nextAppearanceSettings: EditorAppearanceSettings,
    nextWorkspaceBehaviorSettings: WorkspaceBehaviorSettings,
  ) => void;

  let draftImageSettings: ImageHandlingSettings = normalizeImageSettings(imageSettings);
  let draftFontSize: number = fontSize;
  let draftLineHeight: number = lineHeight;
  let draftBlockStyle: 'classic' | 'modern' = blockStyle;
  let draftFilePreviewEnabled = filePreviewEnabled;
  let draftAutoSaveEnabled = autoSaveEnabled;
  let draftCloseToTrayEnabled = closeToTrayEnabled;
  let draftEditorMode: EditorMode = editorMode;
  let draftSidebarHidden = sidebarHidden;
  let draftOutlineVisible = outlineVisible;
  let draftFolderBehavior: 'current-window' | 'new-window' | 'ask-every-time' =
    folderOpenDefaultBehavior;

  // Whenever the drawer opens, reset draft settings to the current persisted values.
  $: if (isOpen) {
    draftImageSettings = normalizeImageSettings(imageSettings);
    draftFontSize = fontSize;
    draftLineHeight = lineHeight;
    draftBlockStyle = blockStyle;
    draftFilePreviewEnabled = filePreviewEnabled;
    draftAutoSaveEnabled = autoSaveEnabled;
    draftCloseToTrayEnabled = closeToTrayEnabled;
    draftEditorMode = editorMode;
    draftSidebarHidden = sidebarHidden;
    draftOutlineVisible = outlineVisible;
    draftFolderBehavior = folderOpenDefaultBehavior;
  }

  function handleSave() {
    saveSettings(
      normalizeImageSettings(draftImageSettings),
      {
        fontSize: draftFontSize,
        lineHeight: draftLineHeight,
        blockStyle: draftBlockStyle,
      },
      {
        folderOpenDefaultBehavior: draftFolderBehavior,
        filePreviewEnabled: draftFilePreviewEnabled,
        autoSaveEnabled: draftAutoSaveEnabled,
        closeToTrayEnabled: draftCloseToTrayEnabled,
        editorMode: draftEditorMode,
        sidebarHidden: draftSidebarHidden,
        outlineVisible: draftOutlineVisible,
      },
    );
  }

  function setDraftFolderBehavior(value: 'current-window' | 'new-window' | 'ask-every-time') {
    draftFolderBehavior = value;
  }

  function toggleFilePreviewEnabled(event: Event) {
    draftFilePreviewEnabled = (event.currentTarget as HTMLInputElement).checked;
  }

  function toggleAutoSaveEnabled(event: Event) {
    draftAutoSaveEnabled = (event.currentTarget as HTMLInputElement).checked;
  }

  function toggleCloseToTrayEnabled(event: Event) {
    draftCloseToTrayEnabled = (event.currentTarget as HTMLInputElement).checked;
  }

  function setDraftEditorMode(nextMode: EditorMode) {
    draftEditorMode = nextMode;
  }

  function toggleSidebarHidden(event: Event) {
    draftSidebarHidden = (event.currentTarget as HTMLInputElement).checked;
  }

  function toggleOutlineVisible(event: Event) {
    draftOutlineVisible = (event.currentTarget as HTMLInputElement).checked;
  }

  function setImageStrategy(strategy: ImageInsertStrategy) {
    draftImageSettings = {
      ...draftImageSettings,
      imageInsertStrategy: strategy,
    };
  }

  function toggleAutoDeleteUnusedLocalImages(event: Event) {
    draftImageSettings = {
      ...draftImageSettings,
      autoDeleteUnusedLocalImages: (event.currentTarget as HTMLInputElement).checked,
    };
  }

  function setUploadProvider(provider: ImageUploadProvider) {
    draftImageSettings = {
      ...draftImageSettings,
      uploadProvider: provider,
    };
  }

  function updatePicgoServerUrl(event: Event) {
    draftImageSettings = {
      ...draftImageSettings,
      picgoServerUrl: (event.currentTarget as HTMLInputElement).value,
    };
  }

  function updatePicgoCoreCommand(event: Event) {
    draftImageSettings = {
      ...draftImageSettings,
      picgoCoreCommand: (event.currentTarget as HTMLInputElement).value,
    };
  }

  function updatePicgoCoreConfigPath(event: Event) {
    draftImageSettings = {
      ...draftImageSettings,
      picgoCoreConfigPath: (event.currentTarget as HTMLInputElement).value,
    };
  }

  function updateDraftFontSize(event: Event) {
    draftFontSize = Number((event.currentTarget as HTMLInputElement).value);
  }

  function updateDraftLineHeight(event: Event) {
    draftLineHeight = Number((event.currentTarget as HTMLInputElement).value);
  }

  function setDraftBlockStyle(nextBlockStyle: 'classic' | 'modern') {
    draftBlockStyle = nextBlockStyle;
  }
</script>

{#if isOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="settings-backdrop" transition:fade={{ duration: 200 }} on:click={closeSettings}>
    <div
      class="settings-drawer"
      transition:slide={{ axis: 'x', duration: 300 }}
      on:click|stopPropagation
    >
      <header class="drawer-header">
        <button type="button" class="icon-btn exit-btn" on:click={closeSettings} title="关闭设置">
          <X size={18} />
        </button>
        <h2>偏好设置</h2>
      </header>

      <div class="drawer-body">
        <section class="setting-group" aria-labelledby="folderBehaviorTitle">
          <div class="setting-heading">
            <h3 id="folderBehaviorTitle">文件与窗口</h3>
            <p>选择打开文件夹时的默认行为。</p>
          </div>

          <div class="setting-field">
            <span class="setting-label">打开文件夹默认行为</span>
            <div class="folder-behavior-options" role="group" aria-label="打开文件夹默认行为">
              <button
                type="button"
                class:active={draftFolderBehavior === 'ask-every-time'}
                aria-pressed={draftFolderBehavior === 'ask-every-time'}
                on:click={() => setDraftFolderBehavior('ask-every-time')}
              >
                每次询问
              </button>
              <button
                type="button"
                class:active={draftFolderBehavior === 'current-window'}
                aria-pressed={draftFolderBehavior === 'current-window'}
                on:click={() => setDraftFolderBehavior('current-window')}
              >
                当前窗口
              </button>
              <button
                type="button"
                class:active={draftFolderBehavior === 'new-window'}
                aria-pressed={draftFolderBehavior === 'new-window'}
                on:click={() => setDraftFolderBehavior('new-window')}
              >
                新窗口
              </button>
            </div>
          </div>

          <div class="setting-field">
            <span class="setting-label">默认编辑模式</span>
            <div class="segmented-control" role="group" aria-label="默认编辑模式">
              <button
                type="button"
                class:active={draftEditorMode === 'semantic'}
                aria-pressed={draftEditorMode === 'semantic'}
                on:click={() => setDraftEditorMode('semantic')}
              >
                语义编辑
              </button>
              <button
                type="button"
                class:active={draftEditorMode === 'source'}
                aria-pressed={draftEditorMode === 'source'}
                on:click={() => setDraftEditorMode('source')}
              >
                源码模式
              </button>
            </div>
          </div>

          <label class="toggle-setting" for="filePreviewEnabled">
            <span>
              <span class="toggle-title">文件预览标签</span>
              <span class="toggle-desc">单击文件时复用预览标签，编辑或双击后固定。</span>
            </span>
            <input
              id="filePreviewEnabled"
              type="checkbox"
              checked={draftFilePreviewEnabled}
              on:change={toggleFilePreviewEnabled}
            />
            <span class="toggle-switch" aria-hidden="true"></span>
          </label>

          <label class="toggle-setting" for="sidebarHidden">
            <span>
              <span class="toggle-title">隐藏资源管理器侧边栏</span>
              <span class="toggle-desc">启动后保持侧边栏收起，释放正文编辑空间。</span>
            </span>
            <input
              id="sidebarHidden"
              type="checkbox"
              checked={draftSidebarHidden}
              on:change={toggleSidebarHidden}
            />
            <span class="toggle-switch" aria-hidden="true"></span>
          </label>

          <label class="toggle-setting" for="outlineVisible">
            <span>
              <span class="toggle-title">显示文档大纲</span>
              <span class="toggle-desc">在编辑区右侧显示当前文档标题导航。</span>
            </span>
            <input
              id="outlineVisible"
              type="checkbox"
              checked={draftOutlineVisible}
              on:change={toggleOutlineVisible}
            />
            <span class="toggle-switch" aria-hidden="true"></span>
          </label>

          <label class="toggle-setting" for="autoSaveEnabled">
            <span>
              <span class="toggle-title">自动保存</span>
              <span class="toggle-desc">编辑后自动写入当前本地文件，默认关闭。</span>
            </span>
            <input
              id="autoSaveEnabled"
              type="checkbox"
              checked={draftAutoSaveEnabled}
              on:change={toggleAutoSaveEnabled}
            />
            <span class="toggle-switch" aria-hidden="true"></span>
          </label>

          <label class="toggle-setting" for="closeToTrayEnabled">
            <span>
              <span class="toggle-title">关闭到托盘</span>
              <span class="toggle-desc">点击关闭时隐藏窗口，托盘双击或右键菜单可重新打开。</span>
            </span>
            <input
              id="closeToTrayEnabled"
              type="checkbox"
              checked={draftCloseToTrayEnabled}
              on:change={toggleCloseToTrayEnabled}
            />
            <span class="toggle-switch" aria-hidden="true"></span>
          </label>
        </section>

        <section
          class="setting-group appearance-setting-group"
          aria-labelledby="appearanceSettingsTitle"
        >
          <div class="setting-heading">
            <h3 id="appearanceSettingsTitle">编辑器外观</h3>
            <p>调整正文阅读尺度，以及引用和提示块的显示风格。</p>
          </div>

          <div class="setting-field">
            <label for="editorFontSize">字号</label>
            <div class="range-setting">
              <input
                id="editorFontSize"
                type="range"
                min="14"
                max="22"
                step="1"
                value={draftFontSize}
                on:input={updateDraftFontSize}
              />
              <output for="editorFontSize">{draftFontSize}px</output>
            </div>
          </div>

          <div class="setting-field">
            <label for="editorLineHeight">行高</label>
            <div class="range-setting">
              <input
                id="editorLineHeight"
                type="range"
                min="1.4"
                max="2.1"
                step="0.05"
                value={draftLineHeight}
                on:input={updateDraftLineHeight}
              />
              <output for="editorLineHeight">{draftLineHeight.toFixed(2)}</output>
            </div>
          </div>

          <div class="setting-field">
            <span class="setting-label">提示块样式</span>
            <div class="segmented-control" role="group" aria-label="提示块样式">
              <button
                type="button"
                class:active={draftBlockStyle === 'classic'}
                aria-pressed={draftBlockStyle === 'classic'}
                on:click={() => setDraftBlockStyle('classic')}
              >
                经典
              </button>
              <button
                type="button"
                class:active={draftBlockStyle === 'modern'}
                aria-pressed={draftBlockStyle === 'modern'}
                on:click={() => setDraftBlockStyle('modern')}
              >
                现代
              </button>
            </div>
          </div>
        </section>

        <section class="setting-group image-setting-group" aria-labelledby="imageSettingsTitle">
          <div class="setting-heading">
            <h3 id="imageSettingsTitle">图片</h3>
            <p>粘贴、拖放和上传图片时使用的默认处理方式。</p>
          </div>

          <div class="setting-field">
            <span class="setting-label">处理方式</span>
            <div class="segmented-control" role="group" aria-label="图片处理方式">
              <button
                type="button"
                class:active={draftImageSettings.imageInsertStrategy === 'copy-current-folder'}
                aria-pressed={draftImageSettings.imageInsertStrategy === 'copy-current-folder'}
                on:click={() => setImageStrategy('copy-current-folder')}
              >
                当前文件夹
              </button>
              <button
                type="button"
                class:active={draftImageSettings.imageInsertStrategy === 'copy-assets'}
                aria-pressed={draftImageSettings.imageInsertStrategy === 'copy-assets'}
                on:click={() => setImageStrategy('copy-assets')}
              >
                assets
              </button>
              <button
                type="button"
                class:active={draftImageSettings.imageInsertStrategy === 'copy-document-assets'}
                aria-pressed={draftImageSettings.imageInsertStrategy === 'copy-document-assets'}
                on:click={() => setImageStrategy('copy-document-assets')}
              >
                文档.assets
              </button>
              <button
                type="button"
                class:active={draftImageSettings.imageInsertStrategy === 'upload'}
                aria-pressed={draftImageSettings.imageInsertStrategy === 'upload'}
                on:click={() => setImageStrategy('upload')}
              >
                上传
              </button>
            </div>
          </div>

          <label class="toggle-setting" for="autoDeleteUnusedLocalImages">
            <span>
              <span class="toggle-title">自动清理本地图片</span>
              <span class="toggle-desc">图片引用完全移除后，同步删除对应本地文件。</span>
            </span>
            <input
              id="autoDeleteUnusedLocalImages"
              type="checkbox"
              checked={draftImageSettings.autoDeleteUnusedLocalImages}
              on:change={toggleAutoDeleteUnusedLocalImages}
            />
            <span class="toggle-switch" aria-hidden="true"></span>
          </label>

          {#if draftImageSettings.imageInsertStrategy === 'upload'}
            <div class="setting-field">
              <span class="setting-label">上传方式</span>
              <div class="provider-switch" role="group" aria-label="图片上传方式">
                <button
                  type="button"
                  class:active={draftImageSettings.uploadProvider === 'picgo'}
                  aria-pressed={draftImageSettings.uploadProvider === 'picgo'}
                  on:click={() => setUploadProvider('picgo')}
                >
                  PicGo
                </button>
                <button
                  type="button"
                  class:active={draftImageSettings.uploadProvider === 'picgo-core'}
                  aria-pressed={draftImageSettings.uploadProvider === 'picgo-core'}
                  on:click={() => setUploadProvider('picgo-core')}
                >
                  PicGo-Core
                </button>
              </div>
            </div>

            {#if draftImageSettings.uploadProvider === 'picgo'}
              <div class="setting-field">
                <label for="picgoServerUrl">PicGo Server 地址</label>
                <input
                  id="picgoServerUrl"
                  class="setting-input"
                  type="text"
                  value={draftImageSettings.picgoServerUrl}
                  on:input={updatePicgoServerUrl}
                />
              </div>
            {:else}
              <div class="setting-field">
                <label for="picgoCoreCommand">PicGo-Core 命令</label>
                <input
                  id="picgoCoreCommand"
                  class="setting-input"
                  type="text"
                  value={draftImageSettings.picgoCoreCommand}
                  on:input={updatePicgoCoreCommand}
                />
              </div>
              <div class="setting-field">
                <label for="picgoCoreConfigPath">PicGo-Core 配置文件</label>
                <input
                  id="picgoCoreConfigPath"
                  class="setting-input"
                  type="text"
                  value={draftImageSettings.picgoCoreConfigPath}
                  placeholder="可留空"
                  on:input={updatePicgoCoreConfigPath}
                />
              </div>
            {/if}
          {/if}
        </section>
      </div>

      <footer class="drawer-footer">
        <button type="button" class="save-btn" on:click={handleSave}> 保存 </button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .settings-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(2px);
    z-index: 9999;
    display: flex;
    justify-content: flex-end;
  }

  .settings-drawer {
    width: 400px;
    max-width: 100%;
    height: 100%;
    background: var(--md-editor-bg);
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    border-left: 1px solid var(--md-editor-border);
  }

  .drawer-header {
    display: flex;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid var(--md-editor-border);
    gap: 12px;
  }

  .drawer-header h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--md-editor-fg);
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    border-radius: var(--md-editor-radius);
    color: var(--md-editor-muted-fg);
    cursor: pointer;
    transition: all 0.2s;
  }

  .icon-btn:hover {
    background: var(--md-editor-surface);
    color: var(--md-editor-fg);
  }

  .drawer-body {
    flex: 1;
    overflow-y: auto;
    padding: 24px 16px;
  }

  .setting-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .appearance-setting-group,
  .image-setting-group {
    margin-top: 24px;
    padding-top: 22px;
    border-top: 1px solid var(--md-editor-border);
    gap: 16px;
  }

  .setting-heading {
    display: grid;
    gap: 4px;
  }

  .setting-heading h3 {
    margin: 0;
    color: var(--md-editor-fg);
    font-size: 14px;
    font-weight: 700;
  }

  .setting-heading p {
    margin: 0;
    color: var(--md-editor-muted-fg);
    font-size: 12px;
    line-height: 1.5;
  }

  .setting-field {
    display: grid;
    gap: 8px;
  }

  .toggle-setting {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 14px;
    padding: 10px 0;
    cursor: pointer;
  }

  .toggle-title,
  .toggle-desc {
    display: block;
  }

  .toggle-title {
    color: var(--md-editor-fg);
    font-size: 14px;
    font-weight: 500;
  }

  .toggle-desc {
    margin-top: 3px;
    color: var(--md-editor-muted-fg);
    font-size: 12px;
    line-height: 1.45;
  }

  .toggle-setting input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .toggle-switch {
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

  .toggle-setting input:checked + .toggle-switch {
    border-color: var(--md-editor-accent);
    background: var(--md-editor-accent);
  }

  .toggle-setting input:checked + .toggle-switch::before {
    transform: translateX(18px);
  }

  .toggle-setting input:focus-visible + .toggle-switch {
    outline: 2px solid var(--md-editor-accent);
    outline-offset: 2px;
  }

  .range-setting {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 54px;
    align-items: center;
    gap: 10px;
  }

  .range-setting input {
    width: 100%;
    accent-color: var(--md-editor-accent);
  }

  .range-setting output {
    color: var(--md-editor-muted-fg);
    font-family: var(--md-editor-font-mono);
    font-size: 12px;
    text-align: right;
  }

  .setting-group label {
    font-size: 14px;
    font-weight: 500;
    color: var(--md-editor-fg);
  }

  .setting-label {
    color: var(--md-editor-fg);
    font-size: 14px;
    font-weight: 500;
  }

  .setting-input {
    width: 100%;
    min-width: 0;
    height: 34px;
    padding: 0 11px;
    border: 1px solid var(--md-editor-border);
    border-radius: var(--md-editor-radius-sm);
    background: var(--md-editor-surface);
    color: var(--md-editor-fg);
    font-family: inherit;
    font-size: 13px;
    outline: none;
  }

  .setting-input:focus-visible,
  .range-setting input:focus-visible {
    border-color: var(--md-editor-accent);
    outline: 2px solid color-mix(in srgb, var(--md-editor-accent) 34%, transparent);
    outline-offset: 1px;
  }

  .folder-behavior-options {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4px;
    padding: 4px;
    border: 1px solid var(--md-editor-border);
    border-radius: var(--md-editor-radius-md);
    background: color-mix(in srgb, var(--md-editor-surface) 82%, var(--md-editor-bg));
  }

  .folder-behavior-options button {
    min-width: 0;
    min-height: 36px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--md-editor-radius-sm);
    background: transparent;
    color: var(--md-editor-muted-fg);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition:
      background-color 160ms ease,
      color 160ms ease,
      box-shadow 160ms ease;
  }

  .folder-behavior-options button:hover {
    background: color-mix(in srgb, var(--md-editor-accent) 8%, transparent);
    color: var(--md-editor-fg);
  }

  .folder-behavior-options button.active {
    background: var(--md-editor-bg);
    color: var(--md-editor-accent-strong);
    box-shadow: 0 1px 8px color-mix(in srgb, #020617 10%, transparent);
  }

  .folder-behavior-options button:focus-visible,
  .segmented-control button:focus-visible,
  .provider-switch button:focus-visible,
  .save-btn:focus-visible,
  .icon-btn:focus-visible {
    outline: 2px solid var(--md-editor-accent);
    outline-offset: 2px;
  }

  .segmented-control,
  .provider-switch {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px;
    padding: 4px;
    border: 1px solid var(--md-editor-border);
    border-radius: var(--md-editor-radius-md);
    background: color-mix(in srgb, var(--md-editor-surface) 82%, var(--md-editor-bg));
  }

  .segmented-control button,
  .provider-switch button {
    min-width: 0;
    min-height: 36px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--md-editor-radius-sm);
    background: transparent;
    color: var(--md-editor-muted-fg);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition:
      background-color 160ms ease,
      color 160ms ease,
      box-shadow 160ms ease;
  }

  .segmented-control button:hover,
  .provider-switch button:hover {
    background: color-mix(in srgb, var(--md-editor-accent) 8%, transparent);
    color: var(--md-editor-fg);
  }

  .segmented-control button.active,
  .provider-switch button.active {
    background: var(--md-editor-bg);
    color: var(--md-editor-accent-strong);
    box-shadow: 0 1px 8px color-mix(in srgb, #020617 10%, transparent);
  }

  .drawer-footer {
    padding: 16px;
    border-top: 1px solid var(--md-editor-border);
    display: flex;
    justify-content: flex-end;
  }

  .save-btn {
    height: 36px;
    padding: 0 24px;
    border: none;
    border-radius: var(--md-editor-radius-sm);
    background: var(--md-editor-accent);
    color: white;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .save-btn:hover {
    opacity: 0.9;
  }
</style>
