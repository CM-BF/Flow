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
- [ ] **WPF-MATURE-06-03** 验证正文与活动显示：真实增量、settlement retain/replace、typed-final完成状态、provider实际thinking才显示、tool unknown不伪造；Markdown/复制/懒详情。默认正文+简短自然状态，工程ID/计数/原因Details按需；成功回复的Activity succeeded/Open task controls/More actions/Task output/空0 waiting Center queue入口收敛，error/unknown/decision始终直接可见；普通hi、正常stream/tool、queue等待、断线unknown四旅程及390/双pane验收，error/unknown/恢复不能隐藏，系统通知不冒模型回复。 验证呈现区分正文规则、工程检查、独立审查/用户接受；缺source或artifact版本绑定为限定范围/unknown，A失败/B通过不能回写A。GO固定f181源码观察与ENG-001依赖见[研究](../../docs/evidence/web-platform/mature-theme-presentation-research.md)，不是新browser复现。
- [ ] **WPF-MATURE-06-04** 完成连接/刷新/未决发送恢复完整旅程（附件与已审dashboard安全停点后的下一优先，先于Arc/装饰）：有效登录期刷新/重开回同中心和会话，草稿与原未决identity保留；离线、认证过期、明确拒绝各有可行动提示。HTTP与流一致认证，跨tab/切中心/过期撤销/重启/丢ACK实际验证；重新认证不自动重投或换key，退出会话不cancel任务，取消操作另行明确。两公开客户端沿中心权威，认证与发送恢复为独立Module/Interface；键盘/IME/下一草稿、queue/steer/cancel原验收继续。invalid Bearer不回退owner、cookie不隔离端口、Origin/CSRF边界沿既有研究；0provider且不动个人登录/61227/61228。详细[原指令与调度](../../docs/evidence/web-platform/connection-recovery-priority.md)。
- [ ] **WPF-MATURE-06-05** 控制滚动与语音退路：后台更新不抢用户历史滚动；voice能力显式，不可用/失败可回文本并保草稿，无自动模型调用。
- [ ] **WPF-MATURE-06-06** 完成可靠真实聊天旅程：实际App fixture覆盖失败/恢复/双pane；明确预算后单次真实provider观察，至少两次正文增长才称增量，没有partial如实记录不补query。

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


06-04实施准备更新：root正式批准[RECOVERY01的21精确范围和接口](../../docs/evidence/web-platform/recovery01-fixed-cde-proposal.json)，直接归本大task、panels唯一owner。P01真实入口、材料恢复、原authority同步交接与IDB complete/CAS/CREATE两步沿固定方案；90秒实际旅程预算已批，容量尚待最大合法请求和完整记录验证。F01已有固定待审客户端，中心领域已独审但三项Web消费语义仍需对齐；资源门槛未满足，尚未创建树或领取。[具体核验与解除条件](../../docs/evidence/web-platform/recovery01-readiness-preflight.json)。

排程门槛已明确：F01固定且独审/main组合输入到位、fresh无冲突和轻量开发资源满足即可开工，中心三项语义并行对齐，完整浏览器旅程与整片批准前必须解决；不因这些不改DTO的方法细节推迟所有journal/controller工作。[独立正文容量依据](../../docs/evidence/web-platform/recovery01-request-bounds/report.md)已到，仅证明public请求body上界；owner必须测实际完整record与预留增长，全量预算不足不得截断或淘汰unknown。完整构建资源门槛独立保留。
