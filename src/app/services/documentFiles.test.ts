import { describe, expect, it } from 'vitest';
import { t } from '../i18n';
import { resolveExternalFileChange } from './documentFiles';

describe('resolveExternalFileChange', () => {
  const baseInput = {
    desktopEnabled: true,
    nativePath: 'D:\\Demo\\Workspace\\demo.md',
    lastKnownModifiedAt: 100,
    dirty: false,
  };

  it('returns none when the file timestamp has not changed', () => {
    expect(
      resolveExternalFileChange({
        ...baseInput,
        status: { exists: true, modifiedAt: 100 },
      }),
    ).toEqual({
      type: 'none',
      path: null,
      modifiedAt: 0,
      dirtyAtDetection: false,
      message: '',
    });
  });

  it('returns deleted when the native path no longer exists', () => {
    expect(
      resolveExternalFileChange({
        ...baseInput,
        dirty: true,
        status: { exists: false, modifiedAt: 0 },
      }),
    ).toEqual({
      type: 'deleted',
      path: 'D:\\Demo\\Workspace\\demo.md',
      modifiedAt: 0,
      dirtyAtDetection: true,
      message: t.externalFileDeleted(),
    });
  });

  it('returns modified when the file timestamp is newer than the loaded version', () => {
    expect(
      resolveExternalFileChange({
        ...baseInput,
        status: { exists: true, modifiedAt: 120 },
      }),
    ).toEqual({
      type: 'modified',
      path: 'D:\\Demo\\Workspace\\demo.md',
      modifiedAt: 120,
      dirtyAtDetection: false,
      message: t.externalFileModifiedClean(),
    });
  });

  it('returns none when desktop state cannot be checked yet', () => {
    expect(
      resolveExternalFileChange({
        ...baseInput,
        desktopEnabled: false,
        status: { exists: true, modifiedAt: 120 },
      }).type,
    ).toBe('none');
    expect(
      resolveExternalFileChange({
        ...baseInput,
        nativePath: null,
        status: { exists: true, modifiedAt: 120 },
      }).type,
    ).toBe('none');
    expect(
      resolveExternalFileChange({
        ...baseInput,
        lastKnownModifiedAt: 0,
        status: { exists: true, modifiedAt: 120 },
      }).type,
    ).toBe('none');
  });
});
