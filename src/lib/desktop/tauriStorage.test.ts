import { describe, expect, it } from 'vitest';
import { parseNativeError } from './tauriStorage';

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
