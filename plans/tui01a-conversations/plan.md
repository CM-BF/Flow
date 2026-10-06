# TUI01A 基础会话终端

状态：in-progress。创建/更新2026-10-06。所属大task：[TUI-001](../tui01-terminal-client/plan.md)。co-lead Execution Lead。唯一owner runner_owner/gpt-6-astra。[统一模块规则](../../AGENTS.md#modular-design)。

首片范围为 [Interface](../../docs/evidence/tui01a/interface.md) 中共享命令/controller、Ink与headless、私有未决intent和基础会话。中心持久事实不复制；slash仅语法层，不建立第二协议/agent loop。原文/身份/epoch、未知ACK与退出不cancel是验收不变量。

- [x] TUI01A-01 固定API/依赖候选与合法scope；依赖锁曾精确移交并固定1cec921，已交还Lead。
- [x] TUI01A-02 共享descriptor/typed handler/controller与持久intent，纯行为验收。
- [x] TUI01A-03 Ink/headless同controller，实际包API、renderer与PTY检查。
- [x] TUI01A-04 真实HTTP/随机PG fixture发送→退出→恢复，0provider。
- [ ] TUI01A-05 固定证据/独立review/集成。

后继stream/工具/thinking详情、真实model/access、附件、queue/steer/cancel/decision、管理与真实provider见父plan，首片不勾完整TUI目标。UI格式不决定能力。

技能：find-skills本地优先；实际读codebase-design、clean-code、tdd、assistant-ui与官方固定Ink139674dc888ee076982b6726e8e6f5d0fe0b5f67及custom-backend/migration。实际fixed tarball与SRI验证；只选独立TextInput不套local history。见质量/provenance。工程选择已获派工授权，普通实现不重复审批。
