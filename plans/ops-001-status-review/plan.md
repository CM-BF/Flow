# 计划状态与独立审查规范

| 字段 | 内容 |
| --- | --- |
| 计划编号 | OPS-001 |
| 状态 | `completed` |
| 创建日期 / 最近更新 | 2026-10-05 / 2026-10-06 |
| 父计划 | [FLOW-003](../flow-003-m1-execution/plan.md) |
| Owner / model | Execution Lead / gpt-6-astra（至少Sol） |
| Worktree / branch | `/Users/citrine/Projects/AgentHarness/Flow-worktrees/plan-status-review` / `codex/plan-status-review` |
| 基线 | F00 `542f70b`，公共client补丁 `3995ec1` |

目标：交付计划状态与独立审查规范对应M1公共契约与可核对证据，遵守[公共契约](../../docs/architecture/m1-contract.md)。写入范围以派工单为准，其他feature目录不修改。先按find-skills读取并应用相关技能；每工作段、约30分钟安全停点、交付与合并前应用clean-code。

## TODO

- [x] **OPS-001-01** 迁移三个既有plan并保留跳转stub
- [x] **OPS-001-02** 统一plan/status/review模板与稳定TODO ID
- [x] **OPS-001-03** 创建活跃feature自己的状态和审查记录
- [x] **OPS-001-04** 相对链接、TODO映射和原实验hash检查后提交

## 验证和交付

通过公共Interface验证可观察行为，模型模拟和真实模型证据分开记录。检查和证据必须附对应commit；未经验证不勾选。Owner在启动、实质进展、阻塞、交付和review修复后更新[status.md](status.md)，交付后由独立reviewer按[review.md](review.md)只读审查，修复交回owner。分支通过不代表已经集成main。

- [x] **OPS-001-05** 用户完整目标滚动规则、22项原要求验收追溯与C02/P01/M02来源登记；2026-10-06新增，工程检查见status。

- [x] **OPS-001-06** 三队并发预算与直接技术路由（2026-10-06）：用户最新覆盖（2026-10-06 08:45 UTC）：每个Lead任务最多1+3；本队4、Web4、Mika4，授权总上限12。任何队增人先协调，不反复探测或通过新用户task绕过实际cap。

Execution Lead可主动直发Web用户task `01a10ec2-ff1a-76d0-a277-446baf89b19d` 与Mika用户task `01a10f3f-4ef0-7ca2-8e66-f1947fa4b295`，带任务ID、固定SHA、实际边界、所需动作。外部两Lead之间可双向直投。Execution Lead本身是subagent，没有可直投的独立用户task；外部回本task注明“收件人ExecutionLead”，Goal Owner立即桥接，不额外增加技术审批。不创建新task来绕过此限制。关键里程碑、scope冲突、全局容量与用户决策抄Goal Owner；owner status/evidence仍唯一事实源，消息不是第二进度账本。发现直接回唯一writer（跨队经该Lead），consumer合同直接发消费方，降低无必要中转。

- [x] **OPS-001-07** 2026-10-06短交接约定：普通handoff只发taskId、事件、固定实现SHA和clean metadata HEAD、canonical证据路径、下一动作、claimId/version。完整hash/测试明细留唯一owner证据；失败或scope冲突可补必要上下文。两外部Lead已确认，Goal Owner即时桥接不增加审批；消息不成为第二进度源。

2026-10-06 07:18 UTC维护：本片当前摘要与实际main对齐，历史实验/TODO证据保留；详见唯一status。无新产品或模型验证。

- [x] **OPS-001-08** 用户及时交付与Lead职责（2026-10-06 08:37:23 UTC）：有界功能或修复达到可审停点即提交并推送独立分支；独立审查通过后，只完成必要直接消费者验证便受控合入main并推送，不积压等待无关片段。不得为频繁提交把同一不可分验证拆成伪完成，也不得改写已审固定target。各Lead优先负责完整方向、优先级、公共接口、scope移交、验收和集成；新实现、测试driver与服务工具由具备权限和有效独立worktree/claim的workers承担。尽量并行独立任务，slot转移先核真实状态/当前工作，当前授权上限≤12；不以开新用户task或新增隐形agent绕cap。运行窗口明确要求固定source时，候选分支可及时push，main仍遵守窗口冻结。

历史2026-10-06 08:38 UTC容量变更（已被用户后续4/4/4覆盖，不作当前规则）：本队降为3（Goal Owner、Execution Lead、SVC03 worker）；Web保持4；Mika升为3（Lead、S01P01 worker、CHATUI01 worker），全局仍10。assignment_review仅完成O10语义metadata/push后正式idle，Mika新worker在此之前只可准备不得激活。CHATUI01未take/无双writer，唯一新执行源由Mika独立tree/claim建立；F01历史proposal不成为第二driver。后续slot转移同样核实际running状态与任务，禁止推测空位。

2026-10-06 08:45 UTC：授权配额4/4/4不代表12个实际运行agent。Mika新增/复用completed worker遇工具threadlimit时停止重试，不开新用户任务绕过；现有工作照常，实际active仅按工具观察记录。assignment_review在O10收口后由GO复用为只读runner宿主抽象审查；CHATUI01仍由Mika唯一worker执行。

- [x] **OPS-001-09** 用户协作方式纠正（2026-10-06 08:49 UTC）：GO负责总规划、查缺、研究、发现问题、督促与全局优化；co-lead自主细化计划/技术优化并管理workers，workers实施。唯一status→dashboard为默认通道，GO主动查看；普通进展/完成/审查/merge/metadata/claim不逐条私信或多路转发，不确认套确认。仅跨Lead重要接口/范围/资源裁决、紧急用户影响或dashboard不能解的真实阻塞才一次短消息加canonical；收到无需ACK，结果回写看板。普通授权技术步骤无需GO再批准，已有独审不重复。已一次同步外部两Lead。
