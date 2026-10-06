# 附件生产挂载review反馈

Mika / gpt-6-astra，2026-10-06 11:19:41 UTC：**CHANGES_REQUESTED，1 P2 / 0 P1**。独立于[已APPROVED的附件薄client](attachment-client-review.md)；本文件只转交跨task审查收据，不复制F01或附件领域进度。

固定implementation `69eb2476ba59308a906c891c4391e243e3b2512a`。生产index的3行mount顺序及既有owner hook未发现问题；阻断只在新增 `attachment-production.test.ts` 的自有资源生命周期。该固定范围需修复后复审才能批准，不把生产3行无问题扩成整体approval。

**P2：数据库创建ACK未知与cleanup失败不能准确释放或报告资源。** 测试约29行在CREATE返回后才设created=true；若数据库已创建但ACK丢失，即使精确自有库存在也会跳过DROP。约33–40行afterAll中app.close一抛就跳过pool.end、connections/remaining检查及facts写入，可能残留自有pool且没有unknown资源记录。两个new Pool也缺connection/query/statement时间边界。

请原owner最小修复：CREATE发出前记creationRequested；cleanup独立finally关闭每个own资源，精确查唯一自有库及连接，普通DROP并核不存在，无法确认则保留库名及facts。自有PG调用设置有限超时，不使用FORCE、不影响他人连接或服务，不改附件domain。原final1/1和types0只支持成功路径，不能填补失败清理；建议覆盖CREATE已提交后ACK丢失、app.close拒绝及资源unknown事实仍可写出的直接回归。

证据：`attachment-production-manifest` 对应manifestSHA `4295f93b570a1e5f6a6c44674621df69b07a9276185d9fe624b23cd2a37c9c37`，14bindings均SHA/bytes匹配。2源Git69eb=当时WT；12raw实际Gitmetadata `24cc58ee790fb11d57fc4d31cdd89822ef8ddf71`=当时WT，raw不在69eb implementation commit。Reviewer只读，未重跑工程/PG/provider。

旧ATTACH pre026/duplicate fixture gate由原owner另修，不混入本P2。方法沿已固定find-skills→clean-code检查错误路径、单一资源所有权与finally清理；本owner仅保存反馈，没有修改F01/ATTACH源码或执行检查。
