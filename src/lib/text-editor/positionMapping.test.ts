import { describe, expect, it } from 'vitest';
import { createWindowPositionMapping, normalizeInsertedTextForLineEnding } from './positionMapping';

describe('WindowPositionMapping', () => {
  it('maps CRLF as one editor newline and preserves UTF-8 byte boundaries', () => {
    const mapping = createWindowPositionMapping({
      revision: 0,
      startByte: 100,
      endByte: 111,
      startLine: 9,
      text: 'A\r\n中😀B',
      leadingPartialLine: false,
      trailingPartialLine: false,
      indexProgress: 1,
    });

    expect(mapping.editorText).toBe('A\n中😀B');
    expect(mapping.localToGlobalByte(0)).toBe(100);
    expect(mapping.localToGlobalByte(1)).toBe(101);
    expect(mapping.localToGlobalByte(2)).toBe(103);
    expect(mapping.localToGlobalByte(3)).toBe(106);
    expect(mapping.localToGlobalByte(5)).toBe(110);
    expect(mapping.localToGlobalByte(6)).toBe(111);
  });

  it('uses an explicit bias when a byte or UTF-16 offset is inside one character', () => {
    const mapping = createWindowPositionMapping({
      revision: 0,
      startByte: 0,
      endByte: 7,
      startLine: 0,
      text: '中😀',
      leadingPartialLine: false,
      trailingPartialLine: false,
      indexProgress: 1,
    });

    expect(mapping.localToGlobalByte(2, 'left')).toBe(3);
    expect(mapping.localToGlobalByte(2, 'right')).toBe(7);
    expect(mapping.globalByteToLocal(1, 'left')).toBe(0);
    expect(mapping.globalByteToLocal(1, 'right')).toBe(1);
    expect(mapping.globalByteToLocal(5, 'left')).toBe(1);
    expect(mapping.globalByteToLocal(5, 'right')).toBe(3);
  });

  it('rejects a window whose byte range cuts through its decoded text', () => {
    expect(() =>
      createWindowPositionMapping({
        revision: 0,
        startByte: 0,
        endByte: 2,
        startLine: 0,
        text: '中',
        leadingPartialLine: false,
        trailingPartialLine: false,
        indexProgress: 1,
      }),
    ).toThrow('窗口字节范围');
  });

  it('converts editor newlines back to the session line ending for inserted text', () => {
    expect(normalizeInsertedTextForLineEnding('a\nb\r\nc', 'crlf')).toBe('a\r\nb\r\nc');
    expect(normalizeInsertedTextForLineEnding('a\r\nb\rc', 'lf')).toBe('a\nb\nc');
  });

  it('uses Rust-provided original byte offsets for a lossy readonly window', () => {
    const mapping = createWindowPositionMapping({
      revision: 0,
      startByte: 10,
      endByte: 17,
      startLine: 0,
      text: 'a\u{fffd}\u{1f600}b',
      utf16ByteOffsets: [0, 1, 2, 2, 6, 7],
      leadingPartialLine: false,
      trailingPartialLine: false,
      indexProgress: 1,
    });

    expect(mapping.endByte).toBe(17);
    expect(mapping.localToGlobalByte(2)).toBe(12);
    expect(mapping.localToGlobalByte(3, 'left')).toBe(12);
    expect(mapping.localToGlobalByte(4)).toBe(16);
    expect(mapping.globalByteToLocal(13, 'left')).toBe(2);
    expect(mapping.globalByteToLocal(13, 'right')).toBe(4);
  });
});
