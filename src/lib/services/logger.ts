/**
 * Nomo 日志工具
 *
 * 规则：仅在开发环境输出日志，打包后自动静默。
 * 使用 Vite 的 import.meta.env.DEV 判断环境。
 */

const IS_DEV = typeof import.meta !== 'undefined' && import.meta.env?.DEV === true;

/** 日志级别 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  tag: string;
  message: string;
  timestamp: string;
  data?: unknown;
}

let logBuffer: LogEntry[] = [];
const MAX_BUFFER_SIZE = 500;

function now(): string {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;
}

function pushLog(entry: LogEntry): void {
  if (!IS_DEV) {
    return;
  }
  logBuffer.push(entry);
  if (logBuffer.length > MAX_BUFFER_SIZE) {
    logBuffer = logBuffer.slice(logBuffer.length - MAX_BUFFER_SIZE);
  }

  const prefix = `[${entry.timestamp}][${entry.level.toUpperCase()}][${entry.tag}]`;
  switch (entry.level) {
    case 'debug':
      // eslint-disable-next-line no-console
      console.log(prefix, entry.message, entry.data ?? '');
      break;
    case 'info':
      // eslint-disable-next-line no-console
      console.info(prefix, entry.message, entry.data ?? '');
      break;
    case 'warn':
      // eslint-disable-next-line no-console
      console.warn(prefix, entry.message, entry.data ?? '');
      break;
    case 'error':
      // eslint-disable-next-line no-console
      console.error(prefix, entry.message, entry.data ?? '');
      break;
  }
}

export function logDebug(tag: string, message: string, data?: unknown): void {
  pushLog({ level: 'debug', tag, message, timestamp: now(), data });
}

export function logInfo(tag: string, message: string, data?: unknown): void {
  pushLog({ level: 'info', tag, message, timestamp: now(), data });
}

export function logWarn(tag: string, message: string, data?: unknown): void {
  pushLog({ level: 'warn', tag, message, timestamp: now(), data });
}

export function logError(tag: string, message: string, data?: unknown): void {
  pushLog({ level: 'error', tag, message, timestamp: now(), data });
}

/**
 * 创建一个计时器，用于测量异步操作耗时。
 * 使用方式：
 *   const timer = createPerfTimer('Settings', 'loadAppPreferences');
 *   await loadAppPreferences();
 *   timer.end();
 */
export function createPerfTimer(tag: string, operation: string) {
  const start = performance.now();
  const startTime = now();

  return {
    end(extraData?: Record<string, unknown>): void {
      const elapsed = Math.round(performance.now() - start);
      logDebug(tag, `${operation} 完成，耗时 ${elapsed}ms`, {
        startTime,
        elapsedMs: elapsed,
        ...extraData,
      });
    },
  };
}

/**
 * 测量并记录同步操作耗时。
 */
export function perf<T>(tag: string, operation: string, fn: () => T): T {
  const timer = createPerfTimer(tag, operation);
  try {
    return fn();
  } finally {
    timer.end();
  }
}

/**
 * 测量并记录异步操作耗时。
 */
export async function perfAsync<T>(tag: string, operation: string, fn: () => Promise<T>): Promise<T> {
  const timer = createPerfTimer(tag, operation);
  try {
    return await fn();
  } finally {
    timer.end();
  }
}

/** 获取当前日志缓冲区（仅开发环境有内容） */
export function getLogBuffer(): readonly LogEntry[] {
  return logBuffer;
}

/** 清空日志缓冲区 */
export function clearLogBuffer(): void {
  logBuffer = [];
}
