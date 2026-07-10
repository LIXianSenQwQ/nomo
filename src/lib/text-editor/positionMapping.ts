import type { SegmentedLineEnding, SegmentedWindow } from './protocol';

export type PositionBias = 'left' | 'right';

interface MappingSegment {
  localStart: number;
  localEnd: number;
  storageStart: number;
  storageEnd: number;
  byteStart: number;
  byteEnd: number;
}

export interface GlobalByteRange {
  fromByte: number;
  toByte: number;
}

/**
 * 一个窗口内的 UTF-16/UTF-8 双向映射。
 * segment 只在完整 Unicode code point 或完整 CRLF 两侧建立边界，避免产生半个字符的位置。
 */
export class WindowPositionMapping {
  readonly editorText: string;
  readonly startByte: number;
  readonly endByte: number;
  readonly storageText: string;

  private readonly segments: MappingSegment[];

  constructor(
    storageText: string,
    startByte = 0,
    expectedEndByte?: number,
    originalByteOffsets?: readonly number[],
  ) {
    if (!Number.isSafeInteger(startByte) || startByte < 0) {
      throw new RangeError('startByte 必须是非负安全整数');
    }

    this.storageText = storageText;
    this.startByte = startByte;
    const { editorText, segments, byteLength } = buildSegments(storageText, originalByteOffsets);
    this.editorText = editorText;
    this.segments = segments;
    this.endByte = startByte + byteLength;

    if (expectedEndByte !== undefined && expectedEndByte !== this.endByte) {
      throw new RangeError(
        `窗口字节范围与文本不一致：expected=${expectedEndByte}, actual=${this.endByte}`,
      );
    }
  }

  localToGlobalByte(localOffset: number, bias: PositionBias = 'left') {
    assertOffset(localOffset, 0, this.editorText.length, 'localOffset');
    if (localOffset === this.editorText.length) {
      return this.endByte;
    }
    const segment = findByLocalOffset(this.segments, localOffset);
    if (!segment || localOffset === segment.localStart) {
      return this.startByte + (segment?.byteStart ?? 0);
    }
    if (localOffset === segment.localEnd) {
      return this.startByte + segment.byteEnd;
    }
    return this.startByte + (bias === 'left' ? segment.byteStart : segment.byteEnd);
  }

  globalByteToLocal(globalByte: number, bias: PositionBias = 'left') {
    assertOffset(globalByte, this.startByte, this.endByte, 'globalByte');
    if (globalByte === this.endByte) {
      return this.editorText.length;
    }
    const relativeByte = globalByte - this.startByte;
    const segment = findByByteOffset(this.segments, relativeByte);
    if (!segment || relativeByte === segment.byteStart) {
      return segment?.localStart ?? 0;
    }
    if (relativeByte === segment.byteEnd) {
      return segment.localEnd;
    }
    return bias === 'left' ? segment.localStart : segment.localEnd;
  }

  localToStorageOffset(localOffset: number, bias: PositionBias = 'left') {
    assertOffset(localOffset, 0, this.editorText.length, 'localOffset');
    if (localOffset === this.editorText.length) {
      return this.storageText.length;
    }
    const segment = findByLocalOffset(this.segments, localOffset);
    if (!segment || localOffset === segment.localStart) {
      return segment?.storageStart ?? 0;
    }
    if (localOffset === segment.localEnd) {
      return segment.storageEnd;
    }
    return bias === 'left' ? segment.storageStart : segment.storageEnd;
  }

  storageOffsetToLocal(storageOffset: number, bias: PositionBias = 'left') {
    assertOffset(storageOffset, 0, this.storageText.length, 'storageOffset');
    if (storageOffset === this.storageText.length) {
      return this.editorText.length;
    }
    const segment = findByStorageOffset(this.segments, storageOffset);
    if (!segment || storageOffset === segment.storageStart) {
      return segment?.localStart ?? 0;
    }
    if (storageOffset === segment.storageEnd) {
      return segment.localEnd;
    }
    return bias === 'left' ? segment.localStart : segment.localEnd;
  }

  localRangeToGlobalBytes(from: number, to: number): GlobalByteRange {
    if (from > to) {
      throw new RangeError('from 不得大于 to');
    }
    return {
      fromByte: this.localToGlobalByte(from, 'left'),
      toByte: this.localToGlobalByte(to, 'right'),
    };
  }
}

export function createWindowPositionMapping(window: SegmentedWindow) {
  return new WindowPositionMapping(
    window.text,
    window.startByte,
    window.endByte,
    window.utf16ByteOffsets,
  );
}

export function utf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

export function normalizeInsertedTextForLineEnding(value: string, lineEnding: SegmentedLineEnding) {
  const normalized = value.replace(/\r\n|\r/g, '\n');
  return lineEnding === 'crlf' ? normalized.replace(/\n/g, '\r\n') : normalized;
}

function buildSegments(storageText: string, originalByteOffsets?: readonly number[]) {
  if (originalByteOffsets) validateOriginalByteOffsets(storageText, originalByteOffsets);
  const segments: MappingSegment[] = [];
  const editorParts: string[] = [];
  let storageOffset = 0;
  let localOffset = 0;
  let byteOffset = 0;

  while (storageOffset < storageText.length) {
    const storageStart = storageOffset;
    const localStart = localOffset;
    const byteStart = originalByteOffsets?.[storageStart] ?? byteOffset;
    let editorValue: string;

    if (storageText[storageOffset] === '\r') {
      const hasLf = storageText[storageOffset + 1] === '\n';
      storageOffset += hasLf ? 2 : 1;
      editorValue = '\n';
    } else {
      const codePoint = storageText.codePointAt(storageOffset);
      if (codePoint === undefined) {
        break;
      }
      editorValue = String.fromCodePoint(codePoint);
      storageOffset += editorValue.length;
    }

    localOffset += editorValue.length;
    byteOffset =
      originalByteOffsets?.[storageOffset] ??
      byteOffset + utf8ByteLength(storageText.slice(storageStart, storageOffset));
    editorParts.push(editorValue);
    segments.push({
      localStart,
      localEnd: localOffset,
      storageStart,
      storageEnd: storageOffset,
      byteStart,
      byteEnd: byteOffset,
    });
  }

  return {
    editorText: editorParts.join(''),
    segments,
    byteLength: byteOffset,
  };
}

function validateOriginalByteOffsets(storageText: string, offsets: readonly number[]) {
  if (offsets.length !== storageText.length + 1 || offsets[0] !== 0) {
    throw new RangeError('utf16ByteOffsets 必须覆盖窗口文本的每个 UTF-16 边界');
  }
  let previous = 0;
  for (const offset of offsets) {
    if (!Number.isSafeInteger(offset) || offset < previous) {
      throw new RangeError('utf16ByteOffsets 必须是单调非降的安全整数');
    }
    previous = offset;
  }
}

function findByLocalOffset(segments: MappingSegment[], offset: number) {
  return binaryFind(segments, offset, (segment) => [segment.localStart, segment.localEnd]);
}

function findByByteOffset(segments: MappingSegment[], offset: number) {
  return binaryFind(segments, offset, (segment) => [segment.byteStart, segment.byteEnd]);
}

function findByStorageOffset(segments: MappingSegment[], offset: number) {
  return binaryFind(segments, offset, (segment) => [segment.storageStart, segment.storageEnd]);
}

function binaryFind(
  segments: MappingSegment[],
  offset: number,
  rangeOf: (segment: MappingSegment) => readonly [number, number],
) {
  let low = 0;
  let high = segments.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const segment = segments[middle];
    const [start, end] = rangeOf(segment);
    if (offset < start) {
      high = middle - 1;
    } else if (offset > end) {
      low = middle + 1;
    } else {
      return segment;
    }
  }
  return undefined;
}

function assertOffset(value: number, min: number, max: number, name: string) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} 必须位于 ${min}..${max}`);
  }
}
