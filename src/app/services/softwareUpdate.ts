import { get } from 'svelte/store';
import { writable } from 'svelte/store';
import {
  checkSoftwareUpdate,
  downloadSoftwareUpdate,
  getSoftwareUpdateState,
  installSoftwareUpdate,
  listenSoftwareUpdateState,
  type DownloadedSoftwareUpdate,
  type SoftwareUpdateCandidate,
  type SoftwareUpdateSnapshot,
} from '../../lib/desktop/tauriUpdater';
import { isTauriRuntime } from '../../lib/desktop/tauriStorage';

const INITIAL_SOFTWARE_UPDATE_STATE: SoftwareUpdateSnapshot = {
  status: 'idle',
  currentVersion: '',
  installationKind: 'unsupported',
};

export const softwareUpdateState = writable<SoftwareUpdateSnapshot>({
  ...INITIAL_SOFTWARE_UPDATE_STATE,
});

let initializePromise: Promise<void> | null = null;
let stateUnlisten: (() => void) | null = null;

export async function initializeSoftwareUpdateCoordinator(): Promise<void> {
  if (!isTauriRuntime()) {
    softwareUpdateState.set({
      ...INITIAL_SOFTWARE_UPDATE_STATE,
      status: 'unsupported',
    });
    return;
  }
  if (initializePromise) {
    return initializePromise;
  }

  initializePromise = (async () => {
    stateUnlisten = await listenSoftwareUpdateState((state) => {
      softwareUpdateState.set(state);
    }).catch(() => null);
    const snapshot = await getSoftwareUpdateState().catch(() => null);
    if (snapshot) {
      softwareUpdateState.set(snapshot);
    }
  })();
  return initializePromise;
}

export async function disposeSoftwareUpdateCoordinator(): Promise<void> {
  stateUnlisten?.();
  stateUnlisten = null;
  initializePromise = null;
  softwareUpdateState.set({ ...INITIAL_SOFTWARE_UPDATE_STATE });
}

export async function runSoftwareUpdateCheck(startup = false): Promise<SoftwareUpdateSnapshot> {
  await initializeSoftwareUpdateCoordinator();
  await checkSoftwareUpdate({}, startup);
  return refreshSoftwareUpdateState();
}

export async function refreshSoftwareUpdateState(): Promise<SoftwareUpdateSnapshot> {
  const snapshot = await getSoftwareUpdateState();
  softwareUpdateState.set(snapshot);
  return snapshot;
}

export async function startSoftwareUpdateDownload(
  candidate: SoftwareUpdateCandidate,
): Promise<DownloadedSoftwareUpdate> {
  await initializeSoftwareUpdateCoordinator();
  try {
    return await downloadSoftwareUpdate(candidate);
  } finally {
    await refreshSoftwareUpdateState().catch(() => undefined);
  }
}

export async function startSoftwareUpdateInstall(
  downloadedUpdate: DownloadedSoftwareUpdate,
): Promise<void> {
  await initializeSoftwareUpdateCoordinator();
  try {
    await installSoftwareUpdate(downloadedUpdate);
  } finally {
    await refreshSoftwareUpdateState().catch(() => undefined);
  }
}

export function currentSoftwareUpdateState(): SoftwareUpdateSnapshot {
  return get(softwareUpdateState);
}
