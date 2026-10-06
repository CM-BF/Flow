# WPF-ATTACHI02 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新时间 | 2026-10-06 13:02 UTC |
| 所属大task | [WPF-MATURE-03](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/wpf-mature-03-attachments/plan.md) |
| co-lead | Web /root（执行管理 d01_owner） |
| Plan | [plan.md](plan.md) |
| 单一status owner / model | w01_owner / gpt-6-astra / ultra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-attachment-production |
| Branch | codex/web-attachment-production |
| 工作基线 / HEAD | base 1c4968354dabce1e6748f3301a2e6eecd33e77d4；完整实现 9eec51b72c6432b5b41df52f5b8fa783eb45e65b |
| 工作树dirty状态 | 实现已固定；本记录提交前仅 own evidence/plans metadata 待提交，提交后 clean/remote 以最终回执核验 |
| 工作分支状态 | in-progress / approved / waiting-main |
| 本片段交付阶段 | integration |
| 检查状态 | PASSED 9eec51b72c6432b5b41df52f5b8fa783eb45e65b；长名actual App2项/浅深390/cleanup、Webtypes0；此前191独审和10+1旅程各按原target保留 |
| 已集成main状态 / HEAD | NOT_INTEGRATED；本片已独审APPROVED，待主线接收及history组合验收，个人服务未操作 |
| 实现目标 | 9eec51b72c6432b5b41df52f5b8fa783eb45e65b |
| 实现范围 | apps/web/src/App.tsx, apps/web/src/attachments/AttachmentPicker.tsx, apps/web/src/attachments/attachments.css, apps/web/src/conversation-context/receipts.ts, apps/web/src/conversations/ConversationThread.tsx, apps/web/src/conversations/messages.ts, apps/web/src/conversations/outbox.ts, apps/web/src/conversations/projection.ts, apps/web/src/conversations/queue/commands.ts, apps/web/src/conversations/queue/projection.ts, apps/web/src/plugin-integration/attachments.tsx, apps/web/src/plugin-integration/react.tsx, apps/web/src/plugin-integration/session.ts, apps/web/src/plugins/types.ts, apps/web/src/plugins/validation.ts, apps/web/test/attachment-integration.browser.ts, apps/web/test/attachment-integration.fixture.ts, apps/web/test/attachment-integration.test.ts, apps/web/test/conversation-context-receipts.test.ts, apps/web/test/conversation-messages.test.ts, apps/web/test/conversation-outbox.test.ts, apps/web/test/conversation-projection.test.ts, apps/web/test/conversation-queue.test.ts, apps/web/test/plugin-host.test.ts |
| 阶段 | M2 |
| 优先级 | 1 |
| 当前产出 | 聊天附件发送、故障恢复和长文件名窄屏操作已验证 |
| 下一可用交付 | 接入主线并验证历史上下文中的附件材料 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Review | [review.md](review.md)，APPROVED 9eec51b72c6432b5b41df52f5b8fa783eb45e65b；P2 CLOSED，旧f82历史保留 |

| TODO ID | 状态 | Owner | 证据/检查 |
| --- | --- | --- | --- |
| ATTACHI02-01 | completed | w01_owner | [启动证据](../../docs/evidence/wpf-attach-i02/README.md) |
| ATTACHI02-02 | completed | w01_owner | 真实P01和官方core消费者已验证；App组合仍在核验 |
| ATTACHI02-03 | completed | w01_owner | [实际App与HTTP证据](../../docs/evidence/wpf-attach-i02/README.md)，10+1旅程；最后mixed delta直接官方core验证 |
| ATTACHI02-04 | pending | w01_owner | 固定 9eec51b72c6432b5b41df52f5b8fa783eb45e65b，分支实现/检查/独审完成；main接收及history组合待完成 |

## 证据与边界

[原子领取](../../docs/evidence/wpf-attach-i02/claim-receipt.json)及[本人 live 核验](../../docs/evidence/wpf-attach-i02/claim-observation.json)一致。首十二 scope 只用于真实材料和宿主接口；不把局部完成当 App 已接。0 模型/个人服务操作。[技能与质量](../../docs/evidence/wpf-attach-i02/quality.md)。

## 下一步与handoff

固定 9eec51b72c6432b5b41df52f5b8fa783eb45e65b 已独立APPROVED，24声明source与[manifest](../../docs/evidence/wpf-attach-i02/source-manifest.json)一致，v3/26scope保留待主线接收；产品停止写入。19轮含所有失败及独立build保守290.133/600秒、0provider；全部专库最终清空，首长名轮为人工恢复清理，不假称正常自动cleanup。原10+1完整行为与最后2项长名复验按各自target，原日志不覆盖。

**必须后继组合验证：当前main context-history producer × attachment-only合法材料。** 本树较早factory的HTTP通过不能替代它，由合法owner/Execution Lead接收时处理。**持久Send/Queue未知收据恢复仍待MATURE06-04**，ready草稿reload与跨tab journal原子性不在本片完成范围。未操作个人服务，也不自行dashboard采样。

## 架构影响

将现有附件模块接入 P01 私有权限与材料收据，不新增 registry 或共享协议。实际 App 贯通固定目标后由管理/架构唯一 owner 更新源码基线图，当前登记为待更新。

## 历史停点：2026-10-06 12:35 UTC

生产first–sixth原报告全部保留：first登录fixture配置、second重复Files定位器、fourth历史附件tooltip、fifth官方filechooser定位是采样器错误；third暴露CREATE静态capability与GET动态广告差异，现prepare成功后真实GET刷新；sixth实际Send和Queue的坏200→原key/原body恢复均通过，随后离线故障注入发生在receipt接管之后，未证明预期prepare前回滚，需调整定向检查。每轮专库均清理为remaining=[]、errors=[]，0provider。

当前14个binding/官方core局部PASS，覆盖prepare失败/取消与complete/requires-action保材料；初次185/186中的CACHE分页可见门禁已同步测试（21项delta通过），原失败未删。完整组合仍partial，尚未到独审：下一步badUpload→第六public receipt查询、显式恢复/重载，关页/插件停用与存储失败；同时修正共享journal的unknown不应pin无关空view。根未来main context-history producer与attachment-only的共享缺陷不在本树1c496输入，需集成阶段另验。

原始记录：[第六轮](../../docs/evidence/wpf-attach-i02/production-sixth-browser.json)、[清理](../../docs/evidence/wpf-attach-i02/production-sixth-cleanup.json)。当前代码尚未固定，报告hash只绑定各自当时源码，不称完整候选通过。

## 2026-10-06 12:54 UTC：长文件名定向补验

Root 已完成固定 f82 技术审查191/191及source/claim/cleanup/wire审计，尚未给最终批准；原样记录见 [root技术审查](../../docs/evidence/wpf-attach-i02/root-f82-technical-review.json)。仅在自有browser脚本增加longnames模式，产品仍与f82相同。第16轮在尚未初始化附件能力时等待filechooser，采样器未及时接管该Promise异常而退出，未到布局判断。已按本轮创建时间核唯一隔离库并完成人工清理，remaining=[]，39.143秒含清理，0provider；累计257.338/600秒，不能称长名通过。原始 [中断](../../docs/evidence/wpf-attach-i02/production-longnames-interruption.json)、[清理](../../docs/evidence/wpf-attach-i02/production-longnames-cleanup.json) 保留。后继仅申请同一窄检查的有界重跑，不重复旧旅程。

## 2026-10-06 12:55 UTC：长名布局复现

第二轮真实App同时读取两个合法255 UTF16单位名称（ASCII255B；中文/emoji混合375B）；light/dark的Dialog clientWidth=388、scrollWidth=1740，Use/Remove/Recovery按钮约1698px。实际恢复Enter、Escape回Files与草稿保留通过，最终几何断言失败。原始 [geometry](../../docs/evidence/wpf-attach-i02/production-longnames-second-geometry.json)、[browser](../../docs/evidence/wpf-attach-i02/production-longnames-second-browser.json) 与 [cleanup](../../docs/evidence/wpf-attach-i02/production-longnames-second-cleanup.json) 保留；第二轮8.624秒（browser较budget多4ms），自动清理86ms/remaining=[]/errors=[]。按每轮browser/budget较大值加独立build，保守累计 **266.129/600秒**；脚本原ledger值265.958差171ms是报告写入边界，不篡改raw。

申请仅追加原模块AttachmentPicker.tsx与attachments.css：短可见动作保完整aria-label、旁边完整文件名，grid/button有界布局。原controller/recovery/adapter仍只读，获新amend前不改这两文件。

## 2026-10-06 12:58 UTC：长名修复候选

已核 [v3/26scope](../../docs/evidence/wpf-attach-i02/longnames-claim-receipt.json) 并仅修改Picker可见动作/完整aria-label及有界CSS，原controller/recovery/adapter不变。产品修复14ddfa99，最终target **9eec51b72c6432b5b41df52f5b8fa783eb45e65b** 的后继只把专测改成每项真实ACK和draft ready后再上传。此前production-longnames-fixed失败是采样器撞既有单上传门禁（只1 POST201），13.679s自动cleanup全部成功；没有改门禁或称CSS回归。

[最终longnames-ready](../../docs/evidence/wpf-attach-i02/production-longnames-ready-browser.json) 2项通过、errors=[]，实际浅深390 Dialog388/scroll388、11操作按钮最大124.954px，恢复Enter/Escape回Files与草稿保留通过；10.325s含cleanup87ms，remaining=[]/errors=[]。总19轮及独立build保守 **290.133/600秒**，0provider，首longnames轮仅人工清理，其余自动清理事实分列。原15轮/两次采样器失败/布局红报告均未覆盖。新24apps hash=target=current=最终报告，独审等root，不冒main/真实provider已验。

## 2026-10-06 13:02 UTC：正式批准收口

[Root正式review](../../docs/evidence/wpf-attach-i02/root-9eec-review.json) APPROVED/0blocking，P2 CLOSED。复用未变业务源191独立结果，root本轮读3文件delta、24hash、26scope及截图/几何，无新全量运行。仅更新自己的元数据，产品与target零差；本提交前metadata dirty，提交后clean和remote相等以命令回执为准。先前990483首次push服务器500，核remote旧HEAD后一次普通重试成功，未force或改写历史。主线未接收，不提前release。
