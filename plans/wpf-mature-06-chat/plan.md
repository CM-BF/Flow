# WPF-MATURE-06 完整可靠聊天与执行控制

| 字段 | 内容 |
| --- | --- |
| 大task ID | WPF-MATURE-06 |
| 状态 | in-progress；完整验收未完成 |
| co-lead | Web /root（执行管理 d01_owner） |
| 优先级 | P1 |
| 唯一来源 | 本目录plan/status/review，管理worktree合法claim v3；不另填聚合进度 |
| 用户来源 | [成熟度原话与六项分工](../../docs/evidence/web-platform/mature-task-handoff.md)；原WPF REQ仅追溯，不形成第三层 |
| 收益 | 真实增量聊天、工具与thinking详情、队列/补充指令/取消及恢复形成连续可靠旅程，输入与滚动不被后台更新破坏。 |
| 边界 | 本计划定义完整用户结果；具体实现须独立worktree、fresh精确scope take和固定独审，计划目录领取不授产品写权 |
| 依赖 | STEER01模块已main；STEIRI01十三scope实际App片已main f181/原scope释放，CONTEXTI亦已main并释放；CHAT10 admission/公共client已固定，个人steering仍off。真实provider观察预算须单独明确；voice公开输入依赖待核。 |

## 已有能力与gap

CHAT06I01固定9da已main，官方runtime权威repository避免伪branch；ActivityI ba341懒tool/thinking与offline隔离已交；QUEUE01 pause与cancel分开；READ527保留行动错误和配置详情；通过项仅引用原证据。

已main的STEIRI接线沿原canonical证据；尚缺：端到端真实生效证据、跨reload原key恢复、voice失败退文本、Markdown/代码复制/重连/滚动/IME完整组合验收。

当前子任务唯一来源：[STEER01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-steering-control/plans/wpf-steering-control/status.md)。功能通过不等用户个人runtime已启用；源码main与个人运行产物分开；当前运行版本引用[服务owner最新正式回执](../../docs/evidence/web-platform/mature-task-handoff.md)，旧32c/v9仅历史观察。

## 稳定TODO与完整验收

- [ ] **WPF-MATURE-06-01** 盘点通过项与真实缺口：逐条引用stream/activity/queue/readability固定证据与限制，模块/fixture/真实provider分开，不重复勾整体Done。
- [ ] **WPF-MATURE-06-02** 完成STEER独立控制与接线：admission仅快照非许可，POST重验、原key unknown、receiptRevision更新、received不冒模型遵从；模块和App接线分别验收。
- [ ] **WPF-MATURE-06-03** 插件诊断通知与真实显示回归沿[本条后继](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/plugin-diagnostics-fixture-addendum.json)落地，source/pure/mounted分层验收。 验证正文与活动显示：真实增量、settlement retain/replace、typed-final完成状态、provider实际thinking才显示、tool unknown不伪造；Markdown/复制/懒详情。默认正文+简短自然状态，工程ID/计数/原因Details按需；成功回复的Activity succeeded/Open task controls/More actions/Task output/空0 waiting Center queue入口收敛，error/unknown/decision始终直接可见；普通hi、正常stream/tool、queue等待、断线unknown四旅程及390/双pane验收，error/unknown/恢复不能隐藏，系统通知不冒模型回复。 验证呈现区分正文规则、工程检查、独立审查/用户接受；缺source或artifact版本绑定为限定范围/unknown，A失败/B通过不能回写A。GO固定f181源码观察与ENG-001依赖见[研究](../../docs/evidence/web-platform/mature-theme-presentation-research.md)，不是新browser复现。 长时活动读取的累计缓存验收见[本条补充](#活动读取累计缓存验收)。
- [ ] **WPF-MATURE-06-04** 完成连接/刷新/未决发送恢复完整旅程（附件与已审dashboard安全停点后的下一优先，先于Arc/装饰）：有效登录期刷新/重开回同中心和会话，草稿与原未决identity保留；离线、认证过期、明确拒绝各有可行动提示。HTTP与流一致认证，跨tab/切中心/过期撤销/重启/丢ACK实际验证；重新认证不自动重投或换key，退出会话不cancel任务，取消操作另行明确。两公开客户端沿中心权威，认证与发送恢复为独立Module/Interface；键盘/IME/下一草稿、queue/steer/cancel原验收继续。invalid Bearer不回退owner、cookie不隔离端口、Origin/CSRF边界沿既有研究；0provider且不动个人登录/61227/61228。详细[原指令与调度](../../docs/evidence/web-platform/connection-recovery-priority.md)。验收执行需按[真实依赖拆分约束](#恢复验证的真实依赖与精确选择)减少无关场景串行阻塞，保完整恢复链及最终E2E。
- [ ] **WPF-MATURE-06-05** 控制滚动与语音退路：后台更新不抢用户历史滚动；voice能力显式，不可用/失败可回文本并保草稿，无自动模型调用。
- [ ] **WPF-MATURE-06-06** 完成可靠真实聊天旅程：实际App fixture覆盖失败/恢复/双pane；明确预算后单次真实provider观察，至少两次正文增长才称增量，没有partial如实记录不补query。

### 活动读取累计缓存验收

原06-03主责反复展开/分页的内容可达：展开前零正文GET；正文及metadata累计读取受原05-05的总预算与in-flight界限约束。淘汰后可显式重读，稳定cursor/起点仍可达，展开和合法焦点可重建；不靠无限索引保可达，不让旧connection/view/turn/task结果落入当前身份，unknown/草稿/后台执行不变。固定d057的[共享源码事实与验收输入](../../docs/evidence/web-platform/activity-cache-total-bound/report.md)区分native64KiB与generic1MiB单项界限，均不能代替聚合上限；这不是已测heap泄漏/增长/卡顿，也不改变恢复关键路径。

### 既有正文性能验收的测量接口

[GO REQ17/CHAT06固定接口与验收](../../docs/evidence/web-platform/req17-chat06-measurement-interface/report.md)补充原06-03、CHAT06-06/07客户端与WPF-PERF01-02，不新增子任务。相同最终UTF-8原文/hash，对照短段、长代码、长表格的patch分区/频率；首轮仅一有界pair。实际digest字节、parser调用/输入（含中断尝试）、Profiler提交及真实composer输入延迟分别记录；projection页/调度、smooth/defer与显示追平不可合成单个计数。缺样不当零延迟，128/4096前缀算术不当实测；完整原文/复制/表格语义、SHA/replay/identity/unknown必须保持。仅接口已研究，指标全部NOT_RUN；实际插桩/构建先由原shared/renderer owner审查，不扩Recovery21或Quick6、不迁移parser/hash包。

### 恢复验证的真实依赖与精确选择

[GO经root转述的新验收要求](../../docs/evidence/web-platform/quick-b3-admission-20261007/recovery-validation-dependencies.json)沿原06-04/06-06，不新建大task。原9835旅程任一失败即throw，附件/tooltip前置失败使认证失效、CSRF/offline和themes390全部未跑；这表示覆盖被阻断，不证明这些产品行为失败。原owner先列实际前置和共享可变状态，真正独立的case采用隔离context与自有服务端数据、复用已证前置并精确选择。

不得catch后在污染状态继续，不删tooltip/材料/count/order/ref/noPOST断言。真实共享恢复链与最终完整E2E继续保留；独立局部PASS不转为全旅程PASS。四次原FAIL、晚累计54883.199542ms、后次整数最多35116ms含15s清理及owned收尾均保留，不自动第五次、不新增provider。当前只有focus关闭/自然回焦前置源码修正和只读依赖/最小选择提案，已由root授权原RECOVERY01-05单browser最小有限journey选择实现（full/recovery-chain/page-auth/csrf-offline/appearance），完整链/全7组及所有原断言保留；各attempt独立DB/fixture/context，NOT_SELECTED与required通过分开；仅自有local30s/8MiB纯检查，未授第五次browser或浏览器运行，也不新建测试框架。

## 验证与交付规则

每个实际子task直接链接本大task稳定ID及co-lead；进度只维护其唯一status。仅完整TODO验收通过、证据环境/固定源码明确并完成受控主线集成后才可将本大taskDone；当前所有大task验收仍开放。普通片段ready/review/merge/claim不向GO发送，内部worker通信保留，需GO解决的整任务独立blocker仅一次。新scope依D04查重/原子领取，本计划不授权重启个人服务、刷新用户tab或新增provider调用。验证按影响范围，不为文档重复产品测试。

### 语音成功路径与归属（09:09 UTC GO审计）

沿原VOICE TODO：开始→停止→转写到当前pane可编辑草稿→用户明确Send/Queue；切pane、关闭、取消均释放mic，迟到不能污染另pane或新稿。失败退回文本，未经授权不新增付费调用。当前STEER独立模块已审不代表语音成功路径已完成。

### 同一聊天呈现TODO的总体验收补充

GO最新要求（非新增大task）：默认先正文、简短自然状态与需要行动；识别tool标题即可，native ID/Provider observations分页、来源计数/原因统一Details按需。成功回复不应常驻Activity succeeded、Open task controls、More actions、Task output和空0 waiting Center queue多处入口；收敛默认入口，但error/unknown/decision必须直接可见。系统状态与模型正文来源分开，不用模板冒充回复或模型润色；真实error/unknown/未确认取消/queue-steer受理≠生效及恢复动作必须可达。验收普通hi、正常stream/tool、queue等待、断线unknown四旅程，390及双pane不长期被工程说明占据。390截图若侧栏正打开，只能证明该状态，既不能推断手机坏，也不能当侧栏关闭时正文阅读/输入验收；此要求不导致重跑已审RELEASE。本段为原MATURE06呈现验收、MATURE01视觉依赖，不扩大已审VISUAL或STEIRI业务写权。

WPF-MATURE-06-03的事实/呈现边界与四旅程细目见[固定研究](../../docs/evidence/web-platform/mature-theme-presentation-research.md)。[ACTIVITYREAD01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-activity-readability/plans/wpf-activity-readability/status.md)f2bc已审并main f181/原scope释放，仅已展开活动区域；外层queue/stream/react仍后继，不将本片当整条TODO完成。

## 会话刷新恢复补充（GO经root，2026-10-06 10:24:48 UTC）

归原WPF-MATURE-06-04，不新task：明确浏览器登录有效期内刷新/重开应回同中心/会话，避免反复复制owner token。GO只读Connect页面/README，未reload/登录/发送，不推断断开原因。候选中心可撤销有限期HttpOnly session，token不入localStorage/URL；须中心owner精确接口与独立claim后实施。验退出/撤销/过期/重启、多tab/切中心；退出停止观察不cancel，unknown发送不自动重投。同源自托管优先，跨origin/127.0.0.1多端口边界单列，cookie须Origin/CSRF防护不只SameSite。此为结果/责任/验收研究，未实现/未授权改auth。

## 当前排程与独立恢复接口（GO经root，12:25）

附件贯通与获审dashboard到安全点后，06-04是下一完整用户旅程，优先于Arc及装饰；仍沿10:24完整验收，不另造同义计划。panels暂先只读固定主线Interface/精确scope，认证和发送恢复分成独立Module，中心与原公开客户端是唯一权威；不镜像receipt/权限状态。实际写入必须等ATTACHI02共享App范围合法交出后fresh claim，Arc18保持未领。

真实HTTP和流认证验收须分别观察：登录POST authenticated=true不能代替随后受保护read与stream成功；离线/过期/撤销/拒绝的提示和恢复动作分明，多tab、切中心及重启身份隔离，丢ACK仍原key/body/材料，不因重新认证自动重投。退出停止会话观察、任务取消走显式独立动作。0provider，自有动态端口/隔离资源，不碰个人已登录页或61227/61228。GO只读两个既有Connect页是页面观察，不是断线原因证明。T3 environment-auth.md/connection-runtime.md仅在固定SHA及许可核实后参考，issue7756仅失败场景；本轮没有读取/采用外部实现。[原指令](../../docs/evidence/web-platform/connection-recovery-priority.md)。

T3固定输入后续已核：root实际只读SHA `9bd1d8009a6b7c50f9dd9458e2bf27d481ff3b43` 与MIT/T3 Tools Inc.，原[source audit及应用摘要](../../docs/evidence/web-platform/t3-auth-fixed-research/README.md)。每中心唯一transport、HTTP授权与流生命周期分离、epoch/缓存新鲜度/不自动mutation重投沿原TODO04；issue7756是closed duplicate旧nightly，仅失败场景，不采用JS可读cookie workaround。中心session唯一合法writer已由Lead指派native_center_owner，精确DTO/公开client接缝仍须冻结，当前F01 v31持server/client index；Web不越权写，输入可独立先行而不等整个UI。

只读实现准备已收敛为[两个Module的现有TODO04候选](../../docs/evidence/web-platform/connection-recovery-readonly-proposal.json)：中心ConnectionSession负责auth/session/流失效，ConversationRecovery只为原controllers增加durablecheckpoint；13/16候选literal及32draft/128command/4MiB仅待精确owner/scope与容量审定的设计，不是已批准容量/写权。A中心owner已指派、028迁移已预留，shared出口由F01；035119fd v1九scope已COMMITTED，B等ATTACHI02完整main收口与交权；真实HTTP/browser预算实施前冻结，本轮零实验。

Root方向已批准进入Interface与合法owner协调，不授共享中心写入；中心独立Module由Lead指定唯一writer先受领可独立六产品路径及own records，共享mount/exports/client/migration仍精确协调。Web consumer/Recovery拟panels pending legal scope；都直接父MATURE06。checkpoint保相同key/body/知识与附件有序refs及下一draft；center/principal来自中心、同中心不同账号隔离。容量候选先对齐公开正文上限，禁止静默截断/淘汰unknown。

恢复持久化必须保ATTACHI同步handoff：原outbox/commands先同步生成publish唯一receipt，Thread同栈核对后consume；随后durable prepare/CAS dispatching成功才可HTTP。失败保同ID/key/body/材料与下一稿且本次0HTTP，everUnknown不降级；prepared恢复不发、dispatching恢复unknown，ACK未耐久仍unknown。CREATE绑定耐久后才允许turn；初次journal提交前的未保存稿不冒崩溃可恢复。详[crash边界候选](../../docs/evidence/web-platform/connection-recovery-readonly-proposal.json)，只是后继设计约束，非当前生产复现。

同TODO04容量冻结门槛（fixedaeb只读）：4MiB/32draft/128command仍proposal，普通turn16k UTF16、Queue16k UTF8、Steer16384 UTF8并不等价；128合法中文turn仅正文6,144,000bytes已超4MiB，JSON控制字符转义还会膨胀。计完整最终版本化record UTF8，明确namespace/记录单位及CREATE绑定、ACK状态增长预留；不得承诺所有合法输入均可恢复，不截断请求或淘汰unknown。未来发送journal CAS不自动覆盖当前上传journal跨tab read-modify-write风险，详原[候选Interface](../../docs/evidence/web-platform/connection-recovery-readonly-proposal.json)。本轮无实现/实验。

中心具体指派已落[原proposal](../../docs/evidence/web-platform/connection-recovery-readonly-proposal.json)：WPF-CONNECTION01仍是06的直接子task；8h绝对期限/GET不续、32有效session满拒不踢、同DB稳定中心/主体与token轮换epoch、trusted Origin和mutation CSRF、invalid Bearer不fallback。cookie名称不提供port隔离。冻结前六项[Web消费者接口差异](../../docs/evidence/web-platform/connection-session-consumer-interface.md)包括cookie-only read+HTTP/watch、无Origin同源读取、失败码、SSE关流诊断及旧tab logout；中心已正式九scope领取但不等已实现；Web仍pending合法范围。首DTO31824d8四字段足够，原六点按实际callerOrigin、迟到ClearCookie与重复connect三项收敛，原建议不作为额外字段硬合同。


06-04此前实施准备（当前已正式领取，见本节末尾）：root正式批准[RECOVERY01的21精确范围和接口](../../docs/evidence/web-platform/recovery01-fixed-cde-proposal.json)，直接归本大task、panels唯一owner。P01真实入口、材料恢复、原authority同步交接与IDB complete/CAS/CREATE两步沿固定方案；90秒实际旅程预算已批，容量尚待最大合法请求和完整记录验证。F01已有固定待审客户端，中心领域已独审但三项Web消费语义仍需对齐；资源门槛未满足，尚未创建树或领取。[具体核验与解除条件](../../docs/evidence/web-platform/recovery01-readiness-preflight.json)。

排程门槛已明确：F01固定且独审/main组合输入到位、fresh无冲突和轻量开发资源满足即可开工，中心三项语义并行对齐，完整浏览器旅程与整片批准前必须解决；不因这些不改DTO的方法细节推迟所有journal/controller工作。[独立正文容量依据](../../docs/evidence/web-platform/recovery01-request-bounds/report.md)已到，仅证明public请求body上界；owner必须测实际完整record与预留增长，全量预算不足不得截断或淘汰unknown。完整构建资源门槛独立保留。

2026-10-06 13:32 UTC 固定生产接口9406已核：[factory/session接缝](../../docs/evidence/web-platform/recovery-session-production-fixed-interface.md)。Recovery自有真实fixture显式传browserSession配置；未配置中心准确显示unsupported。接口无需新增21范围或扩预算，独审/main仍是开工输入门槛；Node测试cookie jar不替代浏览器cookie→read→SSE→reload，TLS/proxy及个人启用不在当前证明范围。

只读草稿与[完整envelope候选](../../docs/evidence/web-platform/recovery01-envelope-candidate/report.md)已补，root确认仍21范围。官方empty通知先于onNew不能删旧durable稿；storage失败允许编辑完整内存稿但0mutation，不存在纯文发送绕过。Queue intent跨group重挂须实测；完整对象样本适配候选预算不等实现全部合法输入/IDB已验，ACK有限投影超界保原record/key与内存结果，不截身份或误报HTTP拒绝。

Root已接收完整envelope候选并批准用于实现：128KiB初始record连slot/index、32KiB预付增长、4MiB全局；仍须实际serializer/CAS准入，非所有合法输入或IDB/App已验。116451B样本包含namespace/manifest，增长8805B；含非法字段组合的129651B过估不作合法极值。保draftVersion精确交接、ACK超界原identity/unknown及存储失败0mutation。21范围不变，不另启设计回合。

2026-10-06 13:46 UTC 正式执行：共享domain582f/clientd6d/production9406三独审与84005主线组合已齐；固定13源逐hash同。原批准21范围fresh查重后COMMITTED6ff988b2 v1，panels已被正式派工，唯一新树与source见[dispatch审计](../../docs/evidence/web-platform/recovery01-dispatch-audit.json)。保用户U08/REQ37的跨lead不重叠、实际take可聚合与两层任务要求。轻量开发资源已核，完整install/build及最终browser仍分别守资源/三中心语义gate，不因尚未完整验收停止首代码；不冒已完成06-04。


06-04插件覆盖后继仍归REQ22–23：[fixed82d78审计](../../docs/evidence/web-platform/recovery01-plugin-surface-coverage-82d78.json)确认P01入口已接，但恢复dialog内部记录动作尚无可贡献接缝。后继由plugin co-lead定义最小受权record context，保原authority；不扩当前21scope，不因入口可插拔冒内部全可插拔，也不把未完成基础片记失败。


原06性能后继补充（固定4ba源码假设，未实验）：[draft写入路径研究](../../docs/evidence/web-platform/recovery01-draft-write-cost-readonly.json)记录逐次changed串行enqueue、事务getAll与全局预算复核。未来先用受控慢存储/连续输入测待保存队列与flush延迟，再决定是否合并尚未启动的draft写；保handoff/CAS/generation/原key屏障。没有CPU/p95或退化结论，不扩当前Recovery21、不增加writer或本轮测试。


06-04未来真实浏览器验收预检（固定2498，原子task不变）：[root四项源码发现与原TODO映射](../../docs/evidence/web-platform/recovery01-browser-preflight-intake.json)要求在正式运行前闭合90秒含清理的父进程硬截止/启动前所有权、unknown CREATE及非空remaining准确报未清理、cache独立scratch与递归8MiB证据/实时空间门槛；完整材料草稿及不reload认证丢失旅程须实际覆盖或保pending。RB1–3沿RECOVERY01-05，RB4沿03/05；原04 direct20/20与后继22未跑分别保留，不由direct冒真实App。原owner只在21范围source-only修，无新增task/scope/验证预算、0额外types/import/runtime/install。


原06-04持久化与性能边界的[primary-doc研究](../../docs/evidence/web-platform/recovery01-idb-primary-research.json)区分strict durability hint、单request成功、transaction complete及StorageManager.persist权限：继续以严格事务complete作为发送屏障，不为性能默改relaxed，也不自动弹持久权限。未来先测慢存储pending writes/flush延迟，再判断安全合并；真实browser的durability/abort仍须实测，受控event-port不证明物理持久性。无新增slot/claim/安装/本轮产品执行。

2026-10-06 15:32 原06-04/RECOVERY01窄审：root724 supervisor的RB1–3仅SOURCE_ADDRESSED；[独立worker源审](../../docs/evidence/web-platform/recovery01-724-worker-review-intake.json)新增P2恢复附件ready未保证官方composer接管，交原21唯一writer修复并保真实有序refs断言。非运行复现，正式review仍NOT_STARTED，第二22direct与browser未跑，无新增测试窗口。

2026-10-06 原REQ45/06-05后继补充：[GO官方适配器只读研究](../../docs/evidence/web-platform/voice-official-adapter-go-research.json)。优先现官方composer DictationAdapter与已有Dictate/Stop能力，不再做第二mic入口；SpeechInput回调需要实际转写后端，按钮/disabled不是完成。录音/转写分状态，结果只进入当前pane可编辑稿，用户明确Send/Queue；取消/切pane/关闭/替换稿后迟到失效、清理mic订阅、中文/MIME与文本退路必须真验。SpeechRecognition可能远端处理，模式明确；中心provider复用认证/取消/限额，不给浏览器key。仅归GO已核，管理未调用mic/服务/产品，低于恢复与兼容，不新增task/claim。

2026-10-06 15:41 固定审查接收：[02d5材料完整性/顺序与b298输入](../../docs/evidence/web-platform/source-review-02d5-b298-intake.json)。原06-04必须在receipt/HTTP前核完整current draft选择及保存顺序，未验证/部分ready不能静默纯文本或少ref；显式移除、旧held/inTransit与下一draft分开。24case未运行，正式review NOT_STARTED。新backend源预审不代A/B兼容，原累计3,874ms不重置，无新运行/空间采样。


2026-10-06 15:52 UTC 原REQ45/MATURE06-05：[installed core0.3.22 stop/cancel原研究](../../docs/evidence/web-platform/voice-stop-cancel-core0322-root.json)与[管理核验](../../docs/evidence/web-platform/gate-voice-intake.json)。core send会cancel并取当前text，不等待final；官方MediaRecorder示例若stop提前resolve可能先解除转写callbacks。未来同一composer adapter必须定义停止等待final后可编辑/明确SendQueue与取消丢弃，私有pane/auth/draft lease覆盖异步mic获取及每个await，旧回调不能清新session或改新稿。记录/转写状态、5秒有界结束与cleanup只作为来源/候选约束；不是已实现能力或已复现产品bug，无mic/provider/browser/新claim，不改变当前Recovery优先级。

2026-10-06 17:18 UTC，原06-04验收接缝更新：[ec91固定nativeHTTP fixture源审](../../docs/evidence/web-platform/recovery01-ec91-native-proxy-root-review.json)仅源码批准，实际public Host、重复caller headers、分离Set-Cookie、SSE/backpressure及abort/close仍待真实运行。丢ACK注入必须证明已提交且浏览器只见不确定结果，不能把无headers socket销毁当不可透明重发的保证；保原key/body/material顺序与显式Retry断言，不改产品适应harness。未增task/scope/预算。

原06-04同层测试接缝后继已[17:28 fresh原21派工](../../docs/evidence/web-platform/recovery01-bodyloss-cleanup-source-dispatch.json)：只两harness/ownrecords修确定性ACK body-loss与ownedDB清理。先核实际pg-pool/pg版本；Pool.end不直接等价server连接0，短有界观察持续nonzero/queryerror必须失败，保有限pid/state与安全errorcode，禁止FORCE/终止他人连接。CREATE/turn/queue原身份、材料、显式Retry断言不减；不把RELEASE方法的源码或运行证据当Recovery已验。预算不变，0新运行。

原06-03呈现后继补[app1750用户验收](../../docs/evidence/web-platform/app1750-product-acceptance-followup.json)：桌面accepted queue receipt的大块技术说明可研究紧凑项/状态；unknown、失败、必须动作与原请求身份仍明确保留，不能以美化隐藏。390需在关闭导航后实读消息/编辑发送/展开详情，跨宽度保草稿与可见焦点。固定截图与兼容green不代完整移动或a11y验收；无新增运行/任务/当前scope。

同一app1750验收补[root固定506导航两源研究](../../docs/evidence/web-platform/app1750-narrow-navigation-root.md)：fresh窄屏与desktop resize须分别验；导航开关expanded与关闭/选会话后的焦点回交需真实键盘验证，保持main/draftMap和原plugin slots身份。源码推导不等运行bug，原native disclosure/modal取舍按实际交互核；不阻RELEASE或新建任务。

2026-10-06 安全点，原06-03/01-03 CHATREAD补[accepted queue六源研究](../../docs/evidence/web-platform/accepted-queue-506-research/report.md)：只将accepted enqueue收据作为最小紧凑候选；accepted cancel-item可能already-promoted、cancel-task仅请求接受，不能推无待办。unknown/rejected/sending、刷新失败/paused/blocked/current task确认、原key/context/动作和插件权限继续显著；展开前0详情预取。研究0运行、不新增任务或当前scope，后继仍真实用户验收。

06-04 / REQ22–23 外层唯一P01 host的[4d330新增差异](../../docs/evidence/web-platform/recovery-connection-p01-4d330-delta/report.md)及[root限定接收](../../docs/evidence/web-platform/recovery-connection-p01-4d330-delta/root-review.json)仅补后继验收：保默认Recovery.sync、同namespace新generation重放及disabled/failed不自启；保完整稿Restore租约与同view互斥；保retained guard失败期间A业务对象与撤权边界。签名明确：`RecoveryHost.restore(record, lease)`是私有callback；UI/plugin仍调`RecoveryWorkspace.restore(record, retry?)`，由其产生lease，不能把lease传为公共第二参数。三条时序仍未实现/未验证，不扩当前21scope或新publicslot/任务。

### 已授权普通验证的有限连续工作段

原06-04/06沿[正式规则](../../docs/evidence/web-platform/continuous-validation-segments-20261007/formal-rule-excerpt.md)和[root有限段授权](../../docs/evidence/web-platform/continuous-validation-segments-20261007/recovery-segment-authorization.json)继续；不是扩功能或放宽断言。历史90k五FAIL/late64134.08675原件永久保留并关闭新增消费，新150k只按该段真实运行累计、每次最多60k含15kcleanup，未用旧余量不转入。首次建议full原7组；相同安全/验收边界下由原owner连续修复与相关复测，pass后一次独审，不重复旧50/types/119等未受影响绿检查。每次真实专库/Chrome仍需明确holder、fresh输入/资源与完整owned清理；原runner gate只是输入校验，不逐轮索manager短期许可或转录批准；unknown/预算/越scope须停止，不自动无限重试，不触provider或个人服务。

[0141最小源码审查](../../docs/evidence/web-platform/continuous-validation-segments-20261007/recovery-source-review.json)仅修自有fixture的合法过期时间对及授权防御总额；生产auth/schema未改，原7组及生命周期不变。是否通过仍以实际结果为准。


本轮恢复列表可读性输入（U18，原TODO后继）：[GO实际观察及验收来源](../../docs/evidence/web-platform/quick-native1-recovery-review-20261007/incoming.json)指出UUID、工程收据及长UTC抢占主层。使用可读标题/摘要、Intl本地时间与紧凑层级，精确身份/UTC保留下钻；仅授权轻metadata或诚实fallback，不为title预取正文。No text不是重复/可删除证据，文件、知识、intent、unknown及原请求保持，不自动合并删除重发。沿既有web-design-guidelines/Arc方向，未take/未实施，不阻原full7限定结果。

C02接口后继仅只读准备：见[固定消费接缝](../../docs/evidence/web-platform/quick-native1-recovery-review-20261007/c02-web-consumer-seams.json)。已main公开patch-v2与未main原生conversation/catalog候选分开；Host和channel映射须显式协调原owner/scope，复用官方Thread reasoning与共享projection，不全改HTTP头把reasoning冒正文，不新registry/轮询。Recovery finalintake按3client+session factory1重数，不抢现21scope。

原REQ43工具详情后继补[固定f39a大正文消费研究](../../docs/evidence/web-platform/recovery-created-turn-admission-20261007/chat05-body-consumer-research.json)：复用descriptor/chunks与原client decoder/authority；receiving的hasMore=false不是complete，禁止套用旧terminal bodycache。仅主动展开读，跨64KiB块保UTF8解码与绑定身份；collapse/切中心/撤权停止后续页，迟到租约不发布。对pane/connection累计bytes设界限，不反复clone/prettyprint增长的8MiB全文；用>2MiB受控材料记录实际request/pages/bytes，clientmock与真实center/provider验收分开。固定7源只读、未take/实施/运行，原runtime/client owner冻结接口后精确协调，不建第二codec或新task。

GO经root新转述的同REQ43/C02后继要求（非用户逐字、未实施）：默认折叠须同时惰性传输reasoning正文，展开前网络正文零字节，不能仅CSS隐藏；metadata和普通text仍持续交付。冻结final/cursor、历史后展开、v1兼容与累计cache界限，保持身份/授权/撤权与真实终态。此前e394仅视觉折叠研究，不冒网络惰性完成；跨层接口只读研究待原co-lead供给，后续精确scope协调，不抢Recovery/App或另建流状态。

同REQ43/C02惰性reasoning补[固定接口研究](../../docs/evidence/web-platform/quick-typeahead-admission-20261007/lazy-reasoning-research.json)：默认折叠并不等网络正文零字节；展开前只授权metadata与普通text，展开才读body，保final/cursor与历史晚展开、v1兼容和累计cache界限。正文解码/协议协商沿原共享owner与官方Thread，root研究为只读设计输入，未take/实现/运行；不把当前公开v2已集成误写为惰性消费完成。

Lazy reasoning共享子片现由[MATURE06-LAZY01唯一status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/lazy-reasoning-reads/plans/mature06-lazy-reasoning/status.md)承接（Mika/status_read，codex/lazy-reasoning-reads），接口见[canonical](/Users/citrine/Projects/AgentHarness/Flow-worktrees/lazy-reasoning-reads/docs/evidence/mature06-lazy-reasoning/interface.md)。根转Mika首canonical9ef8e36f与8436ad9e v2/11scope已明确，协议patch-select-v1；六core/三tests/两metadata不取任何Web或两index。Execution Lead负责实际dashboard登记，父计划只关联不复制TODO/进度，也不声称已登记加载。本组没有该共享片writer；Recovery原21仍panels，未来Web Thread消费在固定接口与scope交权后另fresh take，旧CHAT06I01写权不复开。

原06-04/06下一[Queue有限段交接](../../docs/evidence/web-platform/paired-return-owner-segment-20261007/recovery-queue-owner-segment.json)已采用GO纠偏：150s段实际58951/余91049，原owner同边界连续修复相关复测、单runner/单结构化记录、结束一次独审。当前无运行/预约，普通每轮不再短gate批准。留存启动余量75383B，只引用旧原件；超过既有预算须一次解释真实变化，旧raw不删。

上述有限段已一次明确移交内部run输入与临时adminenv责任给原owner：固定ef458测试来源、唯一namespace、0600与exact身份，执行owner段终态精确删除并保存回执，值不输出；不再等manager逐轮发gate/准备env/转录结果。输入、权限、清理或验收实质变化仍窄审，已消费旧gate/env不得复用。

历史Queue安全点：Queue自治工作段已完成selected2/2并由[root段末独审](../../docs/evidence/web-platform/queue-full6-closeout-20261007/recovery-queue-actual-review.json)接受，累计70158/150000、余79842；不冒promotion/Steer或完整feature。下一[真实SSE小片候选](../../docs/evidence/web-platform/queue-full6-closeout-20261007/recovery-sse-scope-readiness.json)仅原panels21claim内fixture/browser+ownrecords：另一公开HTTP消费者取消自有任务，观察页须真实新SSEframe、cursor及timeline交付，无刷新/REST替代。Root已正式续派原panels/原WTbranch/原21范围source实施，未新增领取或实际holder；监听/清理或验收固定改变一次窄审后，按同有限段自治，不逐run短gate。只引用旧raw；root一次接受retained9MiB/5MiB runreserve/4MiB启动线及freshfloor+1MiB，原3131063B留存不删，scratch64MiB/剩79842ms不变，监听审查前不启动。

SSE源码准备阶段source d68与12局部检查/noEmit已[独审接受](../../docs/evidence/web-platform/access-sse-host-checkpoint-20261007/recovery-sse-local-review.json)，真实交付目标明确为“已打开的任务详情收到实时状态与新时间线”，使用#task/TaskProjection，不冒conversation assistant patch流。当时余79842ms、evidence3157504B仅为运行前记录。随后08:03:40–08:03:51实际选定2/2及清理已[独审接受](../../docs/evidence/web-platform/access-sse-host-checkpoint-20261007/recovery-sse-actual-review.json)，本次计10844ms后累计81002/余68998，owner109922双端clean；不冒assistant patch流或完整feature。4MiB启动线/9MiBretained与较高floor保留。

原TODO11 [完整消息设置草稿接线候选](../../docs/evidence/web-platform/access-sse-host-checkpoint-20261007/message-settings-host-followup.json)需当前Recovery19源最终组合和精确交权，三测试仍本owner持有。补CompleteDraft可选codec/原子prepare-apply/settings-only保护、Send/Queue capture与原key/body/settings重试，非法值拒整份恢复、不静默省略，catalog未知可保稿但不假授权。App仍唯一C，非持久ownership每新稿更换；不复制journal/HTTP/slot，也不以叶组件检查代真实恢复链。当前未take/实施。

原RECOVERY01完整草稿后继[Prepare顺序更正](../../docs/evidence/web-platform/composed-consumer-checkpoint-20261007/recovery-prepare-recipe-correction.json)：真实选profile/project→Prepare CREATE确认项目且0turn，再选knowledge与双有序file，保存后reload/显式Restore无新增businessPOST/正文预取；公开metadata复验但不重选，再首Send保原材料/身份。原[synthetic publisher边界](../../docs/evidence/web-platform/composed-consumer-checkpoint-20261007/recovery-complete-draft-design-boundary.json)只一个自有DB内公开profile发布token、仅内存，不运行runner/claim/heartbeat/provider。fea37两tests源码已聚焦批准，后继4a609只读类型窄化；local首红后绿仍保原日志，17源不变；[4a609局部结果独审](../../docs/evidence/web-platform/composed-consumer-checkpoint-20261007/recovery-complete-draft-local-review.json)已接受，此源码/局部检查时点actual browser仍NOT_RUN；后续首轮失败与修正见当前接收，旧SSE通过不证明此选组。

原REQ43 [CHAT05P02 f5a主线接口](../../docs/evidence/web-platform/composed-consumer-checkpoint-20261007/chat05p02-main-consumer-intake.json)已可作为后继固定input，先descriptor、展开后readNext，复用唯一client codec/跨块UTF8与取消。轻metadata、当前receiving尾部、材料complete和tool成功四者不混；UI须保pane/connection累计bytes及延迟响应authority，不一口气prettyprint整8MiB。这里只登记依赖，不抢Recovery/App或新增take，原lazy-reasoning共享权威不替换。

CHAT05后继[九固定源研究](../../docs/evidence/web-platform/composed-consumer-checkpoint-20261007/chat05p02-fixed-web-research.json)补真实消费风险：reader构造虽零HTTP，已分配最多8MiB，因此构造前先做全pane累计reservation；折叠须通知关闭reader和释放，而非只改React展开ID。保完整合同能力、两pane总量与有界DOM，不截成旧2MiB或整份JSON反复pretty-print。App/session仍待Recovery与真实settings消费者精确交权，当前NOT_TAKEN。

本次[完整草稿首轮实际及修正](../../docs/evidence/web-platform/browser-interface-checkpoint-20261007/current.json)明确原1/2整体失败、测试定位在CREATE/turn之前、cleanup与15676ms不回退；修正bc3随后第二次实际复验仍1/2整体FAIL，恢复/B→A/knowledge部分通过而最终accepted回执undefined待定位；两次清理归还，累计114654/余35346，独立第二次actual审尚待，不补成功。LAZY固定publicclient2949569/packet55dc的源码批准只作为后继input，Mika原canonical维持唯一进度与scope；Web消费未take。stream2/4MiB保持，nativebody8MiB独立计入aggregate reservation，展开前不构造预分配正文reader。SVC09真实兼容context严格用format/publicOrigin/policySha256，不从main集成推个人产物已更新。

原completeDraft第二次[实际与身份修正独审](../../docs/evidence/web-platform/consumers-resource-checkpoint-20261007/recovery-complete-second-actual-review.json)确认1个202TURN与材料/知识/profile匹配只是部分实证；测试误拿record.id比turnKey，后继2e7203e改精确frozen.turnKey唯一匹配，保accepted/request/ACK身份完整要求，未复验。原150s已用114654/余35346，不能从旧90k取额度或自动排PG。共享LAZY e2b的3/3+strict与SVC b2b artifact成功仍分别是接口/产物输入，不是当前Recovery App已升级或个人兼容通过；真实caller须固定b2b descriptor/publiccontext后再执行。

共享selected协议与部署再次分离：LAZY e2b公共client/core已main，但本次实际SVC b2b artifact不含selected能力；Web后继必须按真实backendtuple能力启用并实际验收，legacy兼容保持，不能以静默codec降级假装验收通过。此不改变当前Recovery输入/原35346ms余额，也不阻b2b既定兼容交付。

原REQ43共享读取界限后继只关联[MATURE06-READBOUND01唯一status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/client-read-bounds/plans/mature06-client-read-bounds/status.md)，co-lead Mika/owner db_transaction_owner，独立client-read-bounds树与codex分支。公共reader签名保持；当前实现、局部检查、独审与main以其唯一status为准，不复制TODO或替其判通过。[正式登记请求](../../docs/evidence/web-platform/svc06-return-steer-handoff-20261007/readbound-registration-request.json)交原globalregistry owner，实际登记/加载待receipt；本父scope不授Web写client/registry或另取相同工作。

原MATURE06-04的[stale-route静态审查与新有限回归边界](../../docs/evidence/web-platform/main-deployment-route-fix-20261007/recovery-route-fix-segment.json)由RECOVERY01唯一panels执行：长期route handler引用当前已提交回调，不能通过将session/groups重列为整个生命周期effect依赖而重建全部view；保证原durable prepare先于业务HTTP，配置恢复后存储失败仍禁止发送。复验须真实同document hash切换、Steer draft持久化及原ACK/恢复断言。两FAIL和未用旧额度保留；剩余第二中心不混入本段。

READBOUND共享边界已[main81b/正式194登记](../../docs/evidence/web-platform/main-deployment-route-fix-20261007/readbound-main-intake.json)，仍只链接Mika唯一owner状态，不复制其任务/领取或推导本App已消费。

本轮原RECOVERY01-03/05的[第二中心方案](../../docs/evidence/web-platform/recovery-second-center-preparation-20261007/two-center-report.md)在固定入口A→B→A→B中使用两真实DB及公共身份，最后B显式Restore；原owner仅两harness/direct专测与记录准备。principal-only和ignore-abort迟到ready为受控检查，不冒公共rotation或真实迟到响应已投递。两个lease/独立清理原件、失败仍清另一库及新2DB/1Chrome资源差量须固定源码后集中审查；原routefix段剩余额封存，不直接沿旧1DB门槛运行。原功能边界仍03/05；provider实际consume/apply、Queuepromotion等跨owner依赖如实列未验，不临时扩成当前渲染/触发/缓存必须新跑provider的前置。

第二中心固定2f8的[源码与局部独审](../../docs/evidence/web-platform/recovery-second-center-preparation-20261007/two-center-source-local-review.json)已接受三test/16产品未变、2direct通过且55未选、affected noEmit0；只核本片不扩旧测试覆盖。该准备时点双DB真实旅程尚未运行；后续实际见当前结果入口。该次准备要求完整owner输入与最新共享窗后fresh；新90秒含30秒清理、27配置连接上限和133MiB声明增量按最终包核，原routefix未用余额不转入。

上述2f8双中心旅程已按独立新90秒段实际执行，cookieRead+secondCenterCycle两组通过、两库各自正常清理，并获[限定实际独审](../../docs/evidence/web-platform/recovery-two-center-actual-20261007/recovery-actual-root-review.json)。A保持原key/body与同turn/task，B不含A身份；晚GET实际abort未交付，不冒迟到已交付被拒。新段计13020毫秒，旧余额与失败不变，无自动追加运行；此不代完整feature/main接收。

原RECOVERY01固定2f8已获[组合功能审查](../../docs/evidence/web-platform/recovery-two-center-actual-20261007/recovery-composed-feature-review.json)：03/05原工程矩阵完成，历史source/actual/controlled层级保留。原06仍由Original/中心owner对齐既有callerOrigin适用的single-origin/trusted-origin边界、迟到Clear-Cookie合同及重复Connect/32session容量策略来源，再合法main/intake；不以四次连接冒32slot实证，不把这些来源问题转成额外Web/provider运行或重测所有旧绿。

[既有中心合同来源对齐与窄Web接收](../../docs/evidence/web-platform/x01-candidate-release-caller-20261007/recovery-center-alignment-root-review.json)现已独审：声明的single-origin/trusted-origin边界和明确Connect新random session/global32/8h/不驱逐/满409无自动重试已按原证据对齐；lateLogout稳定cookie的Max-Age=0可清后续新cookie，JS忽略旧continuation不解决，保留原中心响应顺序后继。Original可先合法接2f8精确19源及03/05，06继续实际main/必要集成与该中心边界，不新增测试或重复业务task。原alignment在审查时未提交，不冒已main。


Recovery原03/05已由[Original主线回执](../../docs/evidence/web-platform/release-caller-recovery-main-20261007/recovery-main-intake.json)接入c130精确19源；06 lateLogout中心原后继仍开放。原[panels有限研究](../../docs/evidence/web-platform/release-caller-recovery-main-20261007/late-logout-readonly.md)复用revoke-only方案，只补固定六源与nativecookie/真实延迟headers测试边界；不冒实现批准、不新增Webgate，也不把Connect乱序或客户端擦除视为已解决。

### @file 快捷键的实际聊天消费者边界

沿原 MATURE03-03 与 MATURE06-04 键盘验收记录[固定源码发现](../../docs/evidence/web-platform/web-artifact-cleanup-fix-source-reload-20261007/file-tab-keyboard-followup.json)：main9a815eca7 的 ConversationThread 在已有 prevented/IME guard 之前处理 @file+Tab，且未排除修饰键；官方组件先调用消费者 onKeyDown，独立附件 fixture 的正确 guard 不能代替真实 App。此为静态控制流发现，未声称真实 IME 复现。

下一合法 owner 在独立树与精确领取范围内修快捷键判断顺序和边界：普通 @file Tab 保持有效；Shift+Tab、Ctrl/Alt/Meta、已 prevented、composition/keyCode229 不抢焦点、不打开附件、不发请求；保 Enter/Queue/Steer。只测实际消费者受影响路径，不重跑完整 IME 或全库；不重建当前固定 Web 产物、不打断发布，已排用户可见共享浮层片仍优先，不新增大task。

### 官方 Thread 动作与草稿保护的后继边界

沿REQ22–23及MATURE06-03/04/05接收[固定源研究](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/official-thread-action-research.json)：官方SelectionToolbar Quote会直接修改composer，仅有button/render slot不能代表已获当前view/draft权限。现未挂该功能；当前发送/恢复冻结text、knowledge、materials、settings而无quote，这属于后继设计缺口，非已复现bug。未来owner须复用唯一host和当前完整草稿权限，明确用户可见正文表示或受控协调structured合同，保持unknown原body、Queue及下一草稿保护，不另造状态权威。

官方Thread已有content-visibility与defer，不代表DOM数量有界。只有实际性能证据要求windowing时才在原性能/聊天后继处理，保message-ID、官方viewport/footer与焦点，不替换为自制壳。当前仅设计输入、实际NOT_RUN，不抢I01/Release/已排视觉或扩写权。

### Queue resume ACK 共享语义后继

沿原 TUI001-06/08 与 MATURE06-04/06，登记 Original 转述的 GO 固定035a只读发现：Web 对 queue resume ACK 的语义验证弱于 interaction，未完整检查未发生 promoted 时的 task 替换，以及 promoted task/turn/item 的绑定。此为固定源码观察，尚无本组复现或实现。

由原 Lead 在既有 FLOW 计划协调 browser-safe 共享纯规则，先保留可复现反例，再验证两个真实消费者。Web 保留自己的持久化与展示职责；矛盾或身份不一致的 ACK 不能落成 accepted，原 key/body 与 UNKNOWN 保持。后继排在当前个人发布和默认宿主诊断之后，实施前核当前 queue writer 与精确交权，不新建重复大task，不取用 Arc 已授普通段。

来源与排程事实见[管理原记录](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/current.json)的 chatQueueAckFollowup；未继承个人部署或真实回执通过结论。

本后继补充[固定035a四源研究](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/queue-receipt-mature06-research.json)：共享 package 目前没有 queue-control 导出，新增纯语义接口需原owner精确领取；五类定向反例保留历史 replay 与 latest mutable 状态的时态边界，不把重放回执直接与后来可变快照混比。仍为静态研究，未实施/未运行。

原 MATURE06-04 身份恢复后继另保留[canonical adoption 静态研究](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/canonical-adoption-research.json)：固定f885/891f共有的 accepted(oldId,id) 在目标 canonical view/draft 已存在时可能覆盖该草稿，rename可能产生重复route。候选时序为 CREATE 已持久但 ACK 迟到或丢失、目录另开 canonical 写入B、原A随后回执或重试；必须先用既有真实App/ACK-loss fixture复现。当前标 REPRODUCTION_REQUIRED，非 Arc 新回归或本轮阻断；保完整草稿与原 key/body，不增重复task或并行App writer。

原 MATURE06 恢复体验后继复用同一[草稿内容层级输入](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/recovery-content-hierarchy-followup.json)：安全名称不可得时用中性标签，不跨身份查名；保不自动发送、未决命令原key/body重试、删除边界和草稿/命令状态区分。仅直接消费者局部验收，个人恢复优先，不重复原完整矩阵。

原 MATURE06-04 / REQ22–23 的恢复记录插件动作后继接收[固定Arc7097七源设计](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/recovery-plugin-action-design.json)：最小record动作context与独立权限，复用私有restore lease/CAS；lazy activation或确认期间关闭重开、disable ABA后旧回调不可复活，不将raw journal或完整draft作为插件参数。后继真实sample验证版本/namespace变化、确认撤销与草稿保护；不新增task或当前VISUAL8/Arc20写权，不倒改已通过appearance结论，个人恢复优先。

- 既有 MATURE06-05 / REQ45 本机听写后继：[GO只读输入](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/go-local-dictation-followup.json)。先做零麦克风能力确认，实际支持且中文包可用才启本机；语言包只由用户明确下载，不自动安装或静默转远端。复用唯一 DictationAdapter 与跨窗格迟到撤销，当前质量/时延未实测，0新增运行与预算。

- [本机听写 adapter 固定补充](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/local-dictation-adapter-research.json)（原 MATURE06-05 / REQ45）：installed core0.3.22 的 builtin 只检查 constructor，listen 没有 processLocally 参数；未来 on-device-only 须窄 DictationAdapter 显式设置本机模式并核语言包状态，不能 probe 后直接委托 builtin；无 mic/install/能力实测，不新增任务或预算。

### 原06-03与REQ22–23：插件诊断显示一致性

沿既有06-03工程诊断按需可达与插件消费验收，记录[诊断最小设计](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/plugin-diagnostics-minimal-design.json)、[独立peer边界](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/plugin-store-peer-addendum.json)、[真实生产fixture补件](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/plugin-diagnostics-fixture-addendum.json)。待执行片只修command/render诊断snapshot变化到真实显示的通知链；保activation已有publish、单一host权威、错误/unknown可达。旧fixture未挂生产Settings，祖先App变化不足以验专用订阅；复用真实小显示组件与同host局部throw，禁止fakecast完整session。当前是固定设计与待挂载复现，未实施/未测性能、不扩Arc20或当前重资源窗口。

### MATURE06-04：首次与过期登录的可行动状态

GO在已发布61228新tab无有效会话时实见“Check existing browser session”仍笼统Reconnect，首屏先呈HttpOnly/API/CLI私有目录，缺少下一步。沿既有恢复与连接体验修复：仅按权威原因明确未登录、过期或检查失败等实际状态与下一步；当前ConnectionSnapshot缺少first/expired原因，先中性呈现“当前浏览器尚未登录”，禁止从本地expiresAt推断过期；正文优先说明如何继续，技术细节进入可访问下钻。本机预览可按需引导到已有安全入口，远端引导管理员；不得硬编码4320、新增凭据存储、自动读取token或把诊断日志当操作结果。复用既有会话检查/安全登录合同，真实首次与过期两种状态、键盘、双主题、窄屏验收；若共享合同缺少原因码，向原中心owner列具体依赖。此为原MATURE06-04/MATURE01后继，不新增task或779发布前置，不改已发布v4事实。

[固定源码和最小文案设计](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/actionable-connection-ux-research.json)已归档：优先指向现有“本机安装→工程看板→本机登录凭据”，远端由管理员协助；可配置非秘密help链接为后继，不为本修增加新API或强制依赖。

该原 TODO 已实际实施：W01 先在 Context 原 claim25d7 v3→v4 仅交回 App，保余7与既有8819验收；01:09:13.698801Z 于独立 web-connection-actionable / codex同名开始25分钟段，claim01103af8-051e-4282-bbbb-ba432e269ba6 v1 exact5。App 仅 import 与提取原 Connection 局部组件，session/BrowserWorkspace/认证与恢复逻辑不改。唯一父status仍本计划，子片仅own evidence progress。

- [ ] MATURE06-04 接收新组件的类型与必要行为不变量检查；不以逐字符串映射测试自证可行动性。后续 mounted 验实际未登录/离线/拒绝动作、显式提交前清 token、checking 不重复请求、保稿动作、键盘及390双主题；当前未运行这些 UI 验收。没有权威 first/expired 原因时始终使用中性未登录，不虚构原因。
