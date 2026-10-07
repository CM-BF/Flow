# 当前测试生命周期后继审查

状态：APPROVED
Review target commit：fa6f8835d95e5e59fb62e14db5561498c741a4e3
Scope：仅三测试源及5/5 pureGit实际结果；PG/CLI四项与页面NOT_RUN，非主线/部署批准。

Target `fa6f8835d95e5e59fb62e14db5561498c741a4e3`；base1caac8c4856fed6de59d3f7467885563a187a758。APPROVED_SCOPED_TEST_LIFECYCLE_SOURCE_AND_5_PUREGIT；root固定fa6f限定三测试源码及own记录，并独立接收5项真实pureGit结果。旧审批保留如下，仅原账本/展示交付，不覆盖本后继。[固定manifest](../../docs/evidence/d04/owned-worktree-lifecycle/source-manifest.json) / [Interface](../../docs/evidence/d04/owned-worktree-lifecycle/interface.md)。验收：canonical身份与创建intent；只exact自有worktree/branch；错误不吞且后续清理继续；normal/alias/midfailure/lock/sentinel由真实helper合成repo验证，无真实PG/历史清理。

初审310e发现初始化末尾metadata读取不在清理try内；80340a先纳入末尾读取，fa6f进一步将canonicalize/lstat至所有初始化步骤统一纳入原try/catch，CLOSED_SOURCE_ONLY；[root正式审](../../docs/evidence/d04/owned-worktree-lifecycle/root-fa6f-source-review.json)核对最终target。原source审时无新测试运行。后继2026-10-07 pureGit5/5 actualexit0，见[实际结果](../../docs/evidence/d04/owned-worktree-lifecycle/pure-git-20261007/result.json)；[root实际结果已限定接收](../../docs/evidence/d04/owned-worktree-lifecycle/root-local-actual-review.json)，PG/CLI/页面仍NOT_RUN。

## 历史审查原文

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

## 展示增量独立复核（2026-10-06 03:06 UTC）

**APPROVED target ea8d44f7d9738cb98a1dfafd1636e2bbd7c17427**，base b5b4ce21bd8ae5e0fd729c526226e8f8a49a7a47。Goal Owner 只读源码/6项保存行为输出/Chrome154真实及合成状态；assignment_review 另核代码/截图，独立只跑2项human选择测试。未重跑产品或PG全套。无blocking发现。

范围：未登记active claim仅显示账本字段、不读取任意路径；released排除、PG不可用仍unknown；详情统一human信号；历史completed不被后续main同scope改动重开；E01/I01唯一source登记。早期I01缺status的浏览器观察保留；最终部署时已存在不回写旧记录。

O01/PERF后续仅新增两条固定registry数据，实际owner worktree/branch/status已核验，局部registry/aggregate记录另存；不改变上述已审机制。部署事实见status，不由review替代运行验证。
