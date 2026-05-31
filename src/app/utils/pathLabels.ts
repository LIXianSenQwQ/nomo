export function getFolderName(path: string) {
  if (!path || path === '当前文件夹') {
    return '当前文件夹';
  }

  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  const lastPart = parts[parts.length - 1] || path;

  if (lastPart.endsWith(':')) {
    return lastPart + '\\';
  }

  return lastPart;
}

export function getDirectoryLabel(path: string) {
  const normalizedPath = path.replace(/\//g, '\\');
  const separatorIndex = normalizedPath.lastIndexOf('\\');
  if (separatorIndex <= 0) {
    return '当前文件夹';
  }

  return normalizedPath.slice(0, separatorIndex);
}

export function getCompactPath(path: string) {
  const normalizedPath = path.replace(/\//g, '\\');
  const parts = normalizedPath.split('\\').filter(Boolean);

  if (parts.length <= 3) {
    return normalizedPath;
  }

  return `...\\${parts.slice(-3).join('\\')}`;
}
