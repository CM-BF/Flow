# TUI01G：Claude 逐消息设置

状态：in-progress。所属大task：[TUI-001](../../../tui-client/plans/tui01-terminal-client/plan.md)，co-lead Execution Lead。

使终端与 headless typed commands 可发现当前公开配置、选择完整允许组合，并把下一条消息的请求设置可靠保存。遵循[根模块规则](../../AGENTS.md#modular-design)。不新增后端、权限、Codex 会话支持或 provider 请求。旧无能力普通聊天保持。

## 已确定 Interface

见[固定设计](../../docs/evidence/tui01g/interface.md)。使用可选 FlowClient 目录端口；现有 intentSchema 已接受 messageSettings，原 journal / ACK / recover 单一权威保持。有限选择模块隐藏目录解码、profile 三元关联和实际观察投影；controller 负责 epoch、下一消息选择与命令调度，Ink 只展示。

## TODO

- [x] TUI01G-01：精确范围交接、唯一计划及 Interface 固定。
- [x] TUI01G-02：有限目录选择、冻结发送和 requested/observed/unknown 展示。
- [x] TUI01G-03：定向合同/controller 与终端直接消费者检查；原资源 NOT_RUN 与首次依赖失败保留，51 个不同用例分轮通过、focused types 通过。
- [ ] TUI01G-04：独立审查及受控 main 接收。

## 验收与限制

选择必须来自当前页原样 tuple，当前 GET capability/profile 三元一致；无能力显式 unsupported；切换会话不得沿用选择；丢 ACK/矛盾 ACK 留原 key/body，恢复不重新查目录；成功仅清除已结算选择；CAS 409 草稿保留、不自动复投。观察值只来自绑定当前 task 的合法 final wrapper，thinking 永为 unknown，不从请求猜观察。

局部纯/注入检查优先；HTTP/PTY/PG 或 provider 均未获本片运行窗口，不冒充真实完整旅程。F04 冻结源/失败证据不改。架构变更仅 interaction optional port 和显示投影，固定后由 Execution Lead 登记 dashboard 架构 target。
