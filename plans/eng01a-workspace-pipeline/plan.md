# ENG01A 受管工作区与工程检查通路

- 状态：in-progress；Owner：native_center_owner / gpt-6-astra；co-lead：Execution Lead
- 所属大task：[ENG-001](../../../engineering-delivery/plans/eng01-engineering-delivery/plan.md)
- Worktree：/Users/citrine/Projects/AgentHarness/Flow-worktrees/engineering-workspace-pipeline
- Branch：codex/engineering-workspace-pipeline；fixed base f181d84b5fb3652d62e2a181acff442d42b3e066

目标：0模型fixture真实修改自有合成Git worktree，host受信checker运行有界命令，保存完整内容快照、diff/log/checker receipt并经公开中心接口读回。复用现claim/lease/journal/outbox/unknown，不添加agent loop或OS沙箱声明。遵循[模块化规则](../../AGENTS.md#modular-design)。

## TODO

- [x] **ENG01A-01** 固定来源、10项literal claim、Interface及独立WT。
- [x] **ENG01A-02** 严格工程intent/receipt/checker合同及最窄中心关联/targetRunner过滤，旧flow.text不变。
- [ ] **ENG01A-03** 工作区/内容快照/checker/fixture adapter模块，受信基线不可由fixture配置改写，资源有界。
- [ ] **ENG01A-04** 随机真实PG+自有合成Git/命令纵向，公开artifact读回；失败/篡改/lease lost/丢ACK与重启未知覆盖。
- [ ] **ENG01A-05** 固定manifest、局部验证、独审、受控main集成与资源收口。

仅允许专用fixture工程intent，目标runner固定、本机project/checker registry受信；不让普通fixture/native误消费，不放宽native只读profile。生产Git仓库、个人服务、真实模型与工程UI不在本片。中心只验receipt与intent/artifact/attempt关联，不宣称自己重跑远端测试。共享contracts/index/export与必要薄client由F01唯一owner处理。
