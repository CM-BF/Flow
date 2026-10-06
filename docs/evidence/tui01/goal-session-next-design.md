# 终端目标会话后继（设计已领取实施）

来源：assignment_review于2026-10-06 12:11只读main eb95、O12固定60e495与TUI01A/C；本记录由Execution Lead归入唯一TUI-001。O12及公开@flow/interaction/goal现已main 362af3bac77541e5a60979326bcf4d4b8c947915。

终端和headless复用同一typed controller，slash只是语法。候选TUI01D先--goal显式模式：选择goal、plan/state/history轻读、input/explanation/artifact/decision正文按需；decide/cancel要求已观察的精确身份，recover沿原key/body。普通文本仍为草稿，不默认为拆图或执行。调用现O12 createGoalSession，不复制中心CAS/ACK/调度。当前conversation模式保持。

优先真实控制与跨客户端旅程，不等待全部模型能力/视觉。现有intent-store的通用私有文件I/O可在合法scope行为保持提取，conversation与goal各持自己的codec；禁止复制持久状态机。renderer使用subscribe快照或稳定cache，不直接用每次clone的snapshot作useSyncExternalStore读取。

候选scope仅apps/tui/src/goal、main.tsx、headless.ts、intent-store.ts、新private-journal.ts、README及自己plan/evidence，正式take时fresh核，不预占。验收复用公共PG/headless两个client与一个实际PTY：CAS拒绝不重发、未知ACK原intent恢复、断开不cancel、正文展开前零请求、兄弟状态变化不重读固定材料和57解释分页。Web实际同会话TUI→Web→TUI属于父08独立验收，不以headless或PTY冒充。

SVC05已达到固定隔离证据/独审安全点；同一worker已于12:27:56正式领取TUI01D九scope，在独立树实施已有控制旅程。此为资源顺序，不把Web完成设为TUI永久前置，不新建重复大task。

当前唯一实施来源：[TUI01D](../../../tui-goal-session/plans/tui01d-goal-session/plan.md)，父任务仍TUI-001。本文件保留设计背景，不复制子片进度或结论。
