# TUI01E 聊天队列控制与续接

2026-10-06 13:45 UTC，in-progress。所属大task [TUI-001](../../../tui-client/plans/tui01-terminal-client/plan.md)，追溯 TUI001-06/08；co-lead Execution Lead。owner assignment_review / gpt-6-astra。

用户在原聊天终端使用 `/queue [next]` 查看最多20项轻引用，`/pause` 暂停后续提升，`/resume` 显式恢复。暂停不停止当前任务；恢复可能提升下一项并触发已配置执行。复用公开 FlowClient、现 controller 单一 durable intent 和私有 journal，不建队列/授权/调度第二权威。

实现 Interface 见 [interface.md](../../docs/evidence/tui01e/interface.md)。新命令从已观察队列冻结 expectedQueueRevision，resume 同时冻结 currentTurn.taskId/null。先落原 key/body 再 POST；未知 ACK 不清理；`/recover` 只显式重放原请求。确定 CAS 拒绝保留草稿、恢复读取，不自动改 revision 重投。旧 create/send v1 journal 逐字可读；旧ACK校验不变。

有界公开HTTP/随机PG双client旅程、真实PTY与JSONL是已授权 seam；0provider、动态端口、自有DB/临时文件/子进程清理。未知capability/无queue端口拒绝，旧终端交互和goal模式保持；不新增 enqueue/steer/cancel/decision、附件或Web实现。本片两个公开客户端不代替真实浏览器交替，父08保持open。

- [x] **TUI01E-01** 固定公开Interface、独立worktree/claim和技能方法。
- [x] **TUI01E-02** 复用controller/journal接队列轻读与pause/resume，旧create/send兼容。
- [x] **TUI01E-03** 双公开client真实PG/HTTP及PTY验证冲突、未知ACK、草稿、退出和资源界限。
- [ ] **TUI01E-04** 固定证据/独立review/受控main接收；完整双端和provider后继不冒完成。

遵循[根模块规则](../../AGENTS.md#modular-design)。新领域特例留私有 queue-control 映射/校验；共享controller持有唯一 epoch、pending、dispatch和journal释放，UI只渲染与语法。无共享协议/migration/依赖新增。
