import { listAppSettings, updateAppSetting } from '../../lib/desktop/tauriStorage';
import type { OutlineScrollAnchor } from './outlineNavigation';

const READING_POSITIONS_KEY = 'readingPositions';
const MAX_ENTRIES = 300;
const DEBOUNCE_MS = 1500;

export type ReadingPositionMode = 'semantic' | 'source';

export interface ReadingPosition {
  /** 语义模式的阅读位置。 */
  semanticAnchor: OutlineScrollAnchor | null;
  /** 源码模式的阅读位置。 */
  sourceAnchor: OutlineScrollAnchor | null;
  /** 文件级更新时间，用于多窗口最后写入者获胜。 */
  updatedAt: number;
}

interface ReadingPositionStore {
  positions: Map<string, ReadingPosition>;
  debounceTimer: number | null;
  writePromise: Promise<void> | null;
  loaded: boolean;
}

const store: ReadingPositionStore = {
  positions: new Map(),
  debounceTimer: null,
  writePromise: null,
  loaded: false,
};

export function normalizeReadingPositionFilePath(filePath: string): string {
  return filePath.trim().replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

export async function loadReadingPositions(): Promise<Map<string, ReadingPosition>> {
  const loaded = await readPersistedReadingPositions();
  store.positions = mergeReadingPositions(store.positions, loaded);
  store.loaded = true;
  return new Map(store.positions);
}

export function getReadingPosition(filePath: string): ReadingPosition | undefined {
  return store.positions.get(normalizeReadingPositionFilePath(filePath));
}

export function saveReadingPositionToMemory(
  filePath: string,
  mode: ReadingPositionMode,
  anchor: OutlineScrollAnchor | null,
): void {
  writeReadingPositionToMemory(filePath, mode, anchor);
  schedulePersist();
}

export function saveReadingPositionToMemoryOnly(
  filePath: string,
  mode: ReadingPositionMode,
  anchor: OutlineScrollAnchor | null,
): void {
  writeReadingPositionToMemory(filePath, mode, anchor);
}

export async function flushReadingPositions(): Promise<void> {
  if (store.debounceTimer !== null) {
    window.clearTimeout(store.debounceTimer);
    store.debounceTimer = null;
  }
  await persistReadingPositions();
}

function writeReadingPositionToMemory(
  filePath: string,
  mode: ReadingPositionMode,
  anchor: OutlineScrollAnchor | null,
) {
  const key = normalizeReadingPositionFilePath(filePath);
  if (!key) return;

  const existing = store.positions.get(key);
  const next: ReadingPosition = {
    semanticAnchor: mode === 'semantic' ? anchor : (existing?.semanticAnchor ?? null),
    sourceAnchor: mode === 'source' ? anchor : (existing?.sourceAnchor ?? null),
    updatedAt: Date.now(),
  };
  store.positions.set(key, next);
}

function schedulePersist(): void {
  if (store.debounceTimer !== null) {
    window.clearTimeout(store.debounceTimer);
  }
  store.debounceTimer = window.setTimeout(() => {
    store.debounceTimer = null;
    void persistReadingPositions();
  }, DEBOUNCE_MS);
}

async function persistReadingPositions(): Promise<void> {
  if (store.writePromise) {
    await store.writePromise;
  }

  store.writePromise = (async () => {
    const persisted = await readPersistedReadingPositions();
    const merged = trimToRecentEntries(mergeReadingPositions(persisted, store.positions));
    await updateAppSetting(READING_POSITIONS_KEY, Object.fromEntries(merged.entries()));
    store.positions = merged;
    store.loaded = true;
  })().catch(() => undefined);

  try {
    await store.writePromise;
  } finally {
    store.writePromise = null;
  }
}

async function readPersistedReadingPositions(): Promise<Map<string, ReadingPosition>> {
  try {
    const settings = await listAppSettings();
    const setting = settings.find((s) => s.key === READING_POSITIONS_KEY);
    if (!setting) return new Map();
    const record = JSON.parse(setting.valueJson) as Record<string, unknown>;
    const map = new Map<string, ReadingPosition>();

    for (const [key, value] of Object.entries(record)) {
      const normalizedKey = normalizeReadingPositionFilePath(key);
      const normalizedValue = normalizeReadingPosition(value);
      if (normalizedKey && normalizedValue) {
        map.set(normalizedKey, normalizedValue);
      }
    }

    return trimToRecentEntries(map);
  } catch {
    return new Map();
  }
}

function normalizeReadingPosition(value: unknown): ReadingPosition | null {
  if (!value || typeof value !== 'object') return null;
  const position = value as Partial<ReadingPosition>;
  if (typeof position.updatedAt !== 'number' || !Number.isFinite(position.updatedAt)) {
    return null;
  }
  return {
    semanticAnchor: isOutlineScrollAnchor(position.semanticAnchor) ? position.semanticAnchor : null,
    sourceAnchor: isOutlineScrollAnchor(position.sourceAnchor) ? position.sourceAnchor : null,
    updatedAt: position.updatedAt,
  };
}

function isOutlineScrollAnchor(value: unknown): value is OutlineScrollAnchor {
  if (!value || typeof value !== 'object') return false;
  const anchor = value as Partial<OutlineScrollAnchor>;
  if (anchor.kind !== 'outline' && anchor.kind !== 'document') return false;
  return (
    typeof anchor.sectionProgress === 'number' &&
    Number.isFinite(anchor.sectionProgress) &&
    typeof anchor.documentProgress === 'number' &&
    Number.isFinite(anchor.documentProgress) &&
    typeof anchor.sourceLine === 'number' &&
    Number.isFinite(anchor.sourceLine)
  );
}

function mergeReadingPositions(
  base: Map<string, ReadingPosition>,
  incoming: Map<string, ReadingPosition>,
): Map<string, ReadingPosition> {
  const merged = new Map(base);
  for (const [key, value] of incoming.entries()) {
    const existing = merged.get(key);
    if (!existing || value.updatedAt >= existing.updatedAt) {
      merged.set(key, value);
    }
  }
  return merged;
}

function trimToRecentEntries(
  map: Map<string, ReadingPosition>,
  limit = MAX_ENTRIES,
): Map<string, ReadingPosition> {
  if (map.size <= limit) return new Map(map);
  const entries = Array.from(map.entries()).sort((a, b) => b[1].updatedAt - a[1].updatedAt);
  return new Map(entries.slice(0, limit));
}

export const __readingPositionTestUtils = {
  normalizeReadingPositionFilePath,
  trimToRecentEntries,
  mergeReadingPositions,
  resetStore() {
    if (store.debounceTimer !== null) {
      window.clearTimeout(store.debounceTimer);
    }
    store.positions = new Map();
    store.debounceTimer = null;
    store.writePromise = null;
    store.loaded = false;
  },
};
