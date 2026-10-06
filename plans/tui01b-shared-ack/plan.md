# TUI01B 共享会话回执与终端恢复

2026-10-06；in-progress。所属大task [TUI-001](../../../tui-client/plans/tui01-terminal-client/plan.md)，co-lead Execution Lead，runner_owner/gpt-6-astra唯一owner。对应父TUI001-09；引用[模块规则](../../AGENTS.md#modular-design)，不另造协议或历史权威。

目标：Web/TUI通过client窄decoder校验两类ACK；未知响应保留原key/body供显式恢复。TUI遇另一客户端已推进revision导致409，保留draft、不自动重新提交，恢复只读刷新和轮询；一端退出不取消中心任务。

- [x] TUI01B-01 现代码/共享设计核对，独立领取与小Interface。
- [ ] TUI01B-02 共享decoder与两POST真实HTTP，冻结输入/未知ACK/上界/上下文。
- [ ] TUI01B-03 TUI复用与过期CAS观察恢复；双公开client有界实际HTTP。
- [ ] TUI01B-04 定向检查、固定证据、独立review/main。
- [ ] TUI01B-05 Web真实消费者由外部owner按固定Interface接入，成套验收父任务09。

已授权取舍：共享模块仅协议字段/冻结请求身份，消费者保留outbox/journal/epoch/history/capability显示策略。queue专用匹配和冻结输入保留，可转调共享context纯校验。无新deps/contracts/migration，0provider，不碰个人服务。直接seam：公开FlowClient实际HTTP、共享puredecoder、createInteractionController；不为抽取重跑无关全集。

依赖/风险：Web projection/receipts当前writer由Lead协调；本树不修改Web。成功ACK不证明任务完成，旧receipt不能覆盖新GET。输入JSON仅序列化一次，与被发字节的脱离副本校验。全部未知错误不含raw原文/token；4xx原语义保留。详细边界见[Interface](../../docs/evidence/tui01b/interface.md)。
