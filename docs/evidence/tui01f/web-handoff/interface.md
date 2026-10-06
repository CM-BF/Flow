# TUI01F-04 — 固定双界面旅程 Interface

实现授权已由 Execution Lead 在原 TUI-001 TODO06/08 下给出。只有此 test/experiment 片段可写；原生产 controller、Ink、journal、client 与中心状态机保持固定。

| Module | Interface 与状态所有者 |
| --- | --- |
| CancelJourney test fixture | 原默认三任务/lost ACK recipe 不变。新增显式 handoff recipe：固定 af51 createServer factory、两个公开承认的 task、实际 assistant-final、只读内存连接描述、owned PTY group 注册；资源 marker、停止、checkpoint 和正常清理仍唯一归它。 |
| preview.ts | 只读固定 af51 artifact 验证/releaseAsset；固定 d629/source506 真实字节。一个本会话 HTTP bridge 允许两个 Web turns、一个延迟 TUI turn 和一次 A cancel；保留原 key/body/status，不篡改业务回执。拒绝其他写口，SSE有背压/断开取消，上限拒绝。 |
| terminal.py | 启动真实 Ink PTY，先原多行草稿发送；收到真实409后确认草稿，再模拟用户明确清空，发一次取消，显式recover，保留新草稿退出。父进程拥有 PGID；不自行假称完整停止。 |
| journey.ts | 只编排一个合成会话/两任务的真实 DOM 与 PTY；公共状态作佐证。工作错误和收尾错误分开，逐步耐久证据先于不可逆清理。 |

后端固定 `af51c621696230fbced12227670f014ca73bd8a1`，从 personal-history-compatibility 的已审只读视图显式导入；不改它的源或依赖。TUI采用本树 ec30 七源；fixture runner/verifier保留本树a89组合，并分别绑定。此新三方组合未运行，不能继承RELEASE/R01的完整结论。Web artifact `d629631d21eedd2afa308c562b31e57fc8597703a57a4c989c5a4af4fefd5e88` / source `5069586a9f17332de526e101eca3a4250cbc8d91`，真实Chrome而非壳页/API代替界面。

验收：TUI冻结r请求→Web实际发送A/r+1→放行原TUI请求得409且草稿完整/仅一次POST→用户明确清空后取消当前A一次→两界面观察A取消→Web发送B→TUI只读recover显示B→退出且B不取消→fixture释放B→真实Web显示最终内容。unknown不重投、不生成新key；受理不等于停止；fixture最终结果不代表模型。

本阶段仅源码、静态和有界便宜纯检查。真实PG/Chrome/PTY需要固定driver独审、fresh资源和另行串行窗口；120s行为+60s收尾、4MiB总raw/16MiB私有增量仅候选。独立总监督覆盖pending finally，unknown保留DB/tmp，不FORCE。原03失败、清理修复和main回执保持。

技能：已读本地find-skills、codebase-design、clean-code、brainstorming、webapp-testing，沿已批准有界设计直接实施，不另建计划；只复用已有身份/状态和资源深Module。使用实际可见条件，不以networkidle作为SSE结束；固定权限与资源先于测试便利。
