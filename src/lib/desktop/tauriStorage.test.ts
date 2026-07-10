import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteWorkspaceDraft,
  installSampleDocument,
  openMarkdownWithDialog,
  parseNativeError,
  pickDocumentPathWithDialog,
  readWorkspaceDraft,
  writeWorkspaceDraft,
} from './tauriStorage';

const invokeMock = vi.hoisted(() => vi.fn());
const openDialogMock = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: openDialogMock,
}));

beforeEach(() => {
  invokeMock.mockReset();
  openDialogMock.mockReset();
});

describe('document dialogs', () => {
  it('keeps the legacy Markdown reader isolated from segmented document extensions', async () => {
    openDialogMock.mockResolvedValue(null);

    await openMarkdownWithDialog();
    expect(openDialogMock).toHaveBeenLastCalledWith({
      multiple: false,
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    });

    await pickDocumentPathWithDialog();
    expect(openDialogMock).toHaveBeenLastCalledWith({
      multiple: false,
      filters: [{ name: 'Documents', extensions: ['md', 'markdown', 'txt', 'json'] }],
    });
  });
});

describe('parseNativeError', () => {
  it('解析 PERMISSION_DENIED 错误码', () => {
    const result = parseNativeError('[PERMISSION_DENIED] 没有权限访问 C:\\test.md');
    expect(result.code).toBe('PERMISSION_DENIED');
    expect(result.message).toBe('没有权限访问 C:\\test.md');
  });

  it('解析 FILE_NOT_FOUND 错误码', () => {
    const result = parseNativeError('[FILE_NOT_FOUND] 文件不存在：C:\\缺失\\doc.md');
    expect(result.code).toBe('FILE_NOT_FOUND');
    expect(result.message).toBe('文件不存在：C:\\缺失\\doc.md');
  });

  it('解析 DISK_FULL 错误码', () => {
    const result = parseNativeError('[DISK_FULL] 保存 Markdown 文件失败：磁盘空间不足');
    expect(result.code).toBe('DISK_FULL');
  });

  it('解析 IO_ERROR 错误码', () => {
    const result = parseNativeError('[IO_ERROR] 读取 Markdown 文件失败：stream error');
    expect(result.code).toBe('IO_ERROR');
  });

  it('未知格式回退到 UNKNOWN 错误码', () => {
    const result = parseNativeError('something went wrong');
    expect(result.code).toBe('UNKNOWN');
    expect(result.message).toBe('something went wrong');
  });

  it('处理 Error 对象', () => {
    const result = parseNativeError(new Error('[PERMISSION_DENIED] 没有权限'));
    expect(result.code).toBe('PERMISSION_DENIED');
  });

  it('处理非字符串类型', () => {
    const result = parseNativeError(42);
    expect(result.code).toBe('UNKNOWN');
  });
});

describe('桌面路径编码场景（Windows-first）', () => {
  it('中文路径不破坏 JSON 序列化', () => {
    const path = 'C:\\用户\\admin\\文档\\测试文件.md';
    const json = JSON.stringify({ path });
    const parsed = JSON.parse(json);
    expect(parsed.path).toBe(path);
  });

  it('空格路径不破坏 JSON 序列化', () => {
    const path = 'C:\\My Documents\\test file.md';
    const json = JSON.stringify({ path });
    const parsed = JSON.parse(json);
    expect(parsed.path).toBe(path);
  });

  it('混合中文空格路径不破坏 JSON 序列化', () => {
    const path = 'C:\\用户 目录\\我的 测试.md';
    const json = JSON.stringify({ path });
    const parsed = JSON.parse(json);
    expect(parsed.path).toBe(path);
  });
});

describe('installSampleDocument', () => {
  it('把后端实例文档 payload 规范化为 NativeDocument', async () => {
    invokeMock.mockResolvedValue({
      path: 'C:\\Users\\清羽\\AppData\\Roaming\\Nomo\\samples\\sample.md',
      file_name: 'sample.md',
      markdown: '# 实例',
      modified_at: 100,
      size_bytes: 8,
      readonly: false,
    });

    await expect(installSampleDocument()).resolves.toEqual({
      path: 'C:\\Users\\清羽\\AppData\\Roaming\\Nomo\\samples\\sample.md',
      fileName: 'sample.md',
      markdown: '# 实例',
      modifiedAt: 100,
      sizeBytes: 8,
      readonly: false,
    });
    expect(invokeMock).toHaveBeenCalledWith('install_sample_document');
  });
});

describe('workspace drafts', () => {
  it('writes a workspace draft through the native command', async () => {
    invokeMock.mockResolvedValue({
      draft_id: 'draft-1',
      updated_at: 123,
    });

    await expect(writeWorkspaceDraft('# 草稿', 'draft-1')).resolves.toEqual({
      draftId: 'draft-1',
      markdown: '',
      updatedAt: 123,
    });
    expect(invokeMock).toHaveBeenCalledWith('write_workspace_draft', {
      input: {
        draft_id: 'draft-1',
        markdown: '# 草稿',
      },
    });
  });

  it('reads and deletes workspace drafts by id', async () => {
    invokeMock.mockResolvedValueOnce({
      draft_id: 'draft-1',
      markdown: '# 草稿',
      updated_at: 123,
    });
    await expect(readWorkspaceDraft('draft-1')).resolves.toEqual({
      draftId: 'draft-1',
      markdown: '# 草稿',
      updatedAt: 123,
    });
    expect(invokeMock).toHaveBeenCalledWith('read_workspace_draft', { draftId: 'draft-1' });

    invokeMock.mockResolvedValueOnce(undefined);
    await deleteWorkspaceDraft('draft-1');
    expect(invokeMock).toHaveBeenCalledWith('delete_workspace_draft', { draftId: 'draft-1' });
  });
});
