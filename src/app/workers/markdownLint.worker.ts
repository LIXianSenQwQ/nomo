/// <reference lib="webworker" />

import type { Configuration, LintError } from 'markdownlint';
import { lint } from 'markdownlint/sync';
import relaxedRules from 'markdownlint/style/relaxed';
import type {
  MarkdownLintIssue,
  MarkdownLintWorkerRequest,
  MarkdownLintWorkerResponse,
} from '../../lib/markdown-lint/types';

const RESULT_LIMIT = 200;
const workerScope: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

workerScope.onmessage = (event: MessageEvent<MarkdownLintWorkerRequest>) => {
  const request = event.data;
  try {
    const config: Configuration =
      request.ruleSet === 'relaxed'
        ? (relaxedRules as Configuration)
        : ({ default: true } as Configuration);
    const result = lint({
      strings: { document: request.markdown },
      config,
      handleRuleFailures: true,
    });
    const errors = result.document ?? [];
    const response: MarkdownLintWorkerResponse = {
      requestId: request.requestId,
      tabId: request.tabId,
      version: request.version,
      ruleSet: request.ruleSet,
      total: errors.length,
      issues: errors.slice(0, RESULT_LIMIT).map(toMarkdownLintIssue),
      checkedAt: Date.now(),
    };
    workerScope.postMessage(response);
  } catch (error) {
    const response: MarkdownLintWorkerResponse = {
      requestId: request.requestId,
      tabId: request.tabId,
      version: request.version,
      ruleSet: request.ruleSet,
      error: error instanceof Error ? error.message : String(error),
    };
    workerScope.postMessage(response);
  }
};

function toMarkdownLintIssue(error: LintError): MarkdownLintIssue {
  const canonicalRuleId = error.ruleNames.find((name) => /^MD\d{3}$/i.test(name));
  return {
    ruleId: (canonicalRuleId ?? error.ruleNames[0] ?? 'markdownlint').toUpperCase(),
    ruleDescription: error.ruleDescription,
    lineNumber: error.lineNumber,
    columnNumber: error.errorRange?.[0] ?? null,
    rangeLength: error.errorRange?.[1] ?? null,
    errorDetail: error.errorDetail,
    errorContext: error.errorContext,
  };
}
