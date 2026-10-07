# WPF-RECOVERY01 Interface

父MATURE06-04，唯一21scope/84005基线。结构设计root已批准，已落部分源码与实际App接线，行为验证尚未完成。ConnectionSession只使用FlowClient.browserSession/connectBrowserSession/logoutBrowserSession；ready四字段centerId/ownerPrincipalId/expiresAt/csrfToken，namespace不含csrf/短期session。公共client原Bearer保持兼容；本生产App入口当前采用cookie ConnectionSession，默认未启browserSession的中心显示unsupported且不能进入恢复Workspace。旧Bearer fixture仅为其他消费者测试，不是此生产入口的回退或兼容证明；部署/实际浏览器仍须验。unsupported不伪造ready。认证失败停命令，离线与resource403分开；本地expiry仅触发read，不凭本机时钟断言过期。

Journal提供verified-namespace读取、draft版本写、prepare/dispatching/checkpoint/eligible-dismiss事务；同transaction完整预算+CAS，resolve仅transaction.complete，strict为UA hint。原Outbox/Queue/Steer管理业务state；同步receipt存在后才能await。每个阶段世代隔离，迟到不得重写新状态；0自动mutation恢复。

RecoveryBinding真实注册P01 sidebar.footer私有命令；App只挂surface和提供bound callbacks。操作逐次验证namespace/view/project/当前grant，UI禁用不绕barrier。恢复不按opaque ID前缀授权、不用全局selectedTask猜归属。

容量和完整草稿依据保存在[envelope研究](envelope-research.txt)、[实测候选](envelope-results.json)、[请求上界](request-bounds-research.txt)、[draft接缝](draft-seams-research.txt)。这是固定旧基线只读设计，不是当前实现检查。正文对象只一份；CREATE兩key/body预留、cancel-task目标明确、metadata-first；IDB异常保材料和memorydraft，不发送纯文替代。

浏览器总预算90s含15scleanup、raw≤8MiB；当前禁止安装/build/PG/Chrome，定向轻量测试条件满足才跑。最终中心callerOrigin/迟到clearCookie/重复Connect门槛另核。

## f13 后修复接缝（源码阶段，未行为验）

prepare入口在第一次await之前固定namespace/view/project/auth generation；等待期间重新认证不能自动重新保存/POST。明确retry创建新port并保原key/body。持久draft提交恰好跨过reauth时仅同namespace/view记住实际CAS版本，仍拒绝本次旧send。existing command需port既有版本或restored expectedVersion；仅用户明确retry允许未缓存端口读取原记录，不能把迟到prepare称CAS。

已接受CREATE/turn、queue、steering可按同原键及完整冻结材料对账到终态，0 POST；CREATE checkpoint可先绑定尚未绑定的projection，再由GET确认会话/project，失败不清unknown。认证失效或改中心保留旧Workspace为inactive；只有其flush成功或明确放弃未保存页面状态才卸载，不清journal。失败open只清对应attempt，用户重试重新open，已放弃attempt迟到成功close，不后台重试。

## 材料完整性/原序提交接缝（source-only `1b8a335ecf26ece7539ad19e634508ac12ca3729`）

原ConversationAttachments增加captureDraft：消费公开composer快照，派生原Input当前稿选择，校验全部ready且与composer IDs完整同序，才调用原capture。Thread每次Send/Queue均经过它，即使composer无chip；异常在官方send/receipt/HTTP前保稿显示原因。旧held/inTransit且未在当前composer的材料归早期交接，不自动拼下一稿，已consume按原Input消失。syncComposerDraft只推进已ready有序前缀；前A未验证时后B ready不追加B。现有bindComposer监听生命周期不变，不另造材料事实源。

新增3个展开后controlled-port case，合计27 NOT_RUN；未来真实App同一隔离项目添加两固定资源，通过q先验证B再A，未验证/部分时分别Send/Queue要求0POST/0新命令与原稿，最终两实际chip及首次POST保A,B原ref序。明确移除才允许缩小选择。预算不变，未执行；首4ba20/20不覆盖。新入口见[manifest](material-integrity-checkpoint.json)，下一运行gate必须绑定这19源，旧2498/02d gate不可复用。

### 2026-10-06 18:17:58 UTC 默认生命周期与只读观察接缝（源码待验）

AppPluginSession构造完成及updateActions调用RecoveryWorkspace.sync；原host订阅亦入同一sync。仅已配置/当前授权/有namespace且registered自动activate；disabled/failed仍用户控制。当前active的namespace+generation一次同步已有草稿，不自动发命令；首次编辑绑定namespace且未提交状态受保护，跨namespace不搬运。所有enqueue原generation/owner/CAS守门保留。

测试fixture导出observeRecoveryRecords(options,factory?)：browser序列化同函数、controlled test传factory。missing返回pending并abort创建，已有结构/版本错误拒绝；blocked/超时/同步transaction或store错误拒绝并close，晚success亦close。deadline1..2000ms、browser1000ms；不创建/迁移/删除schema。原首browser失败与未测新源码分开。
