# WPF-MATURE-02-CORE Claude 消息设置 contract leaf

| 字段 | 内容 |
| --- | --- |
| 计划编号 | WPF-MATURE-02-CORE |
| 状态 | in-progress |
| 创建日期 / 最近更新 | 2026-10-06 / 2026-10-06 |
| 所属大task | [WPF-MATURE-02](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities/plans/wpf-mature-02-harness-capabilities/plan.md) |
| co-lead | mika |
| Owner / model | status_read / gpt-6-astra |
| Worktree / branch | /Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-message-settings-core / codex/claude-message-settings-core |
| 基线 | 70cc4e852365e974cefde30bfad75c7d233985c6 |

目标：在两个新文件中固定可复用的完整消息设置请求、有限配置策略、规范序列化和 ACK 精确匹配。没有中心 mutable next-settings 实体、settingsRevision、第二哈希、SDK runtime import 或新能力目录。本片不开放产品控件或实际模型资格。

遵循[根模块化规则](../../AGENTS.md#modular-design)。派工仅允许两源和本 plan/evidence 目录；不修改 shared exports、profile、migration、center/client/runner/UI。后继由 Lead 精确协调独立 scope。

## Interface 与资源

唯一 Module 的职责是检查完整、版本化的配置意图。输入是普通 JSON DTO，输出为严格解析快照、固定次序 JSON、有限 policy decision 或 ACK mismatch。调用方拥有可信 profile 来源、原幂等 body、持久化、取消与未知受理状态；本 leaf 没有 IO/生命周期资源。

依赖仅 zod。profile reference 小结构保持局部，未来 execution-profiles/tasks 可导入而不循环。canonical JSON UTF8 上限为快照 1024B、choices 16384B；最多 32 条完整、不同组合。它们不是 raw HTTP wire 计量。

effort 必填 discriminated union：level+固定 SDK 五值，或 not-requested。后者仅表示未请求，不承诺复位/default/安全 resume。可信完整组合允许不等于真实账户/模型支持；缺失或不可信能力由调用方传 null/undefined，返回 unknown；可信空集返回 unsupported；profile 三元组不符独立返回 profile-mismatch。未来 bridge 对无确定 resume 语义的组合仍须拒绝。

## TODO

- [x] **M02CORE-01** 只读固定设计、合法独立树与原子四 scope receipt；证据见 [README](../../docs/evidence/wpf-mature-02-message-settings-core/README.md)。
- [x] **M02CORE-02** 实现两文件 leaf 和五组行为测试源码，固定提交；实现不等于已验证。
- [x] **M02CORE-03** 资源满足后执行本文件 Vitest/局部 strict：5/5 与 exit0，见 checks.json。
- [ ] **M02CORE-04** 独立固定 target review，修复 findings。
- [ ] **M02CORE-05** Lead 受控接收/main 核对与 writer 正式交回。

## 验收

五组直接行为：完整请求/非法与显式 omission；canonical 顺序与不同 effort/speed；缺证据/空策略/非笛卡尔组合；profile 三元身份与 32 条/重复边界；ACK 缺失/篡改与固定请求精确匹配。legacy 文件不改，不能把未跑测试写成 red/green。初始空间不足时未运行。2026-10-06 15:28:41 UTC 两项运行前 fresh 均达到 1GiB+32MiB，使用已授权固定依赖闭包完成单文件5/5与局部strict0；没有PG/build/install/target。

Owner 维护 [status](status.md) 和 [review](review.md)。当前纯契约验证通过，独审尚未开始、main 未接收；原大task其他验收继续开放。
