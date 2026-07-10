import { describe, expect, it } from 'vitest';
import type { OpenSegmentedDocumentResult } from './protocol';
import { SegmentedSessionRegistry } from './sessionRegistry';

function createOpenResult(): OpenSegmentedDocumentResult {
  return {
    sessionId: 'session-1',
    revision: 0,
    persistedRevision: 0,
    documentKind: 'text',
    encoding: 'utf-8',
    lineEnding: 'lf',
    byteLength: 20,
    readonly: false,
    firstWindow: {
      revision: 0,
      startByte: 0,
      endByte: 5,
      startLine: 0,
      text: 'hello',
      leadingPartialLine: false,
      trailingPartialLine: true,
      indexProgress: 0.25,
    },
  };
}

function withSession(result: OpenSegmentedDocumentResult, sessionId: string) {
  return { ...result, sessionId };
}

function withUtf16Offsets(result: OpenSegmentedDocumentResult) {
  return {
    ...result,
    firstWindow: {
      ...result.firstWindow,
      utf16ByteOffsets: [0, 1, 2, 3, 4, 5],
    },
  };
}

describe('SegmentedSessionRegistry', () => {
  it('keeps bounded metadata and allows the first window to be consumed only once', () => {
    const registry = new SegmentedSessionRegistry(8);
    registry.register(createOpenResult());

    expect(registry.get('session-1')).toMatchObject({ byteLength: 20, encoding: 'utf-8' });
    expect(registry.consumeFirstWindow('session-1')?.text).toBe('hello');
    expect(registry.consumeFirstWindow('session-1')).toBeUndefined();
    expect(registry.get('session-1')).toMatchObject({ sessionId: 'session-1' });
  });

  it('rejects an oversized first window instead of retaining unbounded text', () => {
    const registry = new SegmentedSessionRegistry(4);
    expect(() => registry.register(createOpenResult())).toThrow('firstWindow');
    expect(registry.has('session-1')).toBe(false);
  });

  it('bounds the aggregate retained first-window text across restored tabs', () => {
    const registry = new SegmentedSessionRegistry(8, 8);
    const opened = createOpenResult();

    registry.register(withSession(opened, 'session-1'));
    registry.register(withSession(opened, 'session-2'));

    expect(registry.get('session-1')).toBeDefined();
    expect(registry.consumeFirstWindow('session-1')).toBeUndefined();
    expect(registry.consumeFirstWindow('session-2')?.text).toBe('hello');
  });

  it('accounts for the JS number array retained by utf16ByteOffsets', () => {
    const registry = new SegmentedSessionRegistry(64, 64);

    expect(() => registry.register(withUtf16Offsets(createOpenResult()))).toThrow('firstWindow');
    expect(registry.has('session-1')).toBe(false);
  });

  it('keeps the default per-window budget large enough for a maximum read-only window map', () => {
    const windowBytes = 256 * 1024;
    const opened = createOpenResult();
    opened.byteLength = windowBytes;
    opened.firstWindow = {
      ...opened.firstWindow,
      endByte: windowBytes,
      text: 'x'.repeat(windowBytes),
      utf16ByteOffsets: Array.from({ length: windowBytes + 1 }, (_, index) => index),
    };
    const registry = new SegmentedSessionRegistry();

    expect(() => registry.register(opened)).not.toThrow();
    expect(registry.consumeFirstWindow(opened.sessionId)).toBeDefined();
  });

  it('includes utf16ByteOffsets when enforcing the aggregate first-window capacity', () => {
    const registry = new SegmentedSessionRegistry(100, 100);
    const opened = withUtf16Offsets(createOpenResult());

    registry.register(withSession(opened, 'session-1'));
    registry.register(withSession(opened, 'session-2'));

    expect(registry.consumeFirstWindow('session-1')).toBeUndefined();
    expect(registry.consumeFirstWindow('session-2')?.text).toBe('hello');
  });

  it('rejects a per-window limit that can exceed the aggregate capacity', () => {
    expect(() => new SegmentedSessionRegistry(9, 8)).toThrow('maxFirstWindowBytes');
  });
});
