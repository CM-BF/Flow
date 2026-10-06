# SVC04 独立审查记录

**状态：NOT_STARTED — 模板待review，不构成approval。**

## Target 与 scope

- Plan：[plan.md](plan.md)；status：[status.md](status.md)。
- Review target commit：a2386f0575a961e5bf52fb9a8b152d587d94dc73。
- Base commit：4391bbf9f1785212d098ef6aa1c01a0320a003d3；实现head：a2386f0575a961e5bf52fb9a8b152d587d94dc73。Worktree：/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-artifact-release；branch：codex/web-artifact-release；后续仅metadata提交，reviewer仍须fresh核验。
- 本次scope：manifest中10个source（9个tools源码/测试/README + 1个browser fixture）；排除真实个人部署/provider/任意后端兼容证明。原始检查及重叠口径见README；本模板不构成独立approval。
- Reviewer / model / harness / 时间：待填写。

## 可直接复制的审查任务说明

```text
请对 SVC04 做独立只读review。先读仓库AGENTS.md、plans/AGENTS.md、plans/<plan-directory>/plan.md和status.md；执行技能发现并读取相关本地技能。先确认实际仓库、worktree、branch、dirty状态、base/head完整SHA，审查结论必须绑定具体head commit；若输入与实际不符先记录差异，不沿用历史通过结论。逐项核对plan TODO、验收criteria、关键实现和证据，运行已授权且隔离的相关检查，明确哪些未执行以及原因。对问题给出severity、文件/行、复现场景、影响、blocking/nonblocking与建议；默认不改实现，把修复交回owner。在本review.md被明确指定为你唯一写入范围且你的模型>=Sol时才可写审查记录，否则把报告回传owner。Claude Code或其他外部agent可只读审查；任何直接修复Flow文件仍须满足Sol以上模型与独立worktree规则。最后列结论、限制和需复审内容，不把空模板当approval。
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
| 作者局部Node/真实PG/HTTP | 已执行，待独立核对 | 固定target，15不同用例分轮 | [README](../../docs/evidence/svc04/README.md)、[manifest](../../docs/evidence/svc04/manifest.json) |
| 作者真实Chrome | 已执行，待独立核对 | 冷启动及发布/回退后旧tab lazy资源，5阶段 | 初次4个JS503，修复后58个JS全200；原始失败保留 |
| 独立review | 未执行 | 待reviewer核验 | 无；作者记录不构成approval |

## Findings

| ID | Severity | Blocking | 文件/行与复现 | 影响/建议 | Owner回应 | 修复commit | 复审结果 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 待审查 | 未评估 | 未评估 | 无结论 | 无结论 | 待回应 | 无 | 未复审 |

## 结论与限制

结论：未审查。Blocking findings：未评估。Nonblocking findings：未评估。未执行范围：全部。不得据此声称通过。

## 作者回应与复审

Owner记录每项接受/解释、修复commit和检查证据；reviewer在新head上逐项复审并注明已解决/仍存在。新提交不自动继承旧approval。

## 预审输入处理（非approval）

Execution Lead指出版本读取在串行链外可能反序完成而误拒503。固定a2386f0将读取纳入链并把有界准入提前；新1例确定性red→green，最终2/2含原HTTP/SSE例。原始14检查与Chrome/PG未重跑；完整独立结论仍NOT_STARTED。
