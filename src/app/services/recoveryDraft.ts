export interface RecoveryDraft {
  reason: string;
  fileName: string;
  filePath: string;
  nativePath: string | null;
  markdown: string;
  savedAt: number;
}

export function writeRecoveryDraft(key: string, draft: Omit<RecoveryDraft, 'savedAt'>) {
  localStorage.setItem(
    key,
    JSON.stringify({
      ...draft,
      savedAt: Date.now(),
    }),
  );
}
