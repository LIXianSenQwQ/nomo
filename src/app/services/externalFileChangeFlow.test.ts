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
    expect(saveSource).toContain('检测到外部文件变更，请先选择重新载入、另存为或覆盖外部版本');

    const autosaveStart = actionsSource.indexOf('function debouncedAutoSave');
    const autosaveEnd = actionsSource.indexOf('function cancelPendingAutoSaves');
    const autosaveSource = actionsSource.slice(autosaveStart, autosaveEnd);

    expect(autosaveSource.match(/hasExternalFileChange\(\)/g)).toHaveLength(2);
    expect(autosaveSource).toContain('检测到外部文件变更，已暂停自动保存');
  });

  it('exposes explicit reload, save-as and overwrite actions in the editor alert', () => {
    expect(actionsSource).toContain('async function reloadExternalFile');
    expect(actionsSource).toContain('async function overwriteExternalFile');
    expect(actionsSource).toContain("options.getExternalFileChange().type !== 'modified'");

    expect(workspaceSource).toContain("externalFileChange.type !== 'none'");
    expect(workspaceSource).toContain('重新载入外部版本');
    expect(workspaceSource).toContain('另存为当前内容');
    expect(workspaceSource).toContain('覆盖外部版本');
  });
});
