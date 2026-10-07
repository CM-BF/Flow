# WPF-I01 / X01-06 App runtime 接线：MSG03 后增量

结论：原三产品接线范围仍足够作为最小候选，但三者都已被 MSG03 改动，必须在合法新 main 基线渐进接线，不能拷旧版本。三个 integration tests 的 Git blob 未变；它们并未自动覆盖 MSG03 的完整草稿或公共 Cookie 生命周期。已有 runtime 模块通过也不等 App 接线完成。

## 固定来源与范围

复用原报告 `/private/tmp/plugin-app-seam-fixed-xv66ebir/report.md`（9574 B，SHA256 b624dc98156a7ac9faa077ae69d2579981f8a72a648d1f438de9fb58764ae0dc）及原 pins；不重做 X01/P01 设计。原接缝基线 ae8500dd534a8ba18673a078c8563f4e3c13034e；新内容输入严格10份，见 pins.json：MSG03 fcf5e8c8335bf5de6fc3b7d74b5b2985d2e91f56 的 App/session/react、三既有 integration tests、message-settings、ConversationThread、attachments、recovery/binding；全部与 metadata b20cd84fb68b86aae6c3953cf7d4082a6df98330 同 blob。

研究期间新主线回执已到并完成 MSG03 交权：main 3c9345df4aec85a37e8a2a155e079db260d515b1；owner final830bbf7，claim7e3f v4 RELEASED 14:51:24.457Z。main-composition.json仅用对象身份核10份均等MSG固定源、旧三份management模块等原接缝基线，未增加内容研究输入。原 fcf5 分支本身没有 runtime-command.ts，PluginManagement也仍是旧blob；因此只能使用这次包含“已main runtime + MSG18”的固定main，不把fcf5整树当新实现基线。

## 三产品的最窄落点与必须保留的接口

| 字面路径（apps/web/src/） | 接线落点 | MSG增量不可覆盖 |
| --- | --- | --- |
| App.tsx | 386–391现registry只有四read方法；941 Settings仍不传centerRuntime。由真实当前 client/connection authority 提供 public runtime reader/writer和live epoch；原Workspace布局不改。 | 208–211唯一View.settings；452初值；762–783私有read/replace CAS；665–732完整Recovery和settings-only拒覆盖；499–504 committed route callbacks；843–864 client生命周期与更新时序。 |
| plugin-integration/session.ts | 在AppPluginSession的私有authority中组合已main runtime controller；闭合失效/销毁，不把它放lazy view内部。复用当前updateActions同步入口，权限epoch失效必须即时revoke，旧controller不得复活。 | 76–78 recoveryMaterials必须继续binding.recoveryDraft；128–146 P01 settings注册及host订阅；155 sync链；240–254 opening与view释放；344–363整session终态dispose。 |
| plugin-integration/react.tsx | 141–154 RegistryManagement向现View传optional centerRuntime；159–187 Settings仅管展示、折叠和焦点。controller在展开前后保持同一pending/unknown记录，不靠重mount重建。 | 169 Settings关闭回原trigger；265–295 AttachmentComposer私有restore/discard、官方preparing订阅和onclick双guard、Files懒激活/回焦点全部保留。 |

真实类名是 AppPluginSession，不是另造 PluginWorkspaceSession。已main PluginManagement 的 optional centerRuntime 和 sessionId guard、runtime-command.ts 的 frozen key/body、single unresolved、显式retry、不可逆revoke、await后isCurrent和GET/ACK revision guard沿原报告复用；不新 HTTP/state machine/调度器。session.id 是host身份，但同baseURL下认证失效可先于client替换，不能只看client对象或永久true的闭包；用当前连接authority的epoch/授权判断，不为revoke销毁整App草稿。

## 草稿、激活、focus 和 pending 的保留条件

1. C仍只在App每view；message-settings.tsx:15–21新ownership即使同值也更新，29–33私有port、99–127同步CAS/capture/detach/当前恢复lease保持。ConversationThread:224–227在官方Send detach/材料await前冻结A并更新新稿ownership；232–238文本通知不重建C。runtime Settings动作不能因展合或ACK清空、回填、保存另一个C。
2. held A与current B不能按inventory混算。attachments.tsx:168–177的唯一draftItems及recoveryDraft、207–236 guarded composer/current-restored身份、278–280释放held但不删input均保留。session不能退回input.items，也不能复制“exclude所有held”过滤；无port/部分恢复A是已修反例。
3. ConversationThread:169–191完整恢复成功且当前lease有效后才discardFailedSubmission，失败/冲突仍保held A；162–166真实core return guard保护B。接runtime controller不应触这些write path，也不以关闭management调用view/session dispose。
4. P01注册不等激活。message-settings.tsx:64–98现hostactive/checkView/可见性、当前generation/invoker checks，144–166首次render context及声明式action/context位置保持。center desiredEnabled不是本地host active、已加载/可调用或权限授权；local disable不发送center命令，center ACK不自动activate/deactivate本地插件。
5. management折叠/关闭可取消其读请求、返回Settings触发器，但不能取消或遗忘已dispatch的unknown中心operation。换auth epoch/中心则立即revoke旧命令authority；迟到响应不能写新面板/新namespace。当前草稿、held附件、upload unknown和原Recovery/outbox仍按原保护门槛，不自动DELETE/retry、取消中心任务或强制discard。

## 三既有测试的真实缺口与最小增量

这三份与ae850逐字相同：
- `apps/web/test/plugin-integration.test.ts`（blob809444943268cb37cd9c17b45427d88892ca4304）：19的AppActions mock没有新settings/recovery/runtime；79–123已有dispose/迟到activation/reference和纯protection边界。增量应走真实Session+已main controller，覆盖live epoch revoke、折叠保持原operation、旧响应拒绝；同时固定settings-only C和held A/current B不变，不另写镜像过滤/命令实现。
- `apps/web/test/plugin-management-integration.fixture.ts`（blobc3f6fb56de13033ef7650726c94feecfcd4ccd1f）：7明确无DB协议fixture，34–40为Bearer且非GET405，49 synthetic registry，73开启VITE_FLOW_FIXTURE。它当前不能执行commandPluginRuntime，也不等公共Cookie/Recovery会话。最小先扩现协议fixture的公开runtime读写/原key重试及有界delay/receipt，明示受控HTTP；需要真实Cookie身份的部分必须使用已存在owned真实center输入或另明确同契约fixture模式，不能伪称旧fixture已证明。
- `apps/web/test/plugin-management-integration.browser.ts`（blob054b7bd5a4f4f5d16d6387dad9d46b8a67a21acc）：56直接goto（App1332走FixtureWorkspace），57仅正文draft；58/81/93–118可复用懒读、本地/中心分离、折叠焦点和换中心。30–42忽略abort的fetchwrapper只可标controlled迟到，不冒真实Cookie响应顺序。新增mounted Settings centerRuntime操作/unknown→collapse/reopen→显式原key retry；切身份后旧operation不能污染新状态；设置C/held A/B序列化及现P01 focus不受影响。

三个旧integration tests不包含MSG两mounted新证据；反之MSG两selector已实际通过也不覆盖Plugin centerRuntime。后继只验证直接受影响接线，不复制runtime模块整套叶子矩阵或重跑旧Recovery全绿。browser历史22–24自启Vite/Chrome和固定输出不是已审新bounded caller；实际运行前原owner需量化新输出/HTTP或DB模式/连接/Chrome/清理，不能据本研究取得runtime。

## 交权与供给

最小候选exact8：上述3产品+3测试+`plans/wpf-i01-plugin-integration`+`docs/evidence/wpf-i01`。message-settings.tsx / ConversationThread.tsx / attachments.tsx / recovery/binding.tsx及已main management模块是必须保留的只读依赖，当前不建议扩大writer。

研究开始时14:37:48 ledger三个产品被MSG7e3f v3占用、三测试无匹配activewriter；这只是历史快照。现MSG已真release，但manager已把session等交W01做7272最小候选，故不能推当前空闲。manager后续必须在W01源seal+明确STOP+fresh原子amend移出后核全八scope再take。原I01 b6666c29 v4早已RELEASED，旧WT f4335af151bc41ebed8886ea113ae6f854f579e0保真实06:45主线收口；不能借其旧权写。

候选新独立WT web-plugin-runtime-app / codex/web-plugin-runtime-app，固定3c9345；本次目标路径不存在、无symlink、branch/worktree登记不存在。仅准备来源和闭包，不创建。沿同WPF-I01/X01-06既有职责，保旧历史，合法领取后切唯一status source；不新增大task，也不把用户“所有组件可插拔”解释为任意下载代码或越权按钮。既有P01受信slot/声明context/permissions足够承接此小片。

## 方法与状态

沿已装find-skills选本地clean-code、codebase-design：比较真实Interface/生命周期和状态权威，不造第二store、不复制host/controller、不机械拆分。技能路径 /Users/citrine/.agents/skills/{find-skills,clean-code,codebase-design}/SKILL.md；无安装。本报告只基于固定对象/既有原件，0产品修改/claim/import/Node/HTTP/PG/Chrome，NOT_IMPLEMENTED/NOT_RUN。10个新增source输入限额已封；后续供给量化是manager另明确派的只读准备，不扩本次行为研究。
