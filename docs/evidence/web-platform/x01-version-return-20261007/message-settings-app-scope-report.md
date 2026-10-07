# TODO11 真实 App 接线：固定供给与合法范围差量

结论：沿既有设计实施即可，无须再设计状态层。建议唯一实施子片 **WPF-MESSAGESETTINGS03**（候选、未登记/未领取），归原 **MATURE02/TODO11**；唯一 owner `workspace_panels_owner`，独立 WT `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-message-settings-app`、branch `codex/web-message-settings-app`。两者当前不存在，ID未见于本次242条账本；这不代替经理保留ID、Lead物化与fresh原子take。原12产品+3test及新片own plan/evidence共17 literal足够作为初始范围，不改TaskThread/共享合同/新slot。

固定基线 `c13042ba7e74733d8c68cc05bd1b2d7cb5bbaa50`。20个固定内容输入恰为14已有候选源码+6既有报告/接口/计划/入站/账本；额外仅Git对象路径/blob/size元数据，无额外源码展开。pins.json给全SHA/bytes；supply.json给只读供给front及明确未验边界。本段无项目写、领取、Node、测试、PG、Chrome、产品HTTP或资源采样。

## 原设计哪些前置已解除

- 旧 `msgquick-real-app-host-design-20261007` 的“main尚无Recovery/Picker不同”已过期：当前 App+3 Recovery tests等当前2f8；其余10个已有产品候选与原固定设计字节相同。Quick intake明确 source dde571/meta7e9、主线组件集成commit `3c6aa59d9ae72fd793450d48e47d33c3000f8041`；不猜管理“637”简写为另一个源码SHA。
- main intake仅接收受控组件六组/类型；明确真实App/Send/Queue/Recovery/P01仍是TODO11后继。六组不是本片实际证据。
- Mika handoff固定 `07341d4672fb3c83090e685847818b47c34f2559`，§Web/TUI；管理计划固定 `7aaafdab32c792e62e193eabcc154ac553590328` lines119、137–139、423已明确同一TODO11、sole authority、opening lease与P01组合口，不增加父级任务。
- lateLogout中心后继不阻本片。Recovery19产品/test已交权；此事实不能替代全局冲突核。

## 精确写入候选（仅proposal）

所有路径相对仓库；前12为产品、后3为test：
1. `apps/web/src/App.tsx`
2. `apps/web/src/conversations/ConversationThread.tsx`
3. `apps/web/src/conversations/projection.ts`
4. `apps/web/src/conversations/outbox.ts`
5. `apps/web/src/conversations/queue/projection.ts`
6. `apps/web/src/conversations/queue/commands.ts`
7. `apps/web/src/conversation-context/receipts.ts`
8. `apps/web/src/recovery/binding.tsx`
9. `apps/web/src/plugin-integration/session.ts`
10. `apps/web/src/plugin-integration/message-settings.tsx`（新文件；main不存在）
11. `apps/web/src/execution-profiles/ExecutionProfilePicker.tsx`
12. `apps/web/src/execution-profiles/execution-profiles.css`
13. `apps/web/test/conversation-recovery.test.ts`
14. `apps/web/test/conversation-recovery.fixture.ts`
15. `apps/web/test/conversation-recovery.browser.ts`

own metadata：`plans/wpf-message-settings-app`、`docs/evidence/wpf-message-settings-app`。不复用Recovery两保留metadata写权；新片有唯一plan/status/review与来源链接。

## 现成接口与本次必要差量

| 入口（均固定main） | 现有事实与最小修改 |
|---|---|
| App.tsx:203、398、658–668、702–727 | C及非序列化ownership仍由同一个App view草稿领域持有；不设第二settings store。draft读取/完整Restore同步apply写回optional settings，settings-only须被保稿/非空判断识别。每次新稿/restore/撤权/重新激活改变ownership；route rename本身不误当新稿。App:481附近现current committed routing callback保留，不扩大旧hash effect依赖导致全view dispose。 |
| ConversationThread.tsx:80、101–145、161–188 | `pending`目前无settings，Send/Queue手动传text/materials；必须在材料异步和官方composer.send前冻结整个A。185行text通知不能抹掉C；可让C留App同view、text通知仅更新text，不需改TaskThread。135–142失败回填不能只凭空text/files；同正文异settings B及新ownership均不能被旧A清掉/回填。显式C可供下一稿，ownership必须在已校验的host send/detach边界同步换：先capture A，再沿现pending/beginHandoff与App私有port撤销旧opening，不能等onNew/ACK。 |
| projection.ts:294–307；outbox.ts:93–103；queue/projection.ts:111–120；queue/commands.ts:106–121 | 现手工重建request丢settings；沿既有输入/公共codec加optional snapshot，receipt生成前固定。ACK/retry/restore始终原key/原body，不在重试时重新挑catalog、映射C或降级。 |
| receipts.ts:12–23 | 当前只freeze知识/文件；在此既有小模块补settings schema重建+递归冻结，Send与Queue共用；不改共享schema/hash/HTTP接口。 |
| recovery/binding.tsx:34–69；App:667/723 | CompleteDraft及decoder现无settings，不能只改UI。旧记录缺字段合法；坏字段整次拒绝，不静默丢弃；完整revision/lease覆盖settings变化、同值换稿和ABA。保存用公开有界snapshot，不存catalog/token。恢复旧C但catalog未知时保留未验证；新提交需明确可用，原receipt重试不跟live catalog。 |
| session.ts:125–146；新plugin-integration/message-settings.tsx | 重用现host.register、composer action + context panel、current actions与activation signal。私有port仅暴露read authority/sync CAS/open lease，不公开raw setter/credential。adapter只持opening/liveness；不是第二C/FSM。 |
| ExecutionProfilePicker.tsx:89–128、142–175、250–293 | opaque Symbol、同步commitMessageSettingsChange、opening撤销与details导航已具备。补同型受控presentation/open/close及合法invoker focus，供原P01入口；不靠隐藏按钮click、不复制selector。保profile≤32已声明tuple、undefined/not-requested区别、omit仅省略。 |
| execution-profiles.css:2–4；Picker:286–289 | 当前长触发器可增高、整dialog滚动且Apply靠后。仅本地类做紧凑model/thinking/speed、限高可查全、独立内容滚动，使Apply/Cancel首屏可见；保完整长名/identity可键盘和触屏访问、窄屏/两主题/原focus语义。 |

P01 protected源码（react/knowledge/attachments、plugins host/types/validation/react）与旧固定研究均blob相同，复用旧分析；无需把这些文件加入写权。catalog/selection及Claude公开schema也相同。`packages/client/src/index.ts`已变为blob `a952bf4a9342470642a04a986ba28b362e067e8a`（以supply.json实际blob为准）；本段不重审新版client内容，不沿用旧工具/运行closure作为当前已验。

## 最窄供给与验证入口

- 14个已有可写源码共 **490,938 B**，一个新adapter为空预像。原clone/sparse供给应取同一c130固定Git对象，不能从不同旧工作树拼代码。
- supply.json列 **43个直接只读相对import**（包括`apps/server/src/index.ts`），固定blob/bytes+消费者；及受保护P01/catalog/publiccodec复用pins。TaskThread、官方Thread、ConversationQueue、connection/session、recovery/journal、stream host等只读。公共依赖来自同main的client/contracts/interaction；fixture还需同main server及其既有storage/protocols/plugin-runtime/migration供给。
- 这43个是静态direct supply front，不假称完整transitive运行闭包。合法物化须复用Lead已有同main Web+server/shared源码供给，并fresh固定其只读依赖resolver、tsconfig/path alias及工具实际入口；旧client index变动必须纳入。原node_modules/retired donor不可默认为可用，不安装/复制整个依赖树。本段无运行包或资源声明。
- 原3test可复用真实App、真实IDB观察、public synthetic profile publisher（fixture:606–621）、strict body-loss/dropNext（fixture:544）、既有Send/Queue/完整draft旅程与owned lifecycle。不要复制一套harness。新selector明确本片required groups；旧绿色旅程/预算/raw只作固定历史。
- **输出归属必须改为新片**：fixture.ts:11–12现hardcode Recovery evidence；browser现Recovery manifest/预算入口不能未经适配写旧owner证据。新增选组通过绑定own output/manifest与独立有限段参数复用原生命周期，旧默认历史语义保持。实际PG/Chrome、新数据actor或资源差量由实现后一次集中审与资源调度确定，当前不获runtime。
- 真实验收最小顺序：受控真实host CAS/activation-ABA/settings-only+restore；真实App Send捕获A等待材料时Apply B，同文B保留；Queue冻B/下一稿C及显式omit；lostACK/reload/explicitretry原key/settings/有序refs；P01入口/切view/撤权/关闭/长名/390两主题键盘。不把catalog纯函数或组件6组冒真实App。能力readback只把公开requested与observed分列，无observed不填effective；本片不要求provider/native应用来证明冻结管线。

## 写权与实际剩余前置

使用经理固定ledger `2026-10-07T11:38:53.279Z`，state available、242 claims。**全部15代码literal与两个候选metadata目录均无non-released scope相交**；包括父目录覆盖检查。6ff v5只留Recovery两metadata；MSG01 a5b v2、MSG02 839e v2均released。它只是观察时点事实，不授当前写权。

下一步只有原协调流程：经理确认单一子片ID/owner、Lead独立WT/branch同main供给（含只读closure）、fresh ledger后17 literal原子take、初始化唯一三件套后实施。本段未claim、未物化，也不要求原Recovery/Quick再释放一次。若fresh发生新claim则按exact冲突交权，不能绕过。无需等待lateLogout、LAZY/body或Release的产品结论；其实际资源优先安排另守。

## 方法与限制

复用本地find-skills、assistant-ui、codebase-design、clean-code既有固定方法及hash（pins.json）：官方Thread不改、深模块保持单authority、先同步冻结后异步、错误/撤权fail-closed、无额外state层。安全点清洁审查重点是输入完整性、生命周期归属、原key/body不变和明确输出路径；无实现故不记tests通过。新片不继承旧feature全PASS，不输出任何凭据，无外部安装。

补充来源归因（仅接收root消息，未扩第21个固定文件读取）：root官方composer顺序报告 `/private/tmp/root-message-settings-official-composer-ordering-20261007.json` SHA `07231de1a5b05232ee2d8d704144b2779ee6f03bff16a8d59a23811dd5259d96`，其已核安装core0.3.22 send342–350同步detach/notify后才异步准备，external runtime724–741亦可能await。以上send边界要求引用该独立研究，不冒本段重新实读安装包/执行；沿原A/B和旧opening跨send回归即可，无lib修改。
