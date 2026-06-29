import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OutlineScrollAnchor } from './outlineNavigation';
import {
  __readingPositionTestUtils,
  flushReadingPositions,
  getReadingPosition,
  loadReadingPositions,
  saveReadingPositionToMemory,
  saveReadingPositionToMemoryOnly,
  type ReadingPosition,
} from './readingPosition';

vi.mock('../../lib/desktop/tauriStorage', () => ({
  listAppSettings: vi.fn().mockResolvedValue([]),
  updateAppSetting: vi.fn().mockResolvedValue(undefined),
}));

const semanticAnchor: OutlineScrollAnchor = {
  kind: 'outline',
  outlineId: 'intro',
  anchorPos: 3,
  offsetFromTop: 24,
  scrollTop: 160,
  sectionProgress: 0.25,
  documentProgress: 0.1,
  sourceLine: 3,
};

const sourceAnchor: OutlineScrollAnchor = {
  kind: 'document',
  anchorPos: 30,
  offsetFromTop: 4,
  scrollTop: 724,
  sectionProgress: 0.5,
  documentProgress: 0.5,
  sourceLine: 30,
};

describe('readingPosition', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    __readingPositionTestUtils.resetStore();
  });

  it('按标准化 filePath 保存和读取单一锚点', () => {
    saveReadingPositionToMemoryOnly('C:\\Docs\\Article.md\\', 'semantic', semanticAnchor);

    expect(getReadingPosition('c:/docs/article.md')).toEqual({
      anchor: semanticAnchor,
      anchorMode: 'semantic',
      updatedAt: expect.any(Number),
    });
  });

  it('保存新模式位置会覆盖旧锚点，不再保留两套独立位置', () => {
    saveReadingPositionToMemoryOnly('/docs/a.md', 'semantic', semanticAnchor);
    saveReadingPositionToMemoryOnly('/docs/a.md', 'source', sourceAnchor);

    const position = getReadingPosition('/docs/a.md');
    expect(position?.anchor).toEqual(sourceAnchor);
    expect(position?.anchorMode).toBe('source');
    expect(position).not.toHaveProperty('semanticAnchor');
    expect(position).not.toHaveProperty('sourceAnchor');
  });

  it('加载新结构持久化记录到内存', async () => {
    const { listAppSettings } = await import('../../lib/desktop/tauriStorage');
    const positions: Record<string, ReadingPosition> = {
      'C:/DOCS/A.md': {
        anchor: semanticAnchor,
        anchorMode: 'semantic',
        updatedAt: 100,
      },
    };

    vi.mocked(listAppSettings).mockResolvedValueOnce([
      { key: 'readingPositions', valueJson: JSON.stringify(positions), updatedAt: 1 },
    ]);

    await loadReadingPositions();

    expect(getReadingPosition('c:/docs/a.md')?.anchor).toEqual(semanticAnchor);
  });

  it('旧结构按目标模式优先迁移为统一锚点', async () => {
    const { listAppSettings } = await import('../../lib/desktop/tauriStorage');
    vi.mocked(listAppSettings).mockResolvedValueOnce([
      {
        key: 'readingPositions',
        valueJson: JSON.stringify({
          '/docs/a.md': {
            semanticAnchor,
            sourceAnchor,
            updatedAt: 100,
          },
        }),
        updatedAt: 1,
      },
    ]);

    await loadReadingPositions();

    expect(getReadingPosition('/docs/a.md', 'source')).toEqual({
      anchor: sourceAnchor,
      anchorMode: 'source',
      updatedAt: 100,
    });
  });

  it('旧结构缺少目标模式锚点时回退另一模式', async () => {
    const { listAppSettings } = await import('../../lib/desktop/tauriStorage');
    vi.mocked(listAppSettings).mockResolvedValueOnce([
      {
        key: 'readingPositions',
        valueJson: JSON.stringify({
          '/docs/a.md': {
            semanticAnchor,
            sourceAnchor: null,
            updatedAt: 100,
          },
        }),
        updatedAt: 1,
      },
    ]);

    await loadReadingPositions();

    expect(getReadingPosition('/docs/a.md', 'source')).toEqual({
      anchor: semanticAnchor,
      anchorMode: 'semantic',
      updatedAt: 100,
    });
  });

  it('flush 时按 updatedAt 合并，避免旧状态覆盖新状态', async () => {
    const { listAppSettings, updateAppSetting } = await import('../../lib/desktop/tauriStorage');
    vi.mocked(listAppSettings).mockResolvedValueOnce([
      {
        key: 'readingPositions',
        valueJson: JSON.stringify({
          '/docs/a.md': {
            semanticAnchor,
            sourceAnchor: null,
            updatedAt: Date.now() + 10_000,
          },
        }),
        updatedAt: 1,
      },
    ]);

    saveReadingPositionToMemoryOnly('/docs/a.md', 'source', sourceAnchor);
    await flushReadingPositions();

    expect(updateAppSetting).toHaveBeenCalledWith(
      'readingPositions',
      expect.objectContaining({
        '/docs/a.md': expect.objectContaining({
          semanticAnchor,
          sourceAnchor: null,
        }),
      }),
    );
  });

  it('防抖写入并限制最近 300 个文件', async () => {
    vi.useFakeTimers();
    const { updateAppSetting } = await import('../../lib/desktop/tauriStorage');

    for (let i = 0; i < 301; i += 1) {
      saveReadingPositionToMemory(`/docs/${i}.md`, 'semantic', {
        ...semanticAnchor,
        sourceLine: i + 1,
      });
      vi.advanceTimersByTime(1);
    }

    expect(updateAppSetting).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1500);

    const persisted = vi.mocked(updateAppSetting).mock.calls.at(-1)?.[1] as Record<
      string,
      ReadingPosition
    >;
    expect(Object.keys(persisted)).toHaveLength(300);
    expect(persisted['/docs/0.md']).toBeUndefined();
    expect(persisted['/docs/300.md']).toMatchObject({
      anchorMode: 'semantic',
      anchor: expect.objectContaining({ sourceLine: 301 }),
    });
  });
});
