/**
 * 跨 NodeView 的编辑态协调注册表
 *
 * 行内代码、行公式等使用 <input> 编辑态的 NodeView 共享此注册表，
 * 确保同一时刻只有一个 NodeView 处于编辑态。
 */

type ExitEditFn = () => void;

let currentExitFn: ExitEditFn | null = null;

/** 注册当前正在编辑的实例的退出回调（进入编辑态时调用） */
export function registerActiveEdit(exitFn: ExitEditFn): void {
  // 先退出上一个
  if (currentExitFn && currentExitFn !== exitFn) {
    currentExitFn();
  }
  currentExitFn = exitFn;
}

/** 注销（退出编辑态时调用） */
export function unregisterActiveEdit(exitFn: ExitEditFn): void {
  if (currentExitFn === exitFn) {
    currentExitFn = null;
  }
}
