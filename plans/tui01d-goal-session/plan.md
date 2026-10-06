# TUI01D — 终端目标会话

状态：in-progress。创建/更新：2026-10-06。所属 [TUI-001](../../../tui-client/plans/tui01-terminal-client/plan.md)，co-lead Execution Lead。遵循[模块边界](../../AGENTS.md#modular-design)。

显式 `--goal <id>` 选择目标，复用已发布 `@flow/interaction/goal`。终端负责语法和显示，中心与公共 controller 保持权威；不复制调度、权限、ACK 状态机。普通正文留作草稿。计划/执行/历史轻读，正文按固定引用显式读取。决定、取消从当前观察派生身份；恢复原 key/body，不自动重发。旧会话模式与私有记录格式保持。

- [x] TUI01D-01：独立领取、职责/接口与共享私有日志设计。
- [ ] TUI01D-02：goal slash/headless/Ink 接入及旧会话兼容。
- [ ] TUI01D-03：真实 HTTP/PG 双客户端、ACK、轻读/57历史与 PTY 局部检查。
- [ ] TUI01D-04：独立审查与 main 接收。
- [ ] TUI01D-05：父计划后继真实 TUI→Web→TUI 完整验收（本片不冒认）。

接口见 [interface](../../docs/evidence/tui01d/interface.md)。0 provider；隔离随机数据库/动态端口/自有进程，个人服务不操作。不增加依赖；共享 export/client/server 不在此范围。检查覆盖公开行为及既有 journal/headless 直接消费者。退出断观察，不取消中心工作。
