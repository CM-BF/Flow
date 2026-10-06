# P01 独立review

状态：NOT_STARTED。

- Review target commit：待实现交付后固定完整SHA。
- Base：`e845eb069c594989117fadf380335650efef27a2`；worktree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/protocol-adapters`；branch `codex/protocol-adapters`；head/dirty审查时实际核验。
- Scope：固定协议/能力矩阵、传输/client/Flow映射、真实HTTP/PG证据；排除未实现外部调度绑定、模型与云。

## 可复制审查任务

先读AGENTS、[plan](plan.md)、[status](status.md)、[设计](../../docs/architecture/p01-protocols.md)，进行技能发现并核验base/head/branch/dirty。只读审查固定A2A1.0/MCP2026规范与实际wire，不混旧SDK；检查远端ACK丢失/幂等/取消实际状态/快照恢复、权威Flow绑定、能力与实验任务边界。运行仅隔离动态HTTP/专用flow_p01检查，0模型/云，不覆盖原始证据。报告severity/blocking、文件行/复现与已/未执行范围；默认不写文件，修复交owner，修复commit重新绑定复审。

独立检查未执行；findings未评估；无approval。作者检查不替代独立审查。修复与复审记录待实际发生。
