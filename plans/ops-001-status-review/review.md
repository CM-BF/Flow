# OPS-001 独立审查记录

**状态：SCOPED_REVIEW_COMPLETE — 仅模板与plans规则范围完成只读审查，不代表应用approval。**

## Target 与 scope

- Plan：[plan.md](plan.md)；status：[status.md](status.md)。
- Review target commit：`edca9fc5fe950a05ffe1ff89e5d31686182fb38c`。
- Base commit / head commit：待核验；worktree / branch / dirty status：待核验。
- 本次scope：plans/templates/{plan,status,review}.md与plans/AGENTS.md；核对用户要求的字段、可复制review说明与约束。排除：应用实现与功能验证。
- Reviewer / model / harness / 时间：assignment_review / gpt-6-astra / Codex / 2026-10-06 01:00 UTC。

## 可直接复制的审查任务说明

```text
请对 OPS-001 做独立只读review。先读仓库AGENTS.md、plans/AGENTS.md、plans/ops-001-status-review/plan.md和status.md；执行技能发现并读取相关本地技能。先确认实际仓库、worktree、branch、dirty状态、base/head完整SHA，审查结论必须绑定具体head commit；若输入与实际不符先记录差异，不沿用历史通过结论。逐项核对plan TODO、验收criteria、关键实现和证据，运行已授权且隔离的相关检查，明确哪些未执行以及原因。对问题给出severity、文件/行、复现场景、影响、blocking/nonblocking与建议；默认不改实现，把修复交回owner。在本review.md被明确指定为你唯一写入范围且你的模型>=Sol时才可写审查记录，否则把报告回传owner。Claude Code或其他外部agent可只读审查；任何直接修复Flow文件仍须满足Sol以上模型与独立worktree规则。最后列结论、限制和需复审内容，不把空模板当approval。
```

## 独立review步骤

1. 核验target/base/head、工作树与指令，确认评审范围。
2. 读plan/status、diff与关键调用路径；核对TODO和分支/main事实。
3. 从公开Interface检查正常、错误、恢复与权限行为；独立复核证据，不信自述完成。
4. 记录检查命令/环境/结果以及未执行检查和原因。
5. 提交findings；owner修复后核对新commit再复审。

## 检查与证据

| 检查 | 执行状态 | 环境/commit | 结果与证据链接 |
| --- | --- | --- | --- |
| 待填写 | 未执行 | 未核验 | 无；模板不表示检查通过 |

## Findings

| ID | Severity | Blocking | 文件/行与复现 | 影响/建议 | Owner回应 | 修复commit | 复审结果 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 待审查 | 未评估 | 未评估 | 无结论 | 无结论 | 待回应 | 无 | 未复审 |

## 结论与限制

结论：指定模板/规则范围无阻塞遗漏；reviewer已核验commit与所读内容一致。应用代码及运行能力未在此次review验证；后续提交不自动继承本结论。

## 作者回应与复审

Owner记录每项接受/解释、修复commit和检查证据；reviewer在新head上逐项复审并注明已解决/仍存在。新提交不自动继承旧approval。
