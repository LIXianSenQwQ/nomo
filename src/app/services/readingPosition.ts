import { listAppSettings, updateAppSetting } from '../../lib/desktop/tauriStorage';
import type { OutlineScrollAnchor } from './outlineNavigation';

const READING_POSITIONS_KEY = 'readingPositions';
const MAX_ENTRIES = 300;
const DEBOUNCE_MS = 1500;

export type ReadingPositionMode = 'semantic' | 'source';

export interface ReadingPosition {
  /** 当前文件唯一的阅读语义锚点。 */
  anchor: OutlineScrollAnchor | null;
  /** 锚点来源模式，用于判断像素锚点是否可同源恢复。 */
  anchorMode: ReadingPositionMode;
  /** 文件级更新时间，用于多窗口最后写入者获胜。 */
  updatedAt: number;
}

interface LegacyReadingPosition {
  semanticAnchor: OutlineScrollAnchor | null;
  sourceAnchor: OutlineScrollAnchor | null;
  updatedAt: number;
}

type StoredReadingPosition = ReadingPosition | LegacyReadingPosition;

interface ReadingPositionStore {
  positions: Map<string, StoredReadingPosition>;
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
  return materializeReadingPositionMap(store.positions);
}

export function getReadingPosition(
  filePath: string,
  preferredMode: ReadingPositionMode = 'semantic',
): ReadingPosition | undefined {
  const key = normalizeReadingPositionFilePath(filePath);
  const stored = store.positions.get(key);
  if (!stored) {
    return undefined;
  }

  const position = materializeReadingPosition(stored, preferredMode);
  if (!isUnifiedReadingPosition(stored)) {
    store.positions.set(key, position);
  }
  return position;
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

  const next: ReadingPosition = {
    anchor,
    anchorMode: mode,
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

async function readPersistedReadingPositions(): Promise<Map<string, StoredReadingPosition>> {
  try {
    const settings = await listAppSettings();
    const setting = settings.find((s) => s.key === READING_POSITIONS_KEY);
    if (!setting) return new Map();
    const record = JSON.parse(setting.valueJson) as Record<string, unknown>;
    const map = new Map<string, StoredReadingPosition>();

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

function normalizeReadingPosition(value: unknown): StoredReadingPosition | null {
  if (!value || typeof value !== 'object') return null;
  const position = value as Partial<ReadingPosition & LegacyReadingPosition>;
  if (typeof position.updatedAt !== 'number' || !Number.isFinite(position.updatedAt)) {
    return null;
  }

  if (isReadingPositionMode(position.anchorMode)) {
    return {
      anchor: isOutlineScrollAnchor(position.anchor) ? position.anchor : null,
      anchorMode: position.anchorMode,
      updatedAt: position.updatedAt,
    };
  }

  if ('semanticAnchor' in position || 'sourceAnchor' in position) {
    return {
      semanticAnchor: isOutlineScrollAnchor(position.semanticAnchor)
        ? position.semanticAnchor
        : null,
      sourceAnchor: isOutlineScrollAnchor(position.sourceAnchor) ? position.sourceAnchor : null,
      updatedAt: position.updatedAt,
    };
  }

  return null;
}

function materializeReadingPosition(
  position: StoredReadingPosition,
  preferredMode: ReadingPositionMode,
): ReadingPosition {
  if (isUnifiedReadingPosition(position)) {
    return position;
  }

  const fallbackMode: ReadingPositionMode = preferredMode === 'semantic' ? 'source' : 'semantic';
  const preferredAnchor =
    preferredMode === 'semantic' ? position.semanticAnchor : position.sourceAnchor;
  const fallbackAnchor = fallbackMode === 'semantic' ? position.semanticAnchor : position.sourceAnchor;
  const anchor = preferredAnchor ?? fallbackAnchor ?? null;

  return {
    anchor,
    anchorMode: anchor === preferredAnchor ? preferredMode : fallbackMode,
    updatedAt: position.updatedAt,
  };
}

function materializeReadingPositionMap(
  map: Map<string, StoredReadingPosition>,
  preferredMode: ReadingPositionMode = 'semantic',
): Map<string, ReadingPosition> {
  return new Map(
    Array.from(map.entries(), ([key, value]) => [
      key,
      materializeReadingPosition(value, preferredMode),
    ]),
  );
}

function isUnifiedReadingPosition(position: StoredReadingPosition): position is ReadingPosition {
  return 'anchorMode' in position && isReadingPositionMode(position.anchorMode);
}

function isReadingPositionMode(value: unknown): value is ReadingPositionMode {
  return value === 'semantic' || value === 'source';
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
  base: Map<string, StoredReadingPosition>,
  incoming: Map<string, StoredReadingPosition>,
): Map<string, StoredReadingPosition> {
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
  map: Map<string, StoredReadingPosition>,
  limit = MAX_ENTRIES,
): Map<string, StoredReadingPosition> {
  if (map.size <= limit) return new Map(map);
  const entries = Array.from(map.entries()).sort((a, b) => b[1].updatedAt - a[1].updatedAt);
  return new Map(entries.slice(0, limit));
}

export const __readingPositionTestUtils = {
  normalizeReadingPositionFilePath,
  trimToRecentEntries,
  mergeReadingPositions,
  materializeReadingPosition,
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
