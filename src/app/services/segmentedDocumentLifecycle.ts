import type { SegmentedDocumentPort } from '../../lib/text-editor/protocol';
import type { Tab } from '../types';
import { isSegmentedTextTab } from './tabs';

export interface SegmentedWorkspaceLifecycleHandle {
  flushPendingEdits(): Promise<void>;
}

/**
 * 活动文档离开 WebView 前的唯一刷新边界：先等待 CodeMirror 增量确认，再用最新 revision 落盘恢复日志。
 * Markdown 和空标签不接触分段端口，避免两套正文生命周期互相渗透。
 */
export async function flushSegmentedDocumentBeforeTransition(
  tab: Tab | undefined,
  workspace: SegmentedWorkspaceLifecycleHandle | null,
  port: Pick<SegmentedDocumentPort, 'flushJournal'>,
) {
  if (!isSegmentedTextTab(tab)) return;
  await workspace?.flushPendingEdits();
  await port.flushJournal(tab.sessionId, tab.revision);
}
