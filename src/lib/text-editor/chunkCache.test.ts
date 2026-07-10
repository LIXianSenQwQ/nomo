import { describe, expect, it } from 'vitest';
import { ByteLruCache } from './chunkCache';

describe('ByteLruCache', () => {
  it('evicts the least recently used unpinned entries by byte capacity', () => {
    const cache = new ByteLruCache<string, string>(6, (value) => value.length);
    cache.set('a', 'aaa');
    cache.set('b', 'bb');
    cache.get('a');
    cache.set('c', 'cc');

    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
    expect(cache.has('c')).toBe(true);
    expect(cache.byteSize).toBe(5);
  });

  it('keeps pinned entries until they are unpinned, then restores the capacity invariant', () => {
    const cache = new ByteLruCache<string, string>(4, (value) => value.length);
    cache.set('current', '1234');
    cache.pin('current');
    cache.set('next', 'abc');

    expect(cache.has('current')).toBe(true);
    expect(cache.has('next')).toBe(false);

    cache.pin('next');
    cache.set('next', 'abc');
    expect(cache.isOverCapacity).toBe(true);
    cache.unpin('current');

    expect(cache.has('current')).toBe(false);
    expect(cache.has('next')).toBe(true);
    expect(cache.isOverCapacity).toBe(false);
  });
});
