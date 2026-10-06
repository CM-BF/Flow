# TUI01D 接口与职责

`main --goal <uuid> [--headless]` 固定一个已存在 goal；没有 goal 时保持会话模式。统一私有 journal IO 提供原子 replace/fsync、独占锁、0600/0700 与大小检查；conversation codec 和文件名不变，goal codec 使用连接+goal 独立 namespace。

`createGoalTerminal` 包装 public `createGoalSession`，只保存草稿、通知、稳定 React snapshot、可见正文页。public session 独占 plan/state/history/body/intent/ACK；终端不复制其状态机。订阅缓存保证 Ink external-store snapshot 稳定。

slash 和 JSONL 共用 `execute`：help、plan/plan-next、observe（显式节点，默认当前计划页）、history/history-next、goal/input/explain/artifact/decision 显式展开、decide/cancel（从当前 state 派生 task/decision）、command（显式完整 GoalSessionCommand JSON）、recover、draft、quit。`command` 中旧 execute 仍 fixture，native 不隐式放权。计划/历史页20，观察最多50节点，正文显示窗口有界；刷新不重读正文，history 为历史而非当前有效性。

终端断开/EOF/信号只 dispose 观察并关闭日志，不 cancel。无自动命令、dispatch、模型解释。当前第一片通过显式 observe 刷新，不用轮询制造额外请求；后续可在相同公开 read seam 加按需观察策略。

headless 沿现有192KiB逐行 framing，仅把参数类型改为结构兼容的 execute/snapshot/dispose 接口，旧协议不变。两种 renderer 不知道中心私有对象或 journal 文件内容。
