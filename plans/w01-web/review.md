# W01 独立审查记录

**状态：NOT_STARTED — 模板待review，不构成approval。**

## Target 与 scope

- Plan：[plan.md](plan.md)；status：[status.md](status.md)。
- Review target commit：待审查者核验并填写完整SHA；禁止笼统复用旧通过状态。
- Base commit / head commit：待核验；worktree / branch / dirty status：待核验。
- 本次scope与排除项：待填写；验收criteria与关键文件：按plan TODO、公共契约及status证据逐项列出。
- Reviewer / model / harness / 时间：待填写。

## 可直接复制的审查任务说明

```text
请对 W01 做独立只读review。先读仓库AGENTS.md、plans/AGENTS.md、plans/w01-web/plan.md和status.md；执行技能发现并读取相关本地技能。先确认实际仓库、worktree、branch、dirty状态、base/head完整SHA，审查结论必须绑定具体head commit；若输入与实际不符先记录差异，不沿用历史通过结论。逐项核对plan TODO、验收criteria、关键实现和证据，运行已授权且隔离的相关检查，明确哪些未执行以及原因。对问题给出severity、文件/行、复现场景、影响、blocking/nonblocking与建议；默认不改实现，把修复交回owner。在本review.md被明确指定为你唯一写入范围且你的模型>=Sol时才可写审查记录，否则把报告回传owner。Claude Code或其他外部agent可只读审查；任何直接修复Flow文件仍须满足Sol以上模型与独立worktree规则。最后列结论、限制和需复审内容，不把空模板当approval。
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

结论：未审查。Blocking findings：未评估。Nonblocking findings：未评估。未执行范围：全部。不得据此声称通过。

## 作者回应与复审

Owner记录每项接受/解释、修复commit和检查证据；reviewer在新head上逐项复审并注明已解决/仍存在。新提交不自动继承旧approval。
