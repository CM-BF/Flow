# MSG03 固定源码独审入口

固定实现 **9fc0fb8a48cb15ae35b4529013f25362d11a1efc**；base `c13042ba7e74733d8c68cc05bd1b2d7cb5bbaa50`。独立 WT `web-message-settings-app` / `codex/web-message-settings-app`。原 MATURE02 TODO11 的唯一实施子片，非新增大任务。当前 **APPROVED_SOURCE_AND_SCOPED_LOCAL / browser NOT_RUN / NOT_INTEGRATED**。

[17 源 manifest](source-manifest.json)（14 产品 + 3 test）与 [v2 scope receipt](scope-amend-receipt.json) 唯一绑定；19 literal 含两 metadata，新增的 AttachmentComposer 私有 typed callbacks 已原子 amend。原 Recovery/ACCESS 证据与写权不复用。

## 用户结果和所有权

App 每 view 持有唯一 C 与 opaque draft ownership。P01 现有 action/context slot 调用私有 port；Picker 只保本次 opening 的临时选择和目录，不复制 applied C。首 render context 直接来自当次 viewId，关闭回焦点保留合法 opening invoker；隐藏/撤权/namespace generation/plugin activation 过期不能 Apply 或抢焦点。关闭目录读有自己的 AbortController。

官方 composer.send 前先校验并深冻结 A，随后同步更新下一稿 ownership（值可保留）。Send/Queue 收据带 A 的完整 requested，重试仅使用原 key/body；同正文 B 不能因旧 ACK 被清空。历史 turn、Queue item/receipt 展示自己的 frozen requested，与 conversation requested/effective 区别。

Recovery CompleteDraft 保存可选 settings，旧缺省仍兼容，非法设置拒绝而不是静默 omit。恢复沿既有 full revision/CAS、namespace/lifetime 权威；Settings-only B 同样是非空草稿。

官方 core 的材料失败/取消会先把 A 自动放回 composer。生产保护只用公开 ComposerRuntime 的 subscribe/getState/setText/remove；用已持有 A 的 identity 观察 submission→return，保存当前 B 原正文/文件集合，隔离自动归还。附件 binding 仍持有 A，不新建 editable C store。显式完整恢复检查 B 的 ownership、generation、intent/profile/knowledge、正文/文件，并在每个 await 后复核；冲突保留 held A，由用户处理，不覆盖 B。AttachmentComposer 的可选 restore/discard 回调只由本宿主提供，默认消费者不变。没有修改 core、shared attachment controller、contracts/client/server。

## 实际局部证据

[单段记录](local-20261007/segment.json)、[25 原件 manifest](local-20261007/manifest.json)、[摘要](local-summary.json)、[exact terminal 观察](local-terminal-observation.json)。本段 60,000 ms，实际累计 **36,212 ms**，余 **23,788 ms**；TMP16MiB/raw2MiB、network denied、0 PG/Chrome/provider/install/build。

- direct-6：11 passed，57 NOT_SELECTED，0 failed。真实私有 host/catalog/CAS、真实 outbox/Queue、真实 Journal+Projection deferred restore；installed core preparation failure/cancel 调用生产公开 API guard，使用受控 thread port。
- types-5：明确 files 的 affected transitive noEmit，exit 0；不是 whole Web。全部17源码与该结果逐hash相同。新browser仅有独立MSG03 60s防御顶（不是实际授权）；synthetic model ID为合同允许的180字符，三者179字符前缀相同，仅末尾不同。
- 首红 types-1（TMP types 解析）、types-2（两个类型不符）、direct-1（错把 restore 错误状态当 rejection）、direct-3（短命 scratch 扫描 ENOENT 导致父 FAIL/TERM）全部保留。direct-3 不因部分 JSON 无断言失败而改判通过。caller 修复仅对 scratch ENOENT 忽略，其他 IO 错误 fail closed。
- 每个 Node 的 exit/group absence/scratch closure 原件保留；先9个、后2个 exact PID/PGID 再观察均 ESRCH。子日志是 regular files，不称双 EOF。简单 local caller 不声称覆盖 report 后的所有 late-signal 外层退出竞态；资源是逻辑轮询，非 OS 硬配额。

## 真实 App 验收仍待

既有单文件父生命周期只允许新 `message-settings-app`（cookieRead + messageSettingsApp），输出仅本 evidence。原 Recovery selectors 保留作源码参考但新入口拒绝它们；旧预算/失败不转移。尚无 gate、adminenv、服务、PG 或 Chrome 运行。

新 fixture 用一个公开注册身份发布三条合法 tuple 并预建 pinned conversation，不启动 runner/heartbeat/claim/provider。待验源码包括：首 mount P01/Cancel/Apply 回焦点、settings-only draft reload/re-auth/显式恢复零额外 POST、实际 Send A 请求被暂停期间改 B 同正文、ACK 丢失原 key/body 重试、Queue B 对当前 C 独立、历史 requested、390 双主题长名与 Apply/Cancel 可达。网络路由暂停后继续原请求，不 mock 业务响应。

**限制必须保留：** 请求/ACK 暂停不是材料适配器 await；现有 11 direct 也不是 mounted ConversationThread。材料准备失败与取消在 mounted App 的完整 A/B 恢复交互、生命周期失效、真实屏幕/键盘仍需有意义直接消费者验证，不能用 leaf 六组或 controlled core 冒充。浏览器源是待审候选，不表示可直接运行或完整 feature 已通过。当前新入口 60s 仅防御上限，真正 browser 预算/组合资源/actor 准入由 co-lead 后续给定。

## 独审重点

同步 freeze/detach；text 通知与 sole C 相互独立；同正文 settings-only B；官方 core failure/cancel return 以及显式恢复途中完整 lease；opening 与 return-focus 的当前可见授权；无 C 时 wire omit；完整 frozen requested 与历史/Queue；browser locator/真实前提、actor/runtime 与历史输出隔离。

技能和 clean-code：[质量记录](quality.md)。本次相对base的精确增删见source-manifest，不凭拆模块或测试数宣称性能改善。用户提供的真实服务/凭据/个人安装未触碰。

## 固定37166独审修复

[原独审CHANGES_REQUESTED](source-research/root-msg03-37166-source-review-20261007.json)保留。9fc0fb8修复5源94+/30-，其余12源相同；[9fc0独立复审](source-research/root-msg03-9fc0-source-local-review-20261007.json)已确认两P2 CLOSED，0 findings；仅source+scoped local接受。

1. 原A恢复永久绑定send时ownership/generation的问题：现生产restorePreparedDraft使用**用户本次点击时**的空目的地授权和generation/ownership。非空B仍拒绝；清空正文/文件并明确omit C后可恢复A，控制profile/intent/knowledge须回原选择。当前mode/knowledge身份与临时composer订阅共同保护await期间变化/ABA。真实core failure/cancel两用例均接着调用此生产恢复函数，验证B拒绝、显式清空且generation变化后A文本/文件/C恢复且无发送。新增await期间B变化的回归拒绝旧continuation，保B不追加后续A文件。
2. 双主题证据前提：真实Use theme按钮+html data-theme/computed colorScheme断言后截图；每张512KiB上限。合法180字符模型仅末尾差异，完整名称可展开。此为待browser实际验证源码，不声称已有图片。

独立来源顺序：root先实读私有TMP direct6/types5/17pins并批准，owner随后原样归档。source+local批准不授权新运行，不表示 mounted App/视觉/主线已通过；完整 MSGAPP-05/06 继续开放。
