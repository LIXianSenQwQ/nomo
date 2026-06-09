import type { SettingRecord } from '../../lib/desktop/tauriStorage';

export const FIRST_RUN_SAMPLE_DOCUMENT_OPENED_KEY = 'firstRunSampleDocumentOpened';
export const FIRST_RUN_SAMPLE_DOCUMENT_OPEN_ERROR_KEY = 'firstRunSampleDocumentOpenError';

export interface FirstRunSampleState {
  settings: Pick<SettingRecord, 'key' | 'valueJson'>[];
  recentFilesCount: number;
  restoredWorkspaceTabs: boolean;
  hasPendingFolder: boolean;
}

export function hasHandledFirstRunSample(settings: Pick<SettingRecord, 'key' | 'valueJson'>[]) {
  const record = settings.find((setting) => setting.key === FIRST_RUN_SAMPLE_DOCUMENT_OPENED_KEY);
  if (!record) {
    return false;
  }

  try {
    return JSON.parse(record.valueJson) === true;
  } catch {
    return false;
  }
}

export function shouldOpenFirstRunSample(input: FirstRunSampleState) {
  return (
    !hasHandledFirstRunSample(input.settings) &&
    !input.restoredWorkspaceTabs &&
    !input.hasPendingFolder &&
    input.recentFilesCount === 0
  );
}

export function shouldMarkFirstRunSampleHandled(input: FirstRunSampleState) {
  return !hasHandledFirstRunSample(input.settings) && !shouldOpenFirstRunSample(input);
}
