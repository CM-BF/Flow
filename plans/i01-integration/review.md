# I01 独立审查记录

**状态：NOT_STARTED — 最终Web集成target待本次独立review；下列历史scope已分别通过，不自动覆盖新实现。**

## Target 与 scope

- Plan：[plan.md](plan.md)；status：[status.md](status.md)。
- Review target commit：由reviewer核验本次交付完整SHA填写；真实Web运行source `de7d948f31a264bd1d4d7c2c3ad8b5582a6818c4`。
- Worktree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/m1-integration`，branch `codex/m1-integration`。
- 最终范围：948e6bc动态端口、W01/D01实现到交付metadata差异、根lock合入、`scripts/web-system-probe.ts`及其真实证据、[M1系统报告](../../docs/evidence/i01/m1-system.md)。既有W01/D01各自APPROVED实现不重复全套复审；重点核对组合是否改变公共契约与行为。

## 可复制审查任务

请先读AGENTS、plans规则、本plan/status，执行find-skills并实际应用相关本地技能。核对实际base/head/dirty，结论只属于完整target SHA。审查主旅程：真实Web202到PG、整Chrome进程exit、浏览器关闭时runner/CLI继续、同task/attempt、全新浏览器产物version与flow.text验证、独立取消且无产物；核对rawJSON、来源hash、截图与报告边界。可用新临时证据目录重跑确定性旅程，不覆盖已提交原始证据、不调用模型、不动4320dashboard；默认只读实现，修复回owner。记录severity/blocking/位置/复现、已执行和未执行检查，不能删断言/接受缺失截图掩盖失败。空模板不是approval。

## 已完成历史独立检查

| Target | Reviewer | 实际范围和结论 |
| --- | --- | --- |
| 5bdb7fa293ebd0d13515fe367f004687927f1897 | assignment_review / Astra | 最初4个真实PG/runner/CLI场景，独立4/4通过，无blocking；要求补真实SSE重连与更新status |
| c08506b5f2f5fb0441063704271d6278c69bbf14 | runner_owner / Astra | 第5个真实SSE断线场景及native probe只读；发现cleanup边界P2 |
| 6434fba78bba5097376555a66114462f5432ca25 | runner_owner / Astra | cleanup P2修复关闭；独立typecheck通过、I01 5/5、总检83/84，唯一C01端口冲突 |
| 6434fba78bba5097376555a66114462f5432ca25 | Goal Owner派独立架构review | 无阻断M1项；三P2关于harness/usage集中、runner有效并发1、observer读量，后续计划处理；未运行测试 |

## Findings 与修复

| ID | Severity | Blocking | 问题 | Owner回应/修复 | 复审 |
| --- | --- | --- | --- | --- | --- |
| I01-H1 | P2 | 已解决 | 最初缺真实SSE重连与旧status | 564febf新增真实HTTP代理断线重连，更新状态 | runner_owner复核通过 |
| I01-H2 | P2 | 已解决 | native probe setup/cleanup失败可能泄漏进程 | 6434fba setup纳入finally、各清理独立deadline | runner_owner只读复审关闭；没重跑模型 |
| I01-H3 | P2 | 待最终复核 | C01固定4320和dashboard冲突 | 948e6bc动态端口；受影响1/1及全检93/93通过 | 最终review核对差异 |

## 当前未执行与限制

最终Web整合独立review尚未完成；main未集成。原始native预算5/5，禁止新增调用。恢复/跨机/掉电/容量限制见系统报告；flow.text/v1本次只证明明确非空/contains规则，不等同任意任务语义正确。最终浅色full-page capture出现屏外content-visibility遗漏，采用同实现首次有效浅色截图和最终深色窄屏，保持记录透明。

## 作者回应 / 最终复审

待独立reviewer给出具体target、检查与结论后由owner如实落盘。
