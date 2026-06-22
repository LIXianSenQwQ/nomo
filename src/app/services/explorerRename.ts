export interface ExplorerRenameSelectionRange {
  start: number;
  end: number;
}

export function getExplorerRenameSelectionRange(
  name: string,
  isDirectory: boolean,
): ExplorerRenameSelectionRange {
  if (isDirectory) {
    return { start: 0, end: name.length };
  }

  const extensionStart = name.lastIndexOf('.');
  return {
    start: 0,
    end: extensionStart > 0 ? extensionStart : name.length,
  };
}
