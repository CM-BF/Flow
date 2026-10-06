# SVC03 当前个人安装的最小切换方案

方案更新：2026-10-06 08:50:42 UTC。**原准备方案现已按Execution Lead授权完成一次切换；实际回执见 deployment-receipt.md，0 query/0 tab reload。** 实现已获独立批准 `d9385185a1474c6b058c41b9187c6e075248cb5b`；实际固定 T 为 `b1c2e39837c2208e6fc2c59a80e16797f26448b5`；本次授权由 Execution Lead 给定，包含满足全部fresh gates后一次显式resume。

## 已核现态（瞬时事实，不是锁）

[只读事实](deployment-readonly-facts.json)，2026-10-06T08:49:26.702Z：

- 后端启动源 `32c371d389a913f8dd71c3bd8b98dd0697411256`，记录 clean；当前main只读观察 `d7e1e64e7792f4d1ad4933db042f10f266ad0cca`，尚无SVC03。当前Web是 Vite dev，无固定artifact；**不能据后端启动源推断当前浏览器页面的版本**。
- 原端口 center61227 / web61228；owned wrapper PID=PGID：center33877、runner34058、web34097。三者完整开始身份/命令/组核对均running，两个listener归属匹配。
- DB marker与配置中runner credential身份匹配；只输出boolean，未输出凭据/hash/DB连接串/私有配置正文。配置读取前后bytes未改。
- task共4，全部succeeded；全DB未完成attempt0。持久queue共1 promoted，waiting0；未读取prompt/reply/工具/材料正文。
- 全DB仅1 registered runner，为本安装、非revoked、capacity1、claude，accepting **v9**，未完成attempt0，最后heartbeat08:29:35.459Z。没有第二个已登记runner；这不证明未知外部部署不存在。维护操作记录resumed/target32c。

## 固定输入与执行顺序（本次窗口已完成）

1. **接收与冻结。** Lead 将已审SVC03合入main，提供完整 T；核main/origin一致、clean，11份source bytes与d938一致，已装依赖/Node24可用。窗口内main不再前进，尤其当前旧Web仍watch源码，不能在后台继续改apps/web触HMR。保留现61227/61228、DB、config、native session目录和用户tab，禁止以另一center替代。
2. **fresh只读门禁。** 重取本页相同脱敏计数与进程归属；全部runner/全DB未完attempt核对。发现新工作、unknown身份、另一活动runner部署或数据不符则停止协调，不把旧快照当许可；有在途工作只进入明确drain并等待，不能以停止派发称其已取消。本方案按已知单安装执行，不要求证明理论隐藏进程不存在。
3. **在停止旧服务之前预构建。** 由唯一operator在批准窗口用T已审模块的 `withPreviewLock({directory})` 包住 `prepareWebArtifact({repository:'/Users/citrine/Projects/AgentHarness/Flow',target:T,directory:'/Users/citrine/.flow-personal'})`。构建只接受这些非秘密路径/SHA，不加载私有config，使用系统白名单/envDir:false/fixture=false/已装依赖；完整verify后保存脱敏descriptor+manifest。成功前不改state发布指针；失败清stage，**旧服务与原accepting状态保留**。这不是安装或执行新的插件。固定工作树/依赖信任边界照旧，非hermetic。
4. **持久关闭接收并原子hold。** fresh事实仍满足窗口，使用T已审CLI在原directory做maintenance bootstrap；同runner持久guard停止新claim，已有heartbeat/outbox继续。refresh在同operation.lock下核无activeattempt后hold；再次验证T与缓存artifact，成功才按owned身份停止旧web→runner→center，再启动同端口新进程。没有PG长事务跨stop/start，不创建第二center。新query始终0。
5. **停在 ready-paused。** 核新owned PID/开始身份/组与loopback listener；backend `sourceAtStart.head=T` 且clean；Web独立身份为 `artifact.sourceHead=T` + `artifactId/manifestDigest`，其余manifest记录文件hash/tree/lock/toolchain。backend源码SHA不是Web内容digest，不把两者混成同一个“版本”。读 `__flow_preview_identity` 和status必须一致。核原config/DB marker/runner身份/端口、task/queue保留；不输出秘密。只GET检查，不发示例或provider健康请求。
6. **显式恢复。** 留下脱敏回执，在本co-lead预先授权范围内，全部同operation fresh事实满足后执行一次显式resume CAS，不等待第二人为许可；失败不得自动resume。仅恢复接收不代表模型可用、真实steering或用户界面已验收。现有tab不自动reload；静态版本已启动与用户打开了新字节分别报告，人工页面刷新须明确协调。

## 失败与回退

预构建失败时旧服务未停；drain/hold之后的任意source/identity/verify/stop/start不确定则保持暂停，不绕operation.lock、不强杀、不自动rollback。若已有新进程部分启动，沿既有owned清理并保留unknown，不扫端口杀人。任何恢复均基于原DB/凭据/native目录，不重建安装。

**这是首次静态切换，旧32c Web没有已记录静态artifact，不能声称已经有可一键回退的旧静态版本。** 保留成功构建的产物；以后回退必须明确选择已审且API兼容的artifact/后端组合并重新授权窗口。此段不实现任意artifact切换命令，不退DB、不自动回旧Vite dev；优先暂停诊断/受控修复。

## 验收范围

既有17 distinct分支证据已充分覆盖实现，不因本metadata重复检查。实际窗口只做必要fresh事实与身份/完整性/0query接入验收；不保存第二套整库快照，不读用户正文，不操作4320或49922，不新建公用部署框架。
