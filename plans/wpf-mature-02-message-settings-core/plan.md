# WPF-MATURE-02-CORE Claude 逐消息设置

| 字段 | 内容 |
| --- | --- |
| 计划编号 | WPF-MATURE-02-CORE |
| 状态 | completed |
| 创建日期 / 最近更新 | 2026-10-06 / 2026-10-06 |
| 所属大task | [WPF-MATURE-02](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities/plans/wpf-mature-02-harness-capabilities/plan.md) |
| co-lead | mika |
| Owner / model | status_read / gpt-6-astra |
| Worktree / branch | /Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-message-settings-core / codex/claude-message-settings-core |
| 基线 | 70cc4e852365e974cefde30bfad75c7d233985c6 |

目标：以已main的纯leaf为基础，将每条消息的完整model/thinking/effort/speed意图沿中心、队列、既有Claude adapter冻结传递，并分开requested与observed。没有中心mutable next-settings实体、settingsRevision、第二哈希或新能力目录；全程0付费验证，UI由后继consumer消费正式合同。

遵循[根模块化规则](../../AGENTS.md#modular-design)。现claim v3为39 literal，包含032与reconciliation；F01 shared exports/client/index及UI仍不在scope。Lead已完成现source及155只读依赖物化；实现与验证边界见唯一status。

## 首leaf Interface 与资源（历史已main）

唯一 Module 的职责是检查完整、版本化的配置意图。输入是普通 JSON DTO，输出为严格解析快照、固定次序 JSON、有限 policy decision 或 ACK mismatch。调用方拥有可信 profile 来源、原幂等 body、持久化、取消与未知受理状态；本 leaf 没有 IO/生命周期资源。

依赖仅 zod。profile reference 小结构保持局部，未来 execution-profiles/tasks 可导入而不循环。canonical JSON UTF8 上限为快照 1024B、choices 16384B；最多 32 条完整、不同组合。它们不是 raw HTTP wire 计量。

effort 必填 discriminated union：level+固定 SDK 五值，或 not-requested。后者仅表示未请求，不承诺复位/default/安全 resume。可信完整组合允许不等于真实账户/模型支持；缺失或不可信能力由调用方传 null/undefined，返回 unknown；可信空集返回 unsupported；profile 三元组不符独立返回 profile-mismatch。未来 bridge 对无确定 resume 语义的组合仍须拒绝。

## TODO

- [x] **M02CORE-01** 只读固定设计、合法独立树与原子四 scope receipt；证据见 [README](../../docs/evidence/wpf-mature-02-message-settings-core/README.md)。
- [x] **M02CORE-02** 实现两文件 leaf 和五组行为测试源码，固定提交；实现不等于已验证。
- [x] **M02CORE-03** 资源满足后执行本文件 Vitest/局部 strict：5/5 与 exit0，见 checks.json。
- [x] **M02CORE-04** 独立固定 target review，修复 findings。
- [x] **M02CORE-05** Lead 受控接收/main 核对；仍有已派后继时保留原合法scope。
- [x] **M02CORE-06** 中心/queue到既有Claude adapter的CORE纵向34源已完成；29 distinct（16合同+5注入+8专库）/两strict0、固定独审APPROVED，并接main8d84。owner逐源核同；真实provider/账户资格与完整02验收由父任务继续，未纳为本片完成。

## 验收

五组直接行为：完整请求/非法与显式 omission；canonical 顺序与不同 effort/speed；缺证据/空策略/非笛卡尔组合；profile 三元身份与 32 条/重复边界；ACK 缺失/篡改与固定请求精确匹配。legacy 文件不改，不能把未跑测试写成 red/green。初始空间不足时未运行。2026-10-06 15:28:41 UTC 两项运行前 fresh 均达到 1GiB+32MiB，使用已授权固定依赖闭包完成单文件5/5与局部strict0；没有PG/build/install/target。

Owner 维护 [status](status.md) 和 [review](review.md)。首leaf验证与独审通过并已main22d5；后继接线source ea276已实施并完成本片合同/注入/真实专库验证，模块职责与精确接口见next-slice-handoff.md，CORE固定独审与main接收已完成，见vertical-main-acceptance.json；没有重跑工程检查。原大task其他验收继续开放。


## 2026-10-07 CORE领取资格后继（同task）

旧M02CORE-01至06历史完成范围保留。本轮唯一owner architecture_read，权威WT claude-settings-claim-eligibility；固定main7524。

- M02CORE-CLAIM01：精确移交runners.ts并登记同task权威树。
- M02CORE-CLAIM02：复用allocateClaim，在LIMIT前排除opt-in Claude runner的无pin/无snapshot任务，保完整后置校验和普通fixture。
- M02CORE-CLAIM03：准备三个领取协议、同机会重放/lease不续、stale owner与旧session runner pin的真实PG用例；类型/收集/实际PG须后续明确有限段，本轮0执行。
- M02CORE-CLAIM04：独审、受控main组合与父任务两runner个人启用接口交接；不以SQL片证明provider或个人已可用。

Interface/资源/边界见 [claim-eligibility](../../docs/evidence/wpf-mature-02-message-settings-core/claim-eligibility/interface.md)。
