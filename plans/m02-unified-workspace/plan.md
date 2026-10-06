# M02 统一工作入口与公共基础

| 字段 | 内容 |
| --- | --- |
| 计划编号 | M02 |
| 状态 | `in-progress` |
| 创建日期 / 最近更新 | 2026-10-06 / 2026-10-06 |
| 父计划 | [FLOW-001](../flow-001-architecture/plan.md)；全量验收由其矩阵追踪 |
| Owner / model | Execution Lead / gpt-6-astra ultra |
| Worktree / branch | `/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-workspace` / `codex/m2-workspace` |
| 基线 | `e845eb069c594989117fadf380335650efef27a2` |

目标：在一个连续入口查看跨任务可读变化、处理不同任务的等待决策和原地展开证据；保留用户阅读位置。按目标、约束和验收表达工作，harness 等执行配置进入高级选项。此项是完整计划的一个阶段，不代表知识库、插件、容量与真实 harness 对比已完成。

独占公共 contracts/client/根依赖；M2 新中心查询模块 `apps/server/src/m2-workspace.ts`、对应测试及CLI入口；产品Web统一入口由外部W01 owner消费稳定接口，Lead不覆盖其正在进行的官方Thread/Arc布局整改。C02 独占中心恢复与迁移，P01 独占协议实现；合并时协调现有路由、DB文件。共享接口提交后优先给两 owner，避免等整项交付。审核恢复要求：未知副作用不重试，owner 停机/副作用核对说明与系统事实分开，显式 resolve 后 retry 产生新 task 和 provenance，旧 attempt 永不复活。

## TODO

- [x] **M02-T01** 固定 C02 公共 schema/client，严格权限、fence、幂等和有界读取接口。
- [x] **M02-T02** 跨任务轻量工作记录与等待决策查询；引用只有 id/title，状态以中心为准。
- [ ] **M02-T03** 单一连续 Web 入口与 CLI 等价能力；目标输入、跨任务决策/证据、双主题、阅读位置保留。
- [ ] **M02-T04** 真实中心/PG/独立 runner 的至少 10 任务旅程，过期决策拒绝并刷新；记录切换/重复提问/人工操作边界。
- [ ] **M02-T05** 独立 review、main 集成、证据及 dashboard 同步。

## 方法与验收

复用本地 find-skills 发现结果：codebase-design（少量有意义的公共 Interface）、tdd（已授权 contracts/client/HTTP/browser seam）、clean-code（每工作段/约30分钟/交付/合并前）；Web 开工前读用 assistant-ui、ai-elements、frontend-design、vercel-react-best-practices、webapp-testing。版本记录沿用 [质量基线](../../docs/quality/skills.md)，不重复安装。检查功能、视觉、可访问性、性能各自记录；fixture 不冒充模型推理，多任务确定性说明不冒充模型质量评估。

分层范围/字节块预算、Project 动态依赖/版本、context+成本、KB、插件和容量继续由完整矩阵分批实现，不因本项边界而删减原要求。[status](status.md) 是唯一状态源，[review](review.md) 默认 NOT_STARTED。

首段公共接口和游标语义见[接口说明](../../docs/architecture/m2-workspace.md)。M02-T03 Web交付由外部W01 owner实现；跨task接口/CLI/集成由本owner负责。R03将另行承接真实PTY/runner文件系统公共接口；文本输出面板不冒充PTY。
