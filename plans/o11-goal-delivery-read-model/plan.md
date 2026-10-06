# O11 目标交付轻读模型

创建/最近更新：2026-10-06。状态：in-progress（实现已独立批准，待集成）。Owner assignment_review / gpt-6-astra。所属大 task [FLOW-001](../flow-001-architecture/plan.md)，co-lead Execution Lead；O01-05/M02 为追溯，不新造大 task。基线 53ce2ec2c95b489aa7a2a2eaa49849821af00c16。

遵循 [模块设计规则](../../AGENTS.md#modular-design)。复用持久 goal/project/input/execution/task/artifact 与现有有效性算法；只新增有界 owner 读口。计划身份排除实时活动，历史输入可定址，写入仍由原命令事务校验；不造缓存/调度器/历史快照平台、不改 Web/SDK/MCP 授权。

- [x] **O11-01** 独立工作树/claim、有限 DTO 与接口。
- [x] **O11-02** 轻 SQL 和原有效性规则共用，版本分页/状态/按需正文。
- [x] **O11-03** 真实 HTTP/PG 双节点旅程、字节/请求量、直接消费者与 clean-code。
- [ ] **O11-04** 独立 review、main 接收、claim 收口。

Interface/有界和错误规则见 [接口](../../docs/evidence/o11/interface.md)；进度唯一 [status](status.md)。本读口 RR 只保证单请求，不是跨请求冻结快照。计划变更使分页409，已有 immutable input 按原引用仍可读。旧 snapshot/MCP 已有按版本 input 入口，不能夸大为本次才支持。
