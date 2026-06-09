<script lang="ts">
  import { FilePlus2, FileText, FolderOpen } from '@lucide/svelte';
  import { t } from '../i18n';

  export let interfaceLocale: string;
  export let createNewFile: () => void;
  export let openFileDialog: () => void;
  export let openFolderDialog: () => void;
</script>

{#key interfaceLocale}
  <section class="empty-workspace" aria-label={t.noOpenDocument()}>
    <div class="empty-workspace-panel">
      <div class="empty-workspace-mark" aria-hidden="true">
        <FileText size={24} strokeWidth={1.8} />
      </div>
      <div class="empty-workspace-copy">
        <h1>{t.noOpenDocument()}</h1>
        <p>{t.noOpenDocumentDescription()}</p>
      </div>
      <div class="empty-workspace-actions">
        <button type="button" class="primary" on:click={createNewFile}>
          <FilePlus2 size={16} />
          <span>{t.newFile()}</span>
        </button>
        <button type="button" on:click={openFileDialog}>
          <FileText size={16} />
          <span>{t.openFile()}</span>
        </button>
        <button type="button" on:click={openFolderDialog}>
          <FolderOpen size={16} />
          <span>{t.openFolder()}</span>
        </button>
      </div>
    </div>
  </section>
{/key}
