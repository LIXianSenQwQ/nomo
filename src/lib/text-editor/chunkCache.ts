import type { SegmentedWindow } from './protocol';
import { utf8ByteLength } from './positionMapping';

const JS_NUMBER_BYTES = 8;
const JS_ARRAY_FIXED_OVERHEAD_BYTES = 32;

interface CacheEntry<V> {
  value: V;
  bytes: number;
}

/**
 * IPC 会把 utf16ByteOffsets 保留为普通 JS number[]；所有 WebView 窗口缓存统一按实际保留量估算。
 * text 至少按逻辑字节区间计费，避免替换字符或 UTF-16 表示让缓存预算被低估。
 */
export function estimateSegmentedWindowBytes(window: SegmentedWindow) {
  const declaredWindowBytes = Math.max(0, window.endByte - window.startByte);
  const textBytes = Math.max(declaredWindowBytes, utf8ByteLength(window.text));
  const utf16OffsetsBytes = window.utf16ByteOffsets
    ? JS_ARRAY_FIXED_OVERHEAD_BYTES + window.utf16ByteOffsets.length * JS_NUMBER_BYTES
    : 0;
  return textBytes + utf16OffsetsBytes;
}

/** 固定字节容量 LRU；pin 允许活动窗口短暂超过上限，但 unpin 后立即恢复容量约束。 */
export class ByteLruCache<K, V> {
  private readonly entriesByKey = new Map<K, CacheEntry<V>>();
  private readonly pinnedKeys = new Set<K>();
  private totalBytes = 0;

  constructor(
    readonly capacityBytes: number,
    private readonly sizeOf: (value: V) => number,
  ) {
    if (!Number.isSafeInteger(capacityBytes) || capacityBytes <= 0) {
      throw new RangeError('capacityBytes 必须是正安全整数');
    }
  }

  get byteSize() {
    return this.totalBytes;
  }

  get size() {
    return this.entriesByKey.size;
  }

  get isOverCapacity() {
    return this.totalBytes > this.capacityBytes;
  }

  has(key: K) {
    return this.entriesByKey.has(key);
  }

  get(key: K) {
    const entry = this.entriesByKey.get(key);
    if (!entry) {
      return undefined;
    }
    this.entriesByKey.delete(key);
    this.entriesByKey.set(key, entry);
    return entry.value;
  }

  peek(key: K) {
    return this.entriesByKey.get(key)?.value;
  }

  set(key: K, value: V) {
    const bytes = this.sizeOf(value);
    if (!Number.isSafeInteger(bytes) || bytes < 0) {
      throw new RangeError('缓存条目字节数必须是非负安全整数');
    }

    const existing = this.entriesByKey.get(key);
    if (existing) {
      this.totalBytes -= existing.bytes;
      this.entriesByKey.delete(key);
    }
    this.entriesByKey.set(key, { value, bytes });
    this.totalBytes += bytes;
    this.evictToCapacity();
    return this.entriesByKey.has(key);
  }

  delete(key: K) {
    const entry = this.entriesByKey.get(key);
    if (!entry) {
      this.pinnedKeys.delete(key);
      return false;
    }
    this.entriesByKey.delete(key);
    this.pinnedKeys.delete(key);
    this.totalBytes -= entry.bytes;
    return true;
  }

  pin(key: K) {
    this.pinnedKeys.add(key);
  }

  unpin(key: K) {
    this.pinnedKeys.delete(key);
    this.evictToCapacity();
  }

  isPinned(key: K) {
    return this.pinnedKeys.has(key);
  }

  clear() {
    this.entriesByKey.clear();
    this.pinnedKeys.clear();
    this.totalBytes = 0;
  }

  values() {
    return Array.from(this.entriesByKey.values(), (entry) => entry.value);
  }

  private evictToCapacity() {
    if (!this.isOverCapacity) {
      return;
    }

    // Map 的迭代顺序就是从最旧到最新；一次扫描只移除未固定窗口。
    for (const [key, entry] of this.entriesByKey) {
      if (this.totalBytes <= this.capacityBytes) {
        break;
      }
      if (this.pinnedKeys.has(key)) {
        continue;
      }
      this.entriesByKey.delete(key);
      this.totalBytes -= entry.bytes;
    }
  }
}
