import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('external file change flow', () => {
  const actionsSource = readFileSync(resolve(__dirname, 'documentActionsController.ts'), 'utf-8');
  const workspaceSource = readFileSync(
    resolve(__dirname, '../components/EditorWorkspace.svelte'),
    'utf-8',
  );

  it('blocks ordinary save and autosave while an external change is pending', () => {
    const saveStart = actionsSource.indexOf('async function saveMarkdownFile');
    const saveEnd = actionsSource.indexOf('async function openRecentFile');
    const saveSource = actionsSource.slice(saveStart, saveEnd);

    expect(saveSource).toContain('!saveAs && hasExternalFileChange()');
    expect(saveSource).toContain('t.externalChangeChooseAction()');

    const autosaveStart = actionsSource.indexOf('function debouncedAutoSave');
    const autosaveEnd = actionsSource.indexOf('function cancelPendingAutoSaves');
    const autosaveSource = actionsSource.slice(autosaveStart, autosaveEnd);

    expect(autosaveSource.match(/hasExternalFileChange\(\)/g)).toHaveLength(2);
    expect(autosaveSource).toContain('t.externalChangeAutoSavePaused()');
  });

  it('exposes explicit reload, save-as and overwrite actions in the editor alert', () => {
    expect(actionsSource).toContain('async function reloadExternalFile');
    expect(actionsSource).toContain('async function overwriteExternalFile');
    expect(actionsSource).toContain("options.getExternalFileChange().type !== 'modified'");

    expect(workspaceSource).toContain("externalFileChange.type !== 'none'");
    expect(workspaceSource).toContain('t.reloadExternalVersion()');
    expect(workspaceSource).toContain('t.saveAsCurrentContent()');
    expect(workspaceSource).toContain('t.overwriteExternalVersion()');
  });
});
