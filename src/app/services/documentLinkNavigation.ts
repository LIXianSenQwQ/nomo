import { dirname, isAbsolute, resolve } from '@tauri-apps/api/path';
import type { DocumentKind } from '../types';
import { getDocumentKindFromPath } from './tabs';

const EXTERNAL_LINK_PROTOCOL = /^(?:https?|mailto):/i;
const LINK_PROTOCOL = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;
const WINDOWS_DRIVE_PATH = /^[a-zA-Z]:[\\/]/;
const UNC_PATH = /^(?:\\\\|\/\/)/;
const ATTACHMENT_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'csv',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'svg',
  'avif',
]);

export type EditorLinkResolutionErrorCode =
  | 'invalid-encoding'
  | 'unsupported-protocol'
  | 'file-uri-unsupported'
  | 'query-unsupported'
  | 'unc-unsupported'
  | 'save-document-first'
  | 'unsupported-local-type'
  | 'empty-fragment';

export class EditorLinkResolutionError extends Error {
  constructor(public readonly code: EditorLinkResolutionErrorCode) {
    super(code);
    this.name = 'EditorLinkResolutionError';
  }
}

export type ResolvedEditorLink =
  | { kind: 'external'; href: string }
  | { kind: 'anchor'; fragment: string }
  | {
      kind: 'document';
      path: string;
      documentKind: DocumentKind;
      fragment?: string;
    }
  | { kind: 'attachment'; path: string; fragment?: string };

/**
 * 将编辑器中的 href 分类并把本地相对路径解析为系统绝对路径。
 * 文件存在性和普通文件校验由实际打开端口负责，避免解析与打开使用两套事实源。
 */
export async function resolveEditorLink(
  hrefValue: string,
  currentDocumentPath: string | null,
): Promise<ResolvedEditorLink> {
  const href = hrefValue.trim();
  if (EXTERNAL_LINK_PROTOCOL.test(href)) {
    return { kind: 'external', href };
  }
  if (/^file:/i.test(href)) {
    throw new EditorLinkResolutionError('file-uri-unsupported');
  }
  if (WINDOWS_DRIVE_PATH.test(href) === false && LINK_PROTOCOL.test(href)) {
    throw new EditorLinkResolutionError('unsupported-protocol');
  }

  if (href.startsWith('#')) {
    const fragment = decodeLinkPart(href.slice(1));
    if (!fragment.trim()) throw new EditorLinkResolutionError('empty-fragment');
    return { kind: 'anchor', fragment };
  }

  const fragmentIndex = href.indexOf('#');
  const localPart = fragmentIndex >= 0 ? href.slice(0, fragmentIndex) : href;
  const rawFragment = fragmentIndex >= 0 ? href.slice(fragmentIndex + 1) : '';
  if (localPart.includes('?')) {
    throw new EditorLinkResolutionError('query-unsupported');
  }

  const decodedPath = decodeLinkPart(localPart);
  const fragment = rawFragment ? decodeLinkPart(rawFragment) : undefined;
  if (isUncPath(decodedPath)) {
    throw new EditorLinkResolutionError('unc-unsupported');
  }

  const absolute = await isAbsolute(decodedPath);
  if (!absolute && !currentDocumentPath) {
    throw new EditorLinkResolutionError('save-document-first');
  }
  if (currentDocumentPath && isUncPath(currentDocumentPath)) {
    throw new EditorLinkResolutionError('unc-unsupported');
  }

  const path = absolute
    ? await resolve(decodedPath)
    : await resolve(await dirname(currentDocumentPath!), decodedPath);
  if (isUncPath(path)) {
    throw new EditorLinkResolutionError('unc-unsupported');
  }

  const documentKind = getDocumentKindFromPath(path);
  if (documentKind) {
    return { kind: 'document', path, documentKind, fragment };
  }

  const extension = getPathExtension(path);
  if (ATTACHMENT_EXTENSIONS.has(extension)) {
    return { kind: 'attachment', path, fragment };
  }

  throw new EditorLinkResolutionError('unsupported-local-type');
}

function decodeLinkPart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new EditorLinkResolutionError('invalid-encoding');
  }
}

function getPathExtension(path: string): string {
  const fileName = path.replace(/\\/g, '/').split('/').pop() ?? '';
  const separatorIndex = fileName.lastIndexOf('.');
  return separatorIndex >= 0 ? fileName.slice(separatorIndex + 1).toLowerCase() : '';
}

function isUncPath(path: string): boolean {
  const normalized = path.replace(/\//g, '\\');
  if (/^\\\\\?\\[a-zA-Z]:\\/.test(normalized)) return false;
  return UNC_PATH.test(path);
}
