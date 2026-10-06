# D04 独立 review

**状态：APPROVED**
Review target commit：0dec109cbaea34322044f151c9e501ef84f9114f
Base：51b1a4d09076c9e399c2611820d12bcebfa341b3。reviewer：runner_owner / Astra。记录时间：2026-10-06 02:56:13 UTC。

## Scope / criteria

独立协调PG/CLI、task/worktree/literal scope互斥、requestId重放、version/停写交接、只读聚合与数据库降级、短阶段展示、已有owner迁移。实现源码及证据均只读审查；不覆盖远程身份、OS强隔离或产品调度。

## Findings 与作者修复

| Severity | Finding | Blocking | 修复 / 复审 |
| --- | --- | --- | --- |
| P2 | 大小写不敏感卷 apps/example 与 APPS/example 可双领取 | CLOSED | 0dec109 NFD+lowercase保守冲突键及现有路径精确拼写校验；独立负例不再双成功 |
| P2 | 目标scope为symlink可经handoff/accept绕过take禁止 | CLOSED | 0dec109交接和接收重验scope/当前branch；独立symlink/换branch均拒绝 |

## 已执行 / 未执行

作者：26/26模块检查，0dec delta4/4（含真PG双process、deadline），Chrome154明暗窄屏三截图实际查看；动态端口非4320部署。独立review：完整代码/26项保存证据/三截图/迁移审计；最初公开applyCommand真实临时PG复现2个失败，复审再独立复跑 case alias、未创建Foo/foo、直接/交接/交接后变symlink、换branch与合法恢复accept。开始结束HEAD0dec且clean，临时DB/worktrees清理。未重跑产品全套、作者26项或浏览器。原复现与复审结果见 docs/evidence/d04/review-*.json。

结论：2项blocking关闭，无新增发现。NFD+lowercase为保守跨FS冲突；本机合作约束，非OS写入隔离。审批不等于main已集成，部署另记status。

## 可复制新审查任务

只读本plan/status并先核验实际base/head/dirty；对明确新target与0dec差异审查，不能笼统沿用此APPROVED。外部Claude Code可只读审查；直接修改仍须Sol以上、独立worktree与D04有效领取。修复交owner，复审绑定修复commit。
