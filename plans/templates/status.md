# PLAN-ID 状态

状态：模板未执行，不构成完成证据。替换占位后使用下列标准字段；不把模板的unknown当检查通过。

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 待填写真实UTC时间 |
| Plan | [plan.md](plan.md) |
| 单一status owner / model | 待指定（写入至少Sol） |
| Worktree | 待填写绝对路径 |
| Branch | 待核验 |
| 工作基线 / HEAD | 待填写完整SHA；区分实现target与metadata HEAD |
| 工作树dirty状态 | 待核验 |
| 工作分支状态 | pending |
| 检查状态 | NOT_RUN；未知不表示通过；通过时写PASSED及完整target SHA和实际范围 |
| 已集成main状态 / HEAD | 待核验；分支完成不等于main具备 |
| Review | [review.md](review.md)，NOT_STARTED；空模板不构成approval |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| PLAN-ID-01 | pending | 待指定 | 未执行；使用pending/in-progress/blocked/completed |

## 已完成与检查

真实commit、检查命令/环境/输出、证据路径与未执行项分别记录。

## 阻塞 / 风险 / 未验证

区分当前阻塞、历史已解除与将来风险；写明影响、动作和解除条件，无进展不打勾。

## 需要用户决定

无新增决定时明确写“无”，不把常规工程待办当用户审批。

## 下一步与handoff

输入、分支/提交、独占写入范围、待review问题、下一动作。启动/实质进展/受阻/交付/review修复由唯一owner更新。

## Dashboard 同步

本status为任务唯一手填事实源；记录最近聚合核验时间/来源head/结果。提交、具体review与main集成独立记录，不编辑生成JSON为第二状态源。
