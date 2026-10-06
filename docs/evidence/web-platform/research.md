# Web 平台只读研究与执行转化台账

2026-10-06；研究者root及d01_owner，实际修改由各唯一实现owner执行。这里是研究证据，不是第二手填进度源；进度见对应status。需求原文与来源轮次保留在主管理plan。

| 研究 ID | 发现 / 来源 | 已作取舍及交给谁 | 验证要求 |
| --- | --- | --- | --- |
| RS01 Thread真实性 | [官方Thread](https://www.assistant-ui.com/elements/thread)、[CLI/registry](https://www.assistant-ui.com/docs/installation)、[ExternalStoreRuntime](https://www.assistant-ui.com/docs/runtimes/custom/external-store)；本地assistant-ui技能明确elements为复制源码。GitHub main `64277e2781ac0b65eb34b45bf0fad1f371e7b2d7` 的 `packages/ui/src/components/react/assistant-ui/elements/thread.aui.tsx` SHA256 `9a59232333b78c579f5fa30799bfc431ba7b35929750de44c7c40410d1d66ac3` | W01采用实际registry与0.15.23兼容源码，保留JSON/hash/许可和最小diff；不得以旧TimelineMessage整slot替代完整官方Thread | Root/Viewport/Messages/Footer/Scroll/Composer/ActionBar；新任务受理失败保草稿；不支持edit/reload/followup不假启用 |
| RS02 Arc与视图生命周期 | [Arc Split View](https://resources.arc.net/hc/en-us/articles/19335393146775-Split-View-View-Multiple-Tabs-at-Once)、[React状态位置与key](https://react.dev/learn/preserving-and-resetting-state) | W01 split/merge仅组织视图；同task单projection；stable key与草稿放稳定owner | A/B同时流更新、合并再分屏、关闭不cancel、任务命令不串ID、草稿不丢 |
| RS03 Tabs/splitter | [ARIA Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)、[Window Splitter](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/) | panels采用单tabstop/手动激活；W01若提供可调divider需键盘和值语义；splitter指南自身尚有review限制，不夸大认证 | 左右/Home/End、Enter触发懒读取、关闭后邻项焦点；divider方向键/aria值/controls |
| RS04 Terminal/FileTree能力与源码缺口 | [Terminal](https://elements.ai-sdk.dev/components/terminal)、[FileTree](https://elements.ai-sdk.dev/components/file-tree)；固定官方commit `6a9d5b1822ffb10bba4bd97175f01edd7d8651cd`，`packages/elements/src/{terminal,file-tree}.tsx`；[Treeview](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/) | Terminal不是PTY，默认黑色/强制追尾/pulse/复制无默认aria名；FileTree缺完整roving/Arrow/aria。panels保留source并做必要修正、记录diff。现契约无path/stdout channel | 命名任务输出/产物引用；token浅深、reduced-motion、上滚暂停追尾、复制失败反馈；tree单tabstop/Arrow/Home/End/selected/expanded/Space阻滚 |
| RS05 统一插件Host | [VS Code Contributions](https://code.visualstudio.com/api/references/contribution-points)、[Activation Events](https://code.visualstudio.com/api/references/activation-events)、[JupyterLab扩展](https://jupyterlab.readthedocs.io/en/stable/extension/extension_dev.html) | WPF-P01先建窄host和稳定位置；button引用commandId；内置terminal/files/theme等真实plugins验证。W01本轮只留位置不堆完整框架 | ID冲突/API版本、激活回滚、disable清理、调用时权限上下文复核、error isolation、按需加载/重试、sample无核心改动加button/tab/menu |
| RS06 性能证据 | [React Profiler](https://react.dev/reference/react/Profiler)、[INP](https://web.dev/articles/inp)、[Vite async chunks](https://vite.dev/guide/features.html#async-chunk-loading-optimization) | WPF-PERF01固定机器/build/fixture；原W01 CSS12.50kB/gzip3.23，mainJS329.14/gzip100.65，assistant-ui284.85/gzip83.60为历史基线，不能套到新增Thread；不为bundle指标盲删官方组件 | 冷启动/首次交互、tab/splitmerge、观察请求数、详情0/1/cache、close清理、长历史DOM/滚动；中位/p95需足够样本；synthetic不是模型容量；lazy error/retry/离线不崩 |
| RS07 与原工程对齐 | 只读固定基线FLOW-001 §10及full-plan-matrix：X01含REQ11/12/13插件全栈范围；原P01是协议；M02公共基础由原Lead负责 | WPF-P01是X01的Web host/UI扩展子项，完整plugin还需全栈生命周期/配置/能力作用域/隔离/CLI等价/tool-renderer-verifier/fallback/压缩归属；不重定义M02共享命令 | 原Lead明确跨计划owner及接口、统一能力命名/权限模型、Web可替换与后端真实能力分别验收 |

## 技能与clean-code

执行管理者本地优先沿用已读 find-skills、codebase-design、clean-code；只读UI研究另读 assistant-ui/SKILL.md及references/architecture.md、packages.md，并核对官方llms.txt。elements sibling本地缺失，没有安装无关技能。clean-code固定来源 `sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5`。

本段管理文档应用：逐条需求稳定ID、原话/转述明确，owner事实与跨任务管理拆开；发现P01/D02/D03编号已占用并使用WPF前缀；插件Web子项与X01总范围区分；避免把两个panels接口或ansi-to-react3/6版本同时宣布为既定。根只读研究由owner记入其实现quality证据；本文保留来源与取舍。


## 进行中审读转化（不是正式SHA approval）

- root核对实际registry thread.json：官方thread.aui.tsx内容SHA256 `64cb85b4076644dd319325b319264ec8e998e619a97c19e0f001d3fa5a03a016`，官方832行、本地833行；完整结构保留，变化为import、Flow插入点、composer显隐/文案、cancelOnEscape=false及受理中按钮禁用。实际来源符合要求，最终样式/接入行为仍需验证。
- W01：样式未接通的开发截图不可当验收；pending submit时close后迟到受理不得访问已删除view、重开tab或留下ghost observer；动态标题与render中网络副作用交owner修正，用延迟HTTPfixture验收。
- panels：A/B/A右tab/tree/追尾UI状态按task缓存，受控tab焦点同步、关闭按钮键盘策略、同referenceID跨task隔离与已选引用重分类可见交owner处理。实际修复/检查记录由实现owner写，管理者不将建议标为通过。
- 原Lead最新确认4320为17来源，D03独占全部dashboard后续；管理计划据此撤销我方重复实现排队，仅交来源登记。验证采用模块+直接依赖优先，metadata不重跑全库。

## 首版文档检查与clean-code停点

2026-10-06 02:15 UTC：检查14份Markdown的本地链接均可解析；四份plan的稳定TODO与status逐项一一对应，无重复；git diff --check通过（暂存后再次检查新增文件）。仅文档修改，不运行全库工程测试。clean-code复核命名/职责/接口/事实边界，实际修正P01编号冲突、D03重复owner、14→17来源、原话空格及表格断行；未来实现/性能/注册均保留未验证。

2026-10-06 02:15 UTC管理停点：root对c075bb5独立文档review APPROVED；新增BR-01具体后端请求与实现、查看、断开和终止语义分开，接口建议交主线定稿，避免把文本输出叫PTY。纯metadata无全库工程测试；下一步只读使用现有parser核对管理status能解析，不控制4320。


## RS08 插件生命周期与窄订阅（root只读研究#6）

官方[useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)要求未变时返回同一immutable snapshot与稳定subscribe；external store更新不能简单当非阻塞Transition，store选择lazy组件有整块Suspense替换风险。工程建议：registry按slot/command窄订阅，token流不刷新全host；lazy activation由明确事件驱动，loading/ErrorBoundary限制在单插件panel。

[AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)用于本地请求/响应流abort，不等于撤销服务端已受理任务。WPF-P01必须测并发activate、disable期间迟到resolve不能重注册、listener/observer真正清理；disable只清本地观察/未提交操作，不能默认Task.cancel。

panels owner只读调查定位W01的activityBar.primary与WorkspacePanelMount为实际host接缝；可信renderer可按mediaType/kind选择，未知数据仍安全fallback，tab身份包含extensionId/resourceId，不给插件直接FlowClient/token。其观察M02新workspace.ts是跨任务投影，不是文件工作区/PTY；尚未发现独立X01契约，交Lead固定父能力。此为观察/建议，不是接口已采纳。

当前独立审查WP-R1：root在panels target a2be896405304111379d72e9b22e46f8e47a11a4发现P2 blocking，Files树Enter开详情卸载树后焦点落body；已交唯一panels owner修复首次/缓存打开的焦点转移，未标APPROVED，不释放该owner开展新实现。


## RS09 整体shell回归与来源观察

root进行中源码发现（非正式SHA review）：全workspace单一active panel可能覆盖panels按task布局缓存，A详情→B terminal→A不能无意强制terminal；关panel卸载缓存要保留每chat布局或明确未实现。catalog list失败/loading必须可见并能retry，不能误认空任务；Chat Delete关闭后应聚焦邻tab。已交W01整体fixture覆盖，workspace目录仍panels单owner。root确认新Tailwind预览已生效，但截图不替代交互验收。

2026-10-06T02:17:22.204Z只读4320/api/snapshot：17个任务，无WPF来源；W01 live HEAD4c9bbe7d0f2ccf7ea3ffeedbb2f03c589a32b9eb、dirty=true、issues=[]。这是当时生成快照，非第二手填进度，未宣称来源登记完成。


## RS10 M02已交付接口与Web消费（root研究#7）

主线M02 e888862570cba3c59789053e68df7d5720650c36已只读核验clean；管理者已读其architecture/m2-workspace.md和contracts/workspace.ts。WorkspacePage升序entries与next/previous/watermark不同；pending只提示catch-up；tasks/attention各100截断，queryTasks有精确total但只有TaskSummary。root建议UI为独立工作总览连续feed+顶部直接attention操作，保留chat/panel下钻，非用户逐字方案。

转换成WPF-M02验收：去重/迟到提交/前后分页/reset409、阅读锚点与新进展缓冲、taskId+decisionId冲突不自动重答、catch-up退避/断网停止、100+截断/完整索引、0详情首屏、Abort+generation连接隔离。拟复用panels owner先做只读调查，正式新树等待稳定W01；不只pick405529d漏types，不改主线backend或rootlock。


## RS11 M02阅读语义与前置接口调查

root研究#8：[WAI feed pattern](https://www.w3.org/WAI/ARIA/apg/patterns/feed/)包含完整辅助技术焦点/滚动协议，不能仅添加role=feed；首版推荐普通list/article/heading+显式加载较早，只将新增条数做简短status。[overflow-anchor](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow-anchor)与手工scrollHeight补偿避免双位移，按entryId+offset实测prepend/resize/窄屏正文增高。

panels owner固定e888862只读调查：history.before响应nextCursor不得覆盖forward deliveredCursor；watermark非已消费；传signal覆盖client默认15s timeout，必须组合取消与超时；100项当前快照缺席不等于任务完成，queryTasks totalSize仅每页事务精确，过滤变更需generation与cursor重置。建议深模块WorkspaceFeedProjection隐藏轮询/分页/attention/索引，UI只收snapshot/callbacks。已写入WPF-M02验收，无实现修改。

组件交付闭环：root正式APPROVED target46a1dbd60aa57a464d67e5ac3d39cb2673706c36，WP-R1关闭；owner将证据落独占review.md并metadata提交16d51843c878112bd48cc58d316e36c25c15e167 clean交W01。此为交接快照，唯一W01实现状态仍在W01 owner的status。


2026-10-06整体独立UI补发现：root在5174 fixture对demo-decision Approve后pane为Completed/Verified而sidebar仍Needs your decision。已交W01同步catalog与各task projection摘要，不能每token重新list；属于本次多task拆分回归，W01整体review仍待最终SHA。最新10组owner浏览器报告通过也不自动覆盖该后发现，需要对应修复/回归。

插件接缝前置调查发现当前data标记有语义偏差：chat.message.actions在任务状态bar、sidebar.item.actions在整nav、sidebar.footer仅fixture可见、workspace.actions仅Terminal页。进入host阶段应以React声明式typed ExtensionSlot在实际位置消费，不能DOM扫描自动注入；当前标记不等于已实现pluginregistry。详细映射待只读owner回报。


WPF-P01接缝调查已持久化到[plugin-seams.md](plugin-seams.md)：位置→command→context/capability→disable清理，明确当前标记语义差异、同realm第三方无隔离保证和WPF-NAV-01后续统一导航。研究没有在旧panels树开展新实现，管理文档唯一owner落盘。


## RS12 Host错误隔离（root研究#9）与准确主线基线

React[ErrorBoundary](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)不捕普通event handler/异步callback异常，host activation/command需要显式catch及plugin归属诊断；有Boundary不等于完整错误隔离。[VS Code Extension anatomy](https://code.visualstudio.com/api/get-started/extension-anatomy)区分static contribution/activation/API，支持manifest先登记、首次使用加载、退出清理。最小矩阵：并发execute一次activate、disable迟到不复活、激活失败全回滚、dispose一项抛错仍清其余、异步command无unhandledrejection、render故障局部可恢复、禁用后旧command/context拒绝；注册失败原子，无半套按钮。

主线现已提供受控main/origin `108fddbd8261963f3d49088873b5a611b70a5dbf`（完整C02+M02，W01改版未在其中）。两新owner已收到：未建树从108f起显式合W01已审输入；已建树/改动不reset，受控merge并记录。共享代码/lock冲突交Lead。主线另查>200新task投影accepted/output因果顺序风险，局部PG修复不改API；待补丁SHA同步，不阻塞前端独立树。真实中心10task UI仍需我方执行。

W01整体root独立review APPROVED targetcb4a39211e264538704ba9d474eeb08fc4b2759c：独立typecheck/10HTTP、官方sourcehash与结构、shell/projection/生命周期审读，CUA新任务queued→waiting→Approve后pane/sidebar同步，读owner10browser/3导航复验/production smoke且抽图；没有假称独立重跑全browser。范围不含真实中心/PTY/fs、reload草稿布局持久化和性能承诺。已令owner转录正式metadata，后续改版另审。


## RS13 实际首屏资源与lazy重试（root研究#10）

只读cb4a392产物index.html：入口index-Z6yWGp8n.js与modulepreload assistant-ui-zkRmV749.js均首屏加载，codeSplitting.groups只是分组。实际JS1,081,775B/gzip323,056B，CSS82,839B/gzip15,047B。后续测连接页/工作总览首屏请求、parse与interactive，再评估Thread/重renderer按需边界；保留完整官方组件，不以重命名/单chunk<500KB当优化。官方Thread content-visibility:auto减少屏外绘制，不减少下载或保证DOM有界。

React[lazy](https://react.dev/reference/react/lazy)缓存load Promise及resolve；reject交最近Boundary，单纯reset Boundary不保证重新import。后续lazy/plugin性能验证实际再次请求/恢复策略；lazy定义模块级稳定，禁止render内重建导致draft/state丢失。MDN[speculative loading](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Speculative_loading)为背景来源，当前首屏结论以产物HTML证据为准。

进行中M02发现（非正式review）：actions pending在offline/stop generation失效时可能不能清除，恢复后同task命令被永久pending守卫阻断。root已直接交唯一owner做本段修复与回归，记录实际结果在其证据；管理者不把反馈本身写成修复通过。

主线D03新增status人读字段已通知W01/M02/P01唯一owner各自写：阶段、优先级1–9、当前产出、下一可用交付、当前阻塞NONE/ACTIVE、需用户决定NONE/REQUIRED、完整实现目标或UNKNOWN、literal实现路径含测试不含metadata。管理者仅写WPF-001，其他task不代写。纯字段验证不重跑工程全库。


root只读clean-code停点2026-10-06 02:29–02:32 UTC：范围W01产物HTML/切chunk配置与M02草稿projection/overview；查职责、状态所有权、异步错误/取消、重复与复杂度。发现首屏两chunk均eager→PERF待测；generation失效pending滞留→M02 owner本地修复待回归；无成功快照的肯定空态→owner检查。root未写实现，未对未提交M02给approval，未扩大全链测试。

Dashboard最近独立观察2026-10-06T02:31:15.901Z：4320仍17源，W01 actual a22ae38 clean、errors/issues空、checks targetcb4 passed、旧review显示metadata导致outdated；WPF尚未出现。D03换新registry后再复验，不频繁轮询，不声称已聚合。

原Goal Owner增量定向研究（合并RS08，不是用户原话）：使用本地find-skills选择React性能与codebase-design，只读W01 useSyncExternalStore/TaskThread转换。[React caveats](https://react.dev/reference/react/useSyncExternalStore#caveats)说明external mutation不能靠startTransition自动非阻塞，snapshot须稳定不可变。保留每task projection，统一feed避免每条tool更新重算全部messages/panels；先保持未变对象与可见区域窄订阅。后续固定1/16/128合成task，连续更新时真实输入/滚动，记录输入延迟/render数/long task/attention出现延迟；这是UI合成负载，不是128 agents容量证明，不猜测性引入状态库或机械memo。当前M02/P01继续。


Host接口协调：M02已接受interface.md的ports/exports方向，P01进入实现。管理者发现局部ExtensionSlot context与global getContext可能不一致，要求hostUI绑定本次invocation上下文并验证args资源匹配，覆盖active A时B行action；ResourceContext实际判别kind/message/composer/reference身份。HostPort Promise<void>可throw，PluginHost返回OperationResult，两层约定分清。这两项属于同接口澄清，不另造协议，双方已收到；composer无安全接缝时明确unsupported不成功noop。完整接口/实现冻结记录由P01 owner维护。


## RS14 多chat SSE连接占用：从假设到确认缺陷

初始调查假设：W01所有曾打开未关闭chat均保持TaskProjection.watch，包括terminal；FlowClient fetch SSE，中心HTTP/1持续keepalive/查询。MDN[Using SSE](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)说明非HTTP/2浏览器同源连接限制。不能以Node HTTP并发测试代替浏览器证明。

随后root独立CUA在63182实际复现并定为P2 blocking：空会话依次打开Independent task13至8，共6个Live未关闭chat；再开demo-queued，任务区空并最终signal timed out。关闭13释放一条，再关闭失败queued/重开，queued即时正常Live。关闭的只是观察/视图，无任务取消副作用；这是有关闭视图workaround的网络功能阻塞。

根将修复交M02唯一App owner，不由P01重复改旧W01。方向为实际可见pane观察、后台summary由workspace供给或其他经验证方案；需7–8chat真实浏览器复验show/decision/feed/重开catch-up、观察数与关tab不cancel。旧cb4历史review结论按当时检查保留，review追加后发现；本轮交付不能继续无保留称零blocking。管理者已明确通知原Goal Owner/Lead，待修复SHA与独立复验。


## RS15 局部UX与连接范围集成验收

原Goal Owner低优先观察：真实中心reconnected-completed-light.png已Completed/Verified仍显示accepted task continues at center。root只读TaskThread.tsx264–270确认terminal也落此文案，已交M02唯一apps/web owner做准确结束语义且验证状态分离。artifact-dark-narrow.png活动正文与可见tab标签不一致；源码controlled effect仅更新focusedTab，仍须窄屏浏览器实证后再列confirmed bug。两项仅对应状态/窄屏检查，不重复全套，P01不并发写旧组件；SSE修复优先。

P01×M02连接范围：root接口审读要求App断开/换中心dispose或generation失效旧host/ports/contributions，旧async activation/command/render闭包不能用新连接复活，尤其同taskId跨中心；host提供注册/清理机制，M02绑定connection epoch并重验bridge。测试旧host完全清理、新连接host分离，不把token放context、不改公共API。已交两owner。

SSE验收补充来自原Goal Owner并直接交M02：连接池跨同浏览器同origin页面，补2page、hidden恢复与2split局部检查，留命令/详情预算；退订不重置decision/cancel幂等ACK，HTTP2不是唯一修复。跨多窗口集中预算归B01后续，不在当前临时引SharedWorker/BroadcastChannel；所有新结果仍待owner证据与root独立复验。


## RS16 新用户领取协作要求与已聚合事实

用户U08原话已逐字进入主plan并追加REQ37。主线D04唯一Execution Lead负责领取展示/单点登记，assignment账本仅lead/owner/scope/claim/handoff，不复制TODO/check/review。管理者已向两owner收精确literal路径并要求阶段短值M2，P01排除App/Thread/workspace、M02排除plugins/plugin-host测试；声明handoff后集成，不用worktree隔离掩盖重复实现。领取时间取当前实观登记，不倒填；每次派工前读dashboard+权威status+liveGit，缺/旧/冲突不当空闲。

root独立新版D03观察2026-10-06T02:38:47.600Z：22源，WPF001/M02/P01 human.complete=true、missing/issues空；父fa725440 clean，M02 35f0bb9 dirty12，P01 c8900a6 dirty4。W014735d476 clean、SSE blocker active；M02 blocker none为同步滞后已要求唯一owner下安全点更新。来源注册TODO已完成，但不等于实现或D04领取展示完成。


## RS17 正在实现中的host错误结果与M02窄屏实证

root前置只读发现（非正式SHA review）：host.execute把handler返回的底层{ok:false}再次包为顶层{ok:true,value:{ok:false}}，当前模块测试也断言嵌套形状，UI可能只看顶层误报成功。已直接交P01唯一owner统一单层OperationResult或内部throw/public收敛，并验证实际button拒绝/桥接失败反馈；不对未提交整体下approval。

M02 owner实际390px浏览器确认活动tab超出视野：Field notes summary→关面板→Verification evidence，aria-selected正确但tab right603.64大于容器right360。管理者向原Lead请求追加唯一文件WorkspacePanels.tsx scope。消息交叉：owner在登记门禁送达前已按原apps/web广范围授权落17行局部scroll effect/ResizeObserver；仍未提交，接通知后冻结该文件，不回滚覆盖，真实时序已报root/MainLead。待单点登记回执后纳入固定候选；无P01重叠writer。

owner随后报告6项专项通过：HTTP1 8chat、2split、2pagehidden恢复、隐藏迟到受理不重发、show失败retry、390px活动tab可见；真实PG/HTTP10协议runner任务4组与20局部单测/typecheck/build通过。当前仅owner结果，SSE仍ACTIVE待固定SHA与root独立复验。准备独立模块候选/真实浏览器证据，不扩大全库测试。


范围追加已解除：管理者实际读取原Lead提交c2de313ce5a6f036f07bbfb28d52a7e1a2cc1b9f的docs/evidence/d04/transitional-assignment.md，登记时间2026-10-06T02:43:31.089188Z，明确WPF-M02追加WorkspacePanels.tsx且与P01无交集，允许原owner局部修复/提交。已通知owner解除该文件冻结。此为过渡协调登记，不是PostgreSQL receipt、不是OS强隔离；正式账本迁移后核对origin=migration，不伪造更早许可。

2026-10-06 02:44 UTC管理clean-code安全停点：范围为需求账本、scope移交、状态与研究证据。检查单一来源/命名/当前与历史事实分离、边界清晰度、无重复实现和无多余全库测试；修正了旧nested仍称权威、当前等待注册过时、阶段长句与范围过宽；将当前3个源、两个只读stub、D04分配账本与status进度各自唯一写入责任明确。用户新原话逐条持久化，待实现/owner检查/独立review分层，不把测试报告当整体approval。未解决：SSE待稳定target独立复验、P01模块/UI分段review、D04正式receipt迁移。


## RS18 固定候选审查与后续独立挂载（02:50 UTC）

root独立模块review target2dad8cac7586c294a7c559b31161b201f791199e为REQUEST_CHANGES：PH-R1 P2订阅listener抛错逃逸宿主、阻止后续listener且无诊断；PH-R2 P2以in校验slot接受toString与view:constructor原型键。唯一P01 owner修复后target3d8121006fea24b6b9f25457eb363a10110781ad获scoped APPROVED，root独立14模块tests通过，PH-R1/R2关闭；不覆盖ReactUI。此前嵌套OperationResult在2dad已修，桥Promise<void>抛错/public单层收敛。整包d81075c1220fc0305bf698d84823caa4877c2d89的React/builtins/fixture由完成M02的owner只读审，修改仍P01唯一owner。

管理者只读M02 base35f0bb9df3f57b858c39b13fab940137c747d1f1→targetd47c602f3bab1fe97a9be70fd37780c2918bcfbc：38文件全在D04精确claim含c2de313追加，rootmanifest/lock/workspace config/packages/server无diff；metadata0a9e85f仅validation/status/review且tree clean。三件套3本地链接存在，TODO01～03完成/04进行中一致；JSON9/6/4组pageErrors空，依赖link指本树client/contracts。完整diffcheck因raw unified patch空上下文160处与原始焦点文本1空格退出2；排除两个原始证据后source/docs为0，metadata diff为0，不伪称完整通过。发现checks非PASSED前缀、review非标准target标记、plan旧广scope与status待汇总过期，交唯一owner修metadata。

root同期20测试/typecheck通过，在49922 HTTP fixture独立复验旧6chat→第7失败场景已可8chat Live，detail与Approve正常；这只是fixture复验进展，最终整体结论尚未给出，不能冒称独立再跑真实中心。owner真实PG4组/10协议runner任务报告仍独立标识。

后续WPF-I01由root同意独立tree/branch，先D04精确scope与相交文件移交，再复用M02 owner挂载；P01继续唯一写plugins。其实现不是扩大M02已审范围。主plan新增第五子计划三件套，准备源以后移交stub，避免第二进度源。

02:50管理clean-code停点沿已发现本地find-skills/clean-code方法检查命名、单一来源、错误/状态表述、无重复协议和无必要测试：修正当前status的旧preview/旧HEAD/等待来源注册、集成清单过时未知接口；维护历史approval与当前候选分开。仅管理文档写入，没有代写实现或无关全库测试。待办为M02整体结论、P01 UI审查和D04下一段领取。


02:52 UTC更新：root正式APPROVED M02 targetd47c602f3bab1fe97a9be70fd37780c2918bcfbc，SSE P2关闭；独立20tests/typecheck，8chat+Approve/detail/splitmerge、390px活动tab可见和darkoverview，审完投影/views/index/App/SSE。未独立重跑真实PG；作者10协议任务证据已读。管理者已向原Goal Owner直接发送WPF-I01精确11项scope/新tree/branch/owner依赖，要求先M02释放App/TaskThread/WorkspacePanels再账本转交，P01整包仍在审，不提前开写；此前RS18“review中”保留当时观察。


## RS19 UI错误反馈与长时feed驻留（02:55 UTC）

root正式P01 d810整包REQUEST_CHANGES，PH-R3 P2：CUA5190 fresh→Notes→Fail App bridge→Use Ocean theme，theme未变且alerts=[]；sample只setError未render。模块3d812 scoped approval保留，唯一owner补local alert/该路径回归，并自查renderer context mutation freeze；新候选e5341915ebbffd9a667f68f7d1ca9c45c14c7c52正独立复验，owner9browser/typecheck通过不自动等于APPROVED。

root对固定M02 d47公开refresh做只读内存fixture：100批×100条、每条256字符，前50批following/后50批reading；entries100/1000/5000/5000，buffered末5000，revealNew后10000/0。Node单refresh采样0.443～0.702ms（首0.484），不当浏览器输入/内存/网络或模型容量。代码全Map+sort和无驻留上限支持待测hypothesis；性能plan已加1/16/128任务+10k记录测对象/DOM/真实输入与内存，先测后决定bounded cache。不是确认性能bug，不扩大当前P01/I01修复。

管理者只读D04实际migration-receipts：M02 dea92c6b-3450-404c-a32c-3fd007485ac6 v1、P01 0686525b-d323-49b5-affa-cefc66cb13be v1；管理WPF001632a7149-e812-4ddb-b342-99572c554cc5经amend为v2，observedAt纠正02:48:42，原未来02:55审计仍保留，不能倒填。M02 owner最终metadata c526c1c889437ee39155d669921577995195c74e clean并确认App/TaskThread/WorkspacePanels三路径停写，已tool报原GoalOwner请求amend再I01take；停写事实不冒充PG已变更。D04 take需真实worktree，root许可owner仅从c526初始化新tree只读，未取得receipt/审定输入不写实现。

02:55后续：P01 PH-R3 root独立CUA复验关闭；e534整体仍待另一只读React/接口检查再给总范围结论，模块/单finding/整体分开。父status NONE括号解释导致D03缺字段已按实际问题修为纯NONE，解释移正文；这是管理记录格式修复，不改变聚合器或他人状态。


PH-R4 P2正式blocking，target e5341915ebbffd9a667f68f7d1ca9c45c14c7c52：workspace_panels_owner独立只读审查发现，root二次CUA确认A打开report detail→B→A，原report tab count1→0。PluginView contextKey/loading/RenderBoundary remount销毁真实WorkspacePanels内部每task布局缓存，退化已验证A/B/A保留。P01唯一owner仅plugins范围修，不能跨改待转交WorkspacePanels；需A/B与Notes↔Workspace回归和新target独立复验。整包REQUEST_CHANGES，模块scoped不撤；管理者已tool通知原Lead I01只建树/账本准备，P01输入尚未审定。


PH-R4方案研究（root只读官方来源）：[React Activity](https://react.dev/reference/react/Activity)隐藏时保留state/DOM并清理Effects，恢复重建Effects；隐藏仍可随props低优先级render，初始hidden可预渲染/Suspense取数，媒体DOM副作用不会自动终止。已交P01唯一owner：必须显式visited/activation gate，不宣称Activity天然零fetch，disable/dispose/权限失效仍清理。技术选型与实现由owner负责，后续行为实测证明保留与清理，不以官方API替代验收。

I01预留树已由拟owner仅git worktree add创建，管理者独立核branch codex/web-plugin-integration / HEADc526c1c889437ee39155d669921577995195c74e / clean；无安装/修改/P01合入。已回主线take所需实物前提，等待D04 M02 amend与I01 receipt；这是准备不是实施。


## RS20 D04部署与真实交接

主线D04独立APPROVED0dec109并集成main/remote b5b4ce21bd8ae5e0fd729c526226e8f8a49a7a47，原Lead单写切换4320；root实际CUA看到领取ID/version/Lead/Worker/scope/branch/时间。管理者读主仓AGENTS与D04 README，并02:58:06.804Z经主仓CLI只读list核PG available、M02v2/I01v1/管理v2/P01v1。正式amend/take receipts已保存集成清单链接；新旧路径无重叠writer。用户U08“take可见”已实现，后续领取规则继续采用，不把一次通过写成永不冲突保证。

部署后非阻断展示问题由root交原dashboard owner：WPF001 human.decision.state=none且missing空，详情却显示用户决定未知，原因仍读旧status.decisions章节。建议详情决定/next/risks优先使用同一已解析human语义；外部分队不写dashboard app.js，不撤销D04领取功能验证。E01认证probe由主线唯一owner独立推进，我方不重复。


03:00:30聚合收口发现W01 NONE；解释同样不合D03严格字段语法，human blocker unknown/missing。交唯一W01 owner在plans-only claim v2改纯NONE、解释留正文，metadata d2631f03b4bdc9bc0d543f09c11c8961a1fdf557 clean。管理者03:01:16.398Z再读4320确认human完整、none、missing/issues空；只修事实源格式，不改解析器。当前26来源、activeclaim数均不代表活跃agent数。


I01已由唯一owner在新tree落canonical三件套，首文档e9dc6904cac949638a993b8f00d0d485a010a1f1 clean；管理准备三件套转stub，source注册请求已tool给Lead。root新增验收强调同host任务切换保留局部UI，而host/center epoch变化卸载整个plugin view lifetime，相同task/ref ID不能继承旧center缓存，dispose后旧bound command拒绝；此为集成要求尚未实证缺陷，不另报P2。已交I01 owner补canonical plan/seams。

P01 PH-R4新候选6ce3ba0a41d51f26cd6fbceddfbb2f80e4931bd6，owner15模块/12browser/typecheck通过；root与原finding reviewer分别做CUA/diff和独立15模块/行为复审，整包结论尚未给，不提前放行I01。


03:06审查闭环：P01整体APPROVED target6ce3ba0a41d51f26cd6fbceddfbb2f80e4931bd6，PH-R1～R4 CLOSED。root与原finding reviewer实际CUA/Chrome复验A/B/A、Notes、错误/deny/disable，reviewer独立15模块PASS；owner15模块/12browser/typecheck/生产fixture build与静态冒烟报告另存。最终metadata2910ebc8e11fbcb00d1c2773face229c84fe47cd clean已交I01受控merge；不继承为I01已验证。P01旧scope仍保留回修责任，原owner获PERF仅预留树准备派发，D04四精确测量scope已向Lead申请，无生产改动。


03:08管理clean-code工作段：重读current status/queue后发现先前追加事实仍留旧“待parser修正/整包另审/等待注册”在当前正文，已直接替换为M02c526、P01最终2910/6ce approved、I01正式实施与PERF已领v1，不仅尾部追加；删除重复X01句并保持完整父范围开放。核单一source与scope/receipt/独立review边界，管理层无生产实现、无全库测试。PERF自助take已回Lead，原始JSON存证；当前4个权威WPF源，PERF第五源待owner建立后登记，claim不是source。


## RS21 性能测量语义与PERF权威来源

root官方研究已直接交PERF唯一owner：MDN [PerformanceEventTiming](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceEventTiming)默认仅记录>=104ms，durationThreshold最低16ms且时长按8ms取整；input delay与到next paint的duration分列，continuous scroll等事件不在其中。unsupported或无符合门槛样本不能写成零延迟。MDN [PerformanceLongTaskTiming](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming)门槛>=50ms并先能力检测；没有记录不是证明没有较短阻塞。React [Profiler](https://react.dev/reference/react/Profiler)普通production默认禁用，不能将无回调写零render，profiling诊断build与production timing报告分开。

PERF canonical首文档c7bf1a81e5d21a602636f388ff565bae1844d83e已建立，管理旧计划三件套转stub，最新方法/结果由新owner唯一维护。实际source请求已tool给Lead；当时rootlock dirty被管理者误按W01历史例外解释，后续明确协调纠正见下段，不能把初次解释当PERF写入授权。完整生产容量/实际模型并发仍未测，1/16/128 synthetic只为UI负载，测量边界不被工具指标名字掩盖。


PERF安装范围纠正：GoalOwner明确PERF四scope不含根lock，历史W01临时安装例外不能自动扩到新任务。root已要求唯一owner保存必要diff到docs/evidence/wpf-perf01/dependency-lock.patch后，仅恢复自身pnpm-lock变化；owner完成，管理者实际只读git diff --exit-code -- pnpm-lock.yaml package.json为0，dirty仅受领脚本/计划/证据。后续用已安装依赖与冻结锁，新增依赖交共享owner协调，不能再假定可逆就自动扩大claim。保留最初真实安装时序与本次纠正，不声称从未产生差异。


## RS22 I01进行中反馈、首次来源闭环与新用户需求

root在I01未固定55049预览独立CUA观察官方Thread Task output→插件Terminal、引用→产物tab、Notes往返保留、Ocean主题/禁用sample回Dark并移贡献成功；这不是approval。发现Settings关闭及Escape焦点落BODY，已交唯一I01 owner修入口回焦点与局部验证；反馈无固定target，不扩大旧P01审批。

root03:12:04.035Z实采4320：WPF001/M02/P01/I01/PERF五源human.complete=true/blocker none，PERF已注册且claim4553v1 matchesSource，unregisteredAssignments空；协调available，当前14 active writer claims按literal同路径/父子前缀两两检查0重叠。首注册验证完成，不再重复刷；claims数不代表agent并发，零literal overlap也不证明无逻辑重复。

U09由原Goal Owner逐字转交：“把产品Web UI打开留着可随时看，且工程dashboard增架构tab”。主plan已追加稳定REQ38/39并标转交来源，不扩写成更多未提出功能。最终预览选择为已审M02 49922并保留用户tab；I01现有55049由原owner保留标fixture/未固定，不另起重复服务。早期main3773预览设想未实施；架构tab主线唯一owner承接，我方不写dashboard。


U09预览选择落定：原Goal Owner最终已打开并保留已审M02 http://127.0.0.1:49922/ 用户tab，明确fixture，要求原owner保留服务并回handle/恢复法；此前main3773另起稳定预览只是安排方向，未实施，不再声称其已启动。I01 55049只作开发验证，无重复服务。root另以新CUA tab13复验I01 Settings Close/Escape两路均回入口BUTTON Extensions and appearance，进行中反馈已关闭；未固定实现的正式review仍NOT_STARTED，临时review tab已关。


49922服务恢复信息由原owner明确回报：workspace_panels_owner / exec session17885，未停止或重启；固定树web-unified-workspace、branch codex/web-unified-workspace、metadata c526c1c889437ee39155d669921577995195c74e，运行Node24 `pnpm exec tsx apps/web/test/workspace-preview.ts --preview`。默认动态端口以stdout为准；恢复法在集成清单，不假装总能占49922。

## RS23 性能首样本与下一轮候选（03:19 UTC）

PERF唯一owner已交固定脚本c40f1a02252198f4a4b1a80474743d72b1fa1dca，2组HTTP/projection有效性、typecheck与普通production最小100/240样本通过；完整1/16/128任务矩阵仍进行，每场总10000新增+初始40、256字符、100条每50msproducer，原App分页/轮询未改；180秒追赶/60秒reveal超限真实记失败，不无限放宽。root方法只读初审尚无立即blocking，正式review待完整结果。

root读取完成的1任务生产首样本：最终10040行/70404 DOM，reveal自动化综合壁钟约2495ms，整场8 long tasks/max705ms；这是单次样本，尚须分phase，不能推为该动作因果或p95。源码候选为Overview每次map全部entries/格式化时间、anchor遍历DOM bounds，以及App query变化可能连带render。先用完整结果决定有界列表/行渲染/anchor查找优化范围，不能把hypothesis写成确认瓶颈或扩PERF四scope到生产；尤其不能抢I01 App.tsx。未来改动须独立base、精确claim与唯一writer，不为猜测先加框架。

U10原话由原Goal Owner逐字转交：“plugin管理写进计划里”。父plan新增REQ40，X01全产品canonical由主线维护，路径待回传；持久版本/配置/权限/作用域、npm完整生命周期含rollback、活跃执行版本绑定、Web+CLI同center命令和可信/隔离边界均属主线父范围，P01/I01前置不替代完整管理。

03:19管理clean-code工作段：检查当前正文与历史追加是否矛盾、唯一来源与TODO一致、权限scope与review范围清晰；修复dashboard协作子计划仍停在17源/未注册的陈旧状态，改实际30源且原17全保留、四nested转平级canonical、新增U09架构tab待办。当前main3773对cb4/d47的ancestor实核用于关闭已完成管理TODO，不以测试通过推集成。将预览最终选择49922、恢复handle和PERF rootlock边界写进当前正文。仅文档/JSON摘要修改，无实现或全库测试。

本段文档检查：21个Markdown、66个本地链接、全部plan勾选与status行一致，修正父status两处多一级相对路径后零错误；git diff --check通过。独立review仍绑定旧c075文档，本增补不自动继承。

03:23管理者主动只读实核主线X01：tree plugin-management-plan、branch codex/plugin-management-plan、HEAD888308dce1d8061ab66ce93c10c023ec66d6eb58 clean，canonical plans/x01-plugin-management；读完整目标/版本/授权/CAS/生命周期/隔离/CLI及P01/I01前置关系，文档target有但产品UNKNOWN、独立review未开始，不替主线审定。D05 canonical为dashboard-architecture/plans/d05-architecture-view，Execution Lead唯一owner、base3773、dirty实施/targetUNKNOWN。父REQ39/40与WPF-D01已补实际路径。

PERF01正式benchmark review：root APPROVED target3d47cdd4eae959119f154a0d06964cf65006f8c9，basec526，固定证据adc2595bbc34986353514d374afeb0eca0188ee2 clean。独立源码/窄分页修复/报告审阅与三成功raw SHA/count/min/median/max/DOM/API重算，资产bytes/gzip/hash+HTML相同、双图核验；未独立重跑browser/typecheck，作者结果归作者。不覆盖生产优化或I01。PERF02准备三件套/8精确scope已报主线；旧M02明确停写三生产接缝，PERF原owner待metadata后停写probe，正式amend/take尚未发生。


## RS24 用户持续对话优先与真实能力分阶段（03:25 UTC）

原Goal Owner经root反馈用户在49922输入hi只见固定英文center/runner/result和Field notes/Verification卡片，要求真实Codex式持续对话。由于没有完整逐字原话，父U11明确“准确摘要”，REQ41～45与WPF-CHAT01三件套逐项保存模型/effort/access/context/files/语音/发送/气泡/queue/steering/tool与可展示thinking、正文优先/详情轻引用边界。初始响应与SSE不送大payload，展开鉴权按需，provider没提供不伪造；queue持久顺序取消，steer真实确认生效，不用newtask假冒。语音录音/转写分开，失败回文字，无暗接付费服务。

立即执行优先变更：PERF02保留准备93889c3，尚未创建树、amend/take或生产写入；w01_owner已确认暂停。PERF01最终metadata36d80219e4565783e371fd3cd6c29adc4d1398cc clean，原claim4553v1仍4scope；此前probe停写声明保留历史，不授予另一owner。原M02停写意向也未改v2范围。I01当前收尾照常，新增workspace.tabs合法button/menu挂载反馈由其owner局部修复，尚无固定candidate。49922保持原tab/服务，不暗换。新对话先只读接口调查与主线共享owner协同，独立scope/receipt后再实现。

U11落盘固定计划提交c6592aaa9f4bc617fb6ade9e56de661447ee1cdd，28Markdown/113本地links/TODO一致0错误、diffcheck0。03:26:35.296Z实际4320已读WPF001 HEADc6592 clean、priority1、真实持续对话当前产出/下一接口交付、human.complete=true/missing/issues空；documents包含conversation-core/plan.md真实下钻入口，事实摘要见[新优先级dashboard证据](chat-priority-dashboard.json)。这只证明计划展示，不是聊天能力已实现。

03:29精确化与调度：主线允许内部每turn durable task/native resume，前提中心持久conversation、有序turn/context lineage；不能把禁止假拼接误写为禁止复用task。固定源码调查及官方ExternalStore/queue/Dictation/SpeechRecognition研究已合并[CHAT接口证据](chat-interface-research.md)，更正早期未看到原子session占用的推断。随后原Goal Owner经root明确：U11已持久化且中心合同未ready时，八scope PERF02可并行；I01收尾owner后续优先CHAT消费。此前暂缓真实发生且无事务，新明确恢复后才准备树/现场versions/CAS，不能假装从未暂停。


## RS25 I01闭环与真实领取恢复（03:32 UTC）

I01 root整体APPROVED target92a786abb9f7ef16e15482ac00b98ff860ecc47f/base1002，最终metadata b5844442699733558a152c12392ea78f26c393a4 clean。root独立24模块、55049实页Thread→Terminal/reference焦点、Notes保留和Settings Close/Escape回焦点；管理者13实现文件全在liveclaimv1，shared/manifest/lock/P01plugins diff0，metadata实现diff0，7Markdown34links/TODO一致0错。作者9browser/3真实PG/生产检查执行先后与未重跑限制诚实记录；不是live模型。owner明确停止I01全部实现，claimv1仍保留，CHAT合同ready后才精确移交。

原Goal Owner经root明确U11已固定且中心合同未ready时允许PERF02并行。03:30:21.949Z现场CLI核M02v2/PERF01v1，独立核新web-activity-window/codex/web-activity-window HEADcc334 clean；遍历workspace-feed正好六现存文件，保留四文件无遗漏。先M02 amend v3 committed03:30:25.663Z移出Overview/css并取消父scope，再PERF01 amend v2 committed03:30:29.445Z移probe，最后PERF02 take d36cd583-7c96-44c3-b92c-1cd0f208cc4e v1 committed03:30:35.629Z取得8scope。原样receipts：[M02](m02-activity-amend-receipt.json)、[PERF01](perf01-probe-amend-receipt.json)、[PERF02](perf02-take-receipt.json)。恢复是新的明确调度，不抹掉此前暂停；无旧回执复用、无双writer、无新agent。owner被followup_task正式唤醒而非仅给completed agent发消息。

root03:31:52.249Z实际4320为34源，I01/PERF01已正确approved，PERF02仍unregisteredAssignment，已要求canonical初始化后交Lead登记，不谎报完整聚合。原Goal Owner另协调Mika task01a10f3f-4ef0-7ca2-8e66-f1947fa4b295队2活跃，主线4+本队最多4+Mika2总10；本队无新增agent。Mika唯一worker负责B01后台snapshot/events/workspace-feed字节/长历史性能，其下轮X02中心插件合同/PGregistry由主Lead协调，本队只Web，CHAT合同ready不被性能装饰拖延。


03:35 CHAT正式移交：独立核新web-conversations/codex/web-conversations baseb584 clean；03:34:48.886Z live I01v1，实际plugin-integration五文件遍历核齐。先CAS I01v2 committed03:34:54.170Z，移App/官方Thread/session/react、旧父scope改另外3literal文件，再take CHAT08259c1d-3711-4f5f-bf21-ad355ffa4cf3 v1 committed03:35:00.744Z/16scope。原样[amend](i01-chat-amend-receipt.json)/[take](chat01-take-receipt.json)。owner被正式唤醒，先canonical、固定4c首合同/独立outbox，public client入口待MainLead；不造私有HTTP客户端。默认首页真实对话/Work overview rail、conversation作为路由主键、turn.task只用于执行资源。主线明确可复用内部durable task，不可没有持久lineage拼接；queue/steer暂false，后继完整需求保持开放。


03:38共享冲突受控解除：Lead先提出等main/完整merge4e817，随后明确以其共享owner生成的三文件patch+SHA256 manifest替代。owner只abort841冲突保留合同bac6/7自有docs，核before→应用→核after→独立提交a3b9cfaaa4be4ea8b34e6135107b0401f121fbd0，管理者实际复核packages/client/src/index.ts、packages/contracts/src/index.ts、packages/client/src/conversations.test.ts after哈希全匹配。这是共享owner授权输入应用，未转移shared实现ownership，不授权Web私改接口。ACTIVE已关闭，中心module/真实模型仍未据此验证。receipt不受冲突影响。

测量窗口协调由root统一回程：Mika B01先20秒SELECT/EXPLAIN候选、硬上限120秒，结束明确回root后PERF02才开始预计约8分钟smoke与1/16/128矩阵；owner收到等待指令，功能/代码照常。Mika不能app直投本v2子agent，以root作回程，不重复探测/新建任务；同机窗口排队不改变生产功能授权。

03:39管理clean-code停点：当前body中旧“shared冲突/无writer/准备暂停”不能仅靠末尾补事实，已直接更正到a3b受控输入解除、PERF02与CHAT实际claim/canonical；两个准备目录转stub防第二事实源。CHAT c72与PERF02 c779已交ExecutionLead注册，后续一次实采再写完成。固定4c/841的接口研究与queue/draft风险保持同一证据；没有改产品或重复模型/语音调用。


## RS26 两条并行交付与后继插件输入（03:44 UTC）

PERF02候选a87f64f48a3b7e8d03429ab0673c210076a2df0d、metadatae07c34c5f98657b390e8fdc44bb2d85f9360a56d，管理者独立scope审核：相对cc334六个实现/测试文件及自有计划证据全在八scope；App/TaskThread/共享包/rootmanifest/lock与feedprojection零diff，meta实现零diff，6Markdown18链接/TODO检查零错。作者13局部/typecheck/8productionbrowser通过、1040条完整hash/maxMounted16；03:40:14.216Z root确认Mika实验结束后正式窗口开始，loadavg6.20/7.88/8.36，先smokePASS再一次1/16/128矩阵。此处是检查来源与进行中事实，不先宣称优化效果或approval；管理者不并发重跑重型测量。

两新canonical已经完整SHA/唯一worktree/planDir交主线登记；03:40:34 PERF owner实际4320仍无PERF02卡，root要求等registry批次后单次核验，无高频重复催促。领取账本可见和进度来源已聚合必须分开。

root只读X02固定4054c67cb8a58eaed167df2a82a2d51249afccdc的packages/contracts/src/plugins.ts与docs/evidence/x02/interface.md：registry首片段有register/config/grants/exact-version/operations，runtime始终unavailable，digest/license仅operator声明；configure全替换、select-version清config/grants；32KiB请求/64KiB响应/page40，历史revision与current pointer分开、默认grants空。作为REQ40后继接口研究，不能将中心记录误显示npm安装/启用/完整rollback完成。Mika写模块，ExecutionLead写公共入口，Web待稳定输入另claim；不扩大当前CHAT或P01/I01 approval。

root转主线中心2d3bb61b35318f999c9f0f336bb3f443418bb5dc已独审APPROVED（14真实PG HTTP与tsc），publicclient841已批准、main ac4e34d。管理者将此交CHAT唯一owner作provenance，保留现a3b9共享受控输入；两次真实模型聊天验收只由主Lead在三端独审后的固定main执行，本队不重复调用。capfalse仍明确禁用，中心通过不等于Web或完整CHAT需求通过。

本段clean-code：管理current正文曾留I01/PERF旧claim和“接口待交/空槽后派发”等历史语句；本次直接更新正文而非仅追加，明确六stub/七来源中两项待注册、独立scope与review边界。03:43:21.506Z CLI实核管理v2 active；无产品改动、无全库测试，首c075review不自动覆盖后续增补。

root 03:44 UTC再次核官方测量语义（时间采用工具03:44:48，纠正消息最初取整03:46）：[PerformanceEventTiming](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceEventTiming) duration按8ms量化、最低阈值16ms，wheel不在事件范围；本探针wheel→scroll→rAF单独自采，不称EventTiming或INP。[LongTask](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming)仅>=50ms，0样本不等于零延迟。[performance.memory](https://developer.mozilla.org/en-US/docs/Web/API/Performance/memory)非标准且已弃用；本报告实际采用CDP JSHeapUsedSize但没有强制GC，也不能推断retained heap或无泄漏。已将解释交PERF唯一owner，原始1/16仅root只读复核，正式结论待128和固定报告。没有新增功能或测试。


03:47来源验证完成：收到主线39源登记结果后，管理者仅一次GET4320，generatedAt2026-10-06T03:46:41.801Z。CHAT/PERF02各1 live source，绝对worktree、branch/liveGit、planDir、唯一claim v1和worker匹配，unregistered=[]；当前19activewriterclaims逐字相等/父子前缀两两0重叠（不是agent数/逻辑重复保证）。[完整关键字段与审计输入](chat-perf-source-verification.json)。CHAT human完整/issues空/target未知；PERF02 human完整但唯一parse issue缺工作分支状态，root已交owner补。证据保留真实issue不美化为全绿，纯来源注册不替代实现review。


03:50 PERF02正式闭环：rootAPPROVED a87f64f48a3b7e8d03429ab0673c210076a2df0d/basecc334/reportd891；独立13tests/源码/390双图/三场10040条expected SHA重建/raw统计，未独立重跑作者browser/typecheck/build/矩阵。管理者metadata7md39links/TODO/diffcheck及target→172d源码diff0。owner最终172d10d63179a4861cc0fbf986dec10bd0a45f10 clean并停止主动写，03:49:13.564Z实采字段齐、checks/review同a87、proof unchanged/issues空、main not-contained；[原始字段](perf02-approved-dashboard.json)，已桥主Lead局部集成。先前source采样缺字段真实保留，不改旧证据。

w01_owner后续有界只读：固定center2d3bb61/clienta3b9/outbox0d4e的确定拒绝与ACKunknown、create/turn两步receipt、原key重试和409语义，另说明新受控typed746364ea2581b8c563a09b07560de5e0b63bcab8差异；不称最新端到端、不审moving projection、不写CHAT/后端/新计划或调用模型。管理者不为满槽创造新功能或扩大已领范围。

03:51跨Lead固定事实（root转交，管理者未重跑外队）：Mika B01 after窗口03:46:01.332Z～03:46:10.218Z，8.887秒、23checks、47,496,555bytes，已清理，独立审查批准该实现/after；不推因果倍率或SLO。X02实现3d0cfc898b9e9bba1d0985d33b2eb263c2fc26ee、metadataf9d6dd2a34db78d1818876088ebf9de153a1d3b7获Mika root批准交主Lead，registered/runtime unavailable边界保持；管理者仅git rev-parse补全给定短SHA，没有另做X02 approval。GoalOwner批准CHAT typed融合d0f4f5d8abc8995b22a43879880e090bfb898024，计划在Web首独立交互preview就绪后做用户视角验收；URL/固定输入/fixture身份由CHAT owner回，49922不动，两次真实模型query仍只由主Lead执行。

03:53 w01只读ACK研究交付已合入[同一CHAT接口证据](chat-interface-research.md)，固定2d3/a3/0d4e与typed746差异、源码行号、两事务ACK恢复、unknown后重试401/403不可抹旧不确定性、malformed2xx身份校验全部明确；已交CHAT owner转实际验收，未读moving caller不先判bug。内存outbox不假称跨reload持久，固定中心注册函数不等于单commit可部署，真实模型仍主Lead统一。owner只读交付后空闲，不为填槽创建新生产工作。

03:54 CHAT唯一owner首预览http://127.0.0.1:63743/、session14932，明确HTTP fixture，作者Chrome同conversation hi/追问两轮正文/0pageerror。固定输入I01b584+a3b9+typed746，整体moving/targetUNKNOWN；root另开后台tab15，GoalOwner按约定用户视角验收，旧49922与55049不动。root和管理者跨消息同时桥接了同预览，管理者明确发生重复一次并停止额外通知。原owner继续runtimeACK/everUnknown局部约束，w01研究完待派，不为满槽创建新生产。

03:55:53 UTC root实际CUA首CHAT预览：自建后台tab15/63743，新conversation→追问→回复时保留下一个draft，浅深主题目视、执行单折叠。首次发送draft→conversation remount后焦点BODY复现两次，交唯一owner改稳定View.key；reload后新建conversation fba2…首次受理后直接typeText(null)，activeElement仍TEXTAREA/Message input且新draft完整，进行中反馈已关闭。无固定target，整体NOT_STARTED，开发截图不代production验收。另moving源码发现>16000字符本地普通Error可能吃稿，交owner验证；ACK历史unknown后403/malformed2xx约束由w01研究交owner补局部测试，不把未审整个实现提前APPROVED。

04:00跨Lead队列（root转交，待独立现场核验）：主Lead完整main候选8f1481df880cf5077e1ddb9a8f302fe700a7ece8含已审B01/PERF02/X02、未合moving CHAT App，正在推送。这里只登记候选，不据此把本树PERF02 main pending改成已集成；后续收到交付后核真实HEAD/ancestor与声明范围。

GoalOwner批准Mika X03最小只读插件管理模块，独立apps/web/src/plugin-management与专用tests/plan/evidence，不碰CHAT App.tsx或plugin-integration两接缝。固定合同/claim待Mika交root；未来固定交付后由本队唯一App owner明确受领接线，不同时写核心。X03区分中心registry与浏览器extension，没有verified binding就不合并身份，不下载/加载/授予权限，不造新API。CHAT优先不变，本队不重复实现X03；真实两query仍主Lead唯一执行，复用入口要求已交CHAT owner。

04:02主线集成确认：root04:01:30实核origin/main8f1481df880cf5077e1ddb9a8f302fe700a7ece8、a87ancestor exit0；随后Lead确认main/origin实际push clean。管理者04:01:56.630Z单次GET4320核PERF02 main ancestor/current/historicalIntegrated/scopeEqual真、dirtyScopePaths=[]、issues=[]，[证据](perf02-main-dashboard.json)。不是以review推main，也不抹03:49未集成旧采样。主Lead报42源/CHAT03/R04/P03 live，按来源记录不重复刷；w01下一固定CHAT审查唤醒时顺带canonical纯metadata，当前claim不变。

CHAT固定84242ca1d214f9a9ff369b07c13657918862f226/baseb584正式只读审查：管理者04:03:36.519Z live claim08259c1d v1 active，六commit分三个Lead原样输入bac6/a3b9/746与三个自有实现/metadata；后者全部16scope内。bac6对原4c逐文件一致，两个manifest五after哈希匹配；根lock/manifest/App依赖/旧TaskThread/TaskProjection/feed/plugins/workspace保护路径零diff。全diffcheck exit2仅原始transport.patch:36上下文空格，已要求保留raw并准确记例外；排除raw后source/docs0。[审计](chat-candidate-scope-audit.json)。w01被followup正式唤醒固定outbox/projection/messages只读审，root审组合/UI与模块，管理者scope/docs；无额外agent或重型browser派发。metadata尚待固定，尚无overall approval。

w01先完成其PERF02纯metadata b61707d20ee9803e7397f21961549deb65ceef1d clean，写前04:03:17.671Z核d36v1active，独立origin/main8f及a87ancestor exit0；3文档转录main集成，未跑产品测试，不扩大a87 approval。

固定CHAT84242模块独立review由w01给REQUEST_CHANGES/baseb584，两个P2 blocking，已直交唯一owner：

- projection.ts:232与165–171：send ACK lost→refresh取得succeeded/assistant available→后发retry服务端replay旧running/pending，较高请求seq覆盖新状态，回复消失/send禁用直到GET恢复。receipt确认与动态turn事实不能用同一“新请求即新事实”合并。既有test87–95只覆盖原lateACK低序号，不覆盖saved replay；须补公开行为回归。
- projection.ts:123–124/129/136：已读turn1→隐藏/离线时中心到revision3→refresh两次仍[1,3]、nextCursor=null、pageReads1，turn2永久缺失/无Load more；需补齐新turn或明确可加载缺口，不要求一口气预取全部历史。

reviewer读固定outbox/projection/messages与9outbox/14projection测试，2个inline只读公开接口探针确认，无文件/browser/模型/服务写入，未重复33tests/typecheck/build/11browser；探针前实现diff0，之后owner新增测试不属于该结论。正面读码事实包括sticky everUnknown、冻结双key/未知不可dismiss、ACK身份、同revision正常刷新、typed详情完整身份+正文SHA/cache与dispose隔离、正文不混telemetry。另所有4xx除特例归definite的unknown http_error是非blocking建议，缺真实代理提交后改4xx证据，不混写确认bug。

管理者固定metadata95a30be0b615030cd3abcdfbf3fd761637b42429读审：对84242 apps/shared/根依赖diff0，7Markdown37本地links/7TODO一致；验证报告正确区分33fixed后、11dev/11prod在最后接缝前、后续仅prod1/typecheck/build、真PG/模型未跑。当前父blocker实写两P2，不让scope/docs通过被误看成产品approval。

04:08管理收口：U12 root逐字转交“take工作在dashboard标清、跨lead防overlap”，已存父plan并映射既有REQ37，不造第二需求账本。独立隐藏CUA实读CHAT领取ID/version、Lead/Worker、active/writer、branch/worktree、全部16scope、来源/更新时间/接收方及唯一status；临时页已关，用户页未动。API04:07:57.845Z为42源/21activewriterclaims literal0overlap、PERF b617 clean且main8f ancestor/current/scopeEqual，唯X03新claim未登记，[证据](assignment-visibility-verification.json)。不把一次采样当永久无重叠。

正式CHAT-R1/R2已由7cbabb737f26b108275e80f1b6cd0425699f3c18窄修复；w01独立16projection tests+3公开探针（旧ACK不盖final、[1]→55且分页中到62完整补齐、新ACK后GET升级）通过，root限定整体APPROVED/baseb584。未重跑无关视觉/benchmark，原842 REQUEST_CHANGES与对应两P2保留。最后metadata待owner固定后再核，不把当前修复元数据自动改已审范围。

D05架构刷新由GoalOwner新增授权：仅fixedmain8f架构数据与必要局部可读性/来源检查、自身plan/status/review/evidence；root可只读研究，manager等CHAT交付收口及旧claim释放/正式转交，独立新tree receipt后才写。保持frontend/center/runner、Flow/外包、PG/blob/FSM边界，未交付CHAT03/X03/R04不当交付。本段clean-code检查事实所有权/当前与历史/错误边界：修正父当前阻塞到已复审关闭，留下历史两P2；D05协作旧“未有tab”改已部署待刷新；不代写其他ownerstatus。


## 04:20 增补：X03、composer与CHAT04候选

Root只读固定X03 c2发现useRead重试清data可能卸载Refresh/Next；Mika作者实际Next Enter焦点断言红后修保留控件，模块895c8999d22fb3d911de2d46969e37b40051fdea已由其root独审APPROVED（12checks），本队未写/未测Mika模块。workspace_panels_owner只读建议在现Settings新增Plugin management折叠区，展开才挂模块/读取registry；personal为首无项目上下文。4方法bound useMemo([client])只经App，session.id隔离；不按名称合并中心registry与本地runtime。拟新feature生产仅App.tsx、plugin-integration/react.tsx、integration.css（需收窄现ul/li全局样式），专用fixture/browser两测试及新三件套证据；等双方固定main及正式移交，不提前take或改代码。

w01固定CHAT7cb/metadata331与assistant-ui react0.15.23/core0.3.22只读composer插入候选：既有flow.composer.insertText和sample调用存在，session故意unsupported。最小私有registerComposer(viewId,appendText)，仅当前可见/可编辑同连接pane绑定，同步getState().text→setText追加；不暴露runtime/client/token/draft getter，不发送/取消/steer。running/isSendDisabled不等不可编辑，16k溢出整次拒绝保留draft。隐藏HTML不卸effect，必须显式eligibility。WeakMap仅保护首次authorize后已开始调用的异步跨代，不能保证尚未调用的旧UI回调在reopen后第一次执行也被拒；更强语义须UI签发代际另议。不把研究当现功能或安全漏洞。原key待确认A与新draft B+C分离，ACK不能覆写；A/Bsplit、disable/center换同ID、StrictMode与IME/undo/caret均需未来真实验收。拟四生产App/bridge两文件/ConversationThread与两专用tests，未领取，排X03实际挂载之后，不增加新agent。

CHAT04中心queue（Mika/root转交方向，尚无TS实现）：enqueue(conversationId,expectedQueueRevision,text,key)，paged queue，cancel(itemId,expectedQueueRevision,key)。queueRevision独立conversation.revision，稳定itemID/顺序/state、promoted关联真正task/turn，原key恢复unknown；普通followup不能越等待项。只succeeded自动提升，failed/cancelled/uncertain、失效pin/无knownsession冻结并说明；停当前轮不悄启下一项。首段只取消等待项，恢复/继续未启用；steering另项，需受理/送达/生效分别证明。官方SDK能力不等已接adapter；所有既有Webunsupported控件保持。


## 04:22 assistant-ui queue-only适配限制（root只读）

固定core0.3.22的`src/runtime/queue/external-thread-queue-adapter.ts` queue Interface同时要求enqueue/steer/move/edit/remove，callbacks是void，queue item仅id/prompt/parts，没有中心ACK/blocked/status。`external-store-thread-runtime-core.ts` 704–714只要有queue adapter，普通tail append都走adapter而不再onNew；message.steer未指定且isRunning=true默认走steer，305按adapter存在宣布queue能力。不可机械接createMessageQueue或noop不支持的steer/move/edit冒充成功。CHAT04 queue-only应使用明确排队入口/呈现或严格拒绝路径，按冻结合同再选；按钮/Enter/快捷键同语义，pending/unknown receipt单列，中心仍权威提升顺序/取消阻塞/revision/幂等，库items不是PG事实。root仅本地固定库只读，0模型/执行/改动；当前unsupported按钮不改。

U11执行配置消费候选已收到w01固定dd1只读报告，完整[研究](execution-profiles-research.md)。核心为整份runner不可变profile选择、create即pin、false控件不造组合、requested/profile声明/runnerRequested/effective四层分开；unknown ACK固定reference与key，不以新选择重试。后继先X03 App挂载，配置选择尚未take/实现，无模型。


### CHAT04首合同已固定（待实现/独审）

Mika/root交候选e423abb5f404334b4bb781de1fe1a429278762d4，claim3be53dee-08c2-4c88-85ee-a29781842223 v1，canonical conversation-queue/docs/evidence/chat04/interface.md。管理读时该树已出现后续实施dirty，故以git show固定SHA重读interface/合同，不沿用先前clean声称当前仍clean，也不评审moving实现。候选commands/reads/promotion显式stub、生产未批准。公共barrel/client/迁移接线仍Lead唯一writer。

固定合同：POST queue `{expectedQueueRevision,text}`→202 receipt、GET waiting页after稳定sequence/default20/max50、GET item有界全文、POST item/cancel `{expectedQueueRevision}`。两个命令需幂等key；旧receipt的queueRevision/item不可当最新状态。preview≤512 UTF8 bytes/text≤16000/waiting≤100。promoted绑定task/turn/turnNumber；取消已promoted返回already-promoted而不撤回。root额外澄清（固定首文档尚未显式写、后续接口文本已补）：list只waiting含blocked，after不是feed，queueRevision变化从头重读；promoted/cancelled从readItem/receipt恢复。只succeeded+knownsession+有效pin提升，failed/cancelled/uncertain冻结。缺steer/edit/reorder/resume明确不支持。Web队列接线继续待完整实现/公共client/独审，不以stub签名开放按钮。


## 04:34 队列语义变更与独立配置模块

w01完整固定e423/Core0.3.22研究及root新pause/currentTurn竞态已归[同一队列证据](chat-queue-research.md)。GoalOwner决定PG持久pause/明确continue，未来先pause ACK再对commit快照active task取消，结果分别显示；这覆盖未来方案而非改写旧e423缺接口的历史。新v2尚待冻结，Mika v1短SHA6fc9df4/3347e7a仅进展来源，不等Web可启用，现无queue writer。

PROFILE01按GoalOwner细化只做新选择模块+pure creation/pin helpers与局部测试，不转交现ConversationThread/projection/outbox/App。w01已给7新文件+plan/evidence两目录精确9scope，04:33 live账本无literal冲突。锁定显示采用creation+reason（created/receipt-pending），不要求未知ACK已有conversation summary。实际App消费由后继唯一owner受领，不称模块交付即U11完成。

root固定dd1只读的低优先REQ22/23候选：slot允许的context与command.contexts可能完全无交集，现ExtensionSlot实际点击才经host拒绝；没有已确认builtin故障。未来可静态拒绝无交集组合，按当前context给不可用理由，渲染不activate，执行前与async load后仍重新authorize；不引任意表达式DSL、不改权限。参考[VS Code contribution points](https://code.visualstudio.com/api/references/contribution-points)的menu when与command enablement区别及[activation events](https://code.visualstudio.com/api/references/activation-events)。未来验证global/task/composer、非法组合、键盘理由与直接execute拒绝；排profile/queue/X03后，不新take或阻断当前功能。


04:39 X03I01固定84acdcaaa9687a4ca75ebdb40a6efc7e5539029a/base4e已获root限定APPROVED，无blocking；root独立核开发8/生产7报告五源码hash，不冒充重跑作者typecheck/build/模型/DB。管理者固定diff审10路径全在a104v1七scope、保护shared/Mika模块/plugins/conversations/session/官方Thread/依赖零diff、diffcheck0。owner仅收metadata和一次自身dashboard，后续scope/docs局部复核不重复产品检查。

SVC01首连候选由GoalOwner经root报告：真实Web61228/center61227/main75a33dec短SHA，用户tab5仅预填center而未认证，0任务/模型。只说服务已运行，不说可直接聊天；root只读研究首连说明与安全本机取凭据流程，协调Lead/SVC owner。没有本队token读取/注入URL或localStorage、弱鉴权、App抢写或服务重启。完整main SHA/后续认证结论待责任owner给出，不猜测。


## 04:41 首连说明候选（root固定源码研究）

固定main75a33dec228e17bbbd0d3be9fd01bc9ac18a0133，App Connection:879/897的URL本来可空；vite.config.ts通过FLOW_CENTER_URL代理/api，所以本机用户无需手填61227。现Same-origin proxy占位不够清晰，未来最小Web说明应解释留空连本地、另一个中心才填URL；onConnect只是构造client，不表示已认证。ownerToken只由本机操作方读取私有配置的单字段，不粘整配置或发聊天。root没有读取真实配置/凭据、没执行剪贴板/连接。

SVC README/cli当前status可输出credentialsFile而不输出token。后继copy-owner-token CLI只能由SVC owner领取实施：校目录/0600/持有身份，仅用户显式调用后复制该字段到本机剪贴板，stdout/URL/日志/前端env都不含token，不创建匿名HTTP读凭据入口。这里只登记可用性候选与保护边界，不宣称工具已存在，不扩大本队X03/PROFILE范围。真正首连尚待用户认证，不把服务运行等于可直接聊天。


root本段clean-code安全停点（正式X03审查04:36:39）：核bound reader窄接口、RegistryManagement懒载职责、卸载过期响应、局部错误与CSS边界及作者8/7行为证据。实际修复是owner探针发现import失败被浏览器缓存、Retry无效，改诚实手动reload说明，root补未发送draft先保留提示；无未解决blocking。后继CHAT04能力迁移/同revision动态事实与SVC首连仅研究、0凭据读取，无跨scope实现；不重复产品测试，不写released D06。

管理工具实钟04:42:44 UTC，前一快照新授权段落写04:43系分钟估记，已改04:42；正式claim receipt、测试和原始采样时钟不改。后续派工时间以工具/PG receipt为准。


root新增dashboard性能候选：两次51sources只读/api/snapshot工具elapsed约2.67/2.73s，非benchmark。aggregate同task在实现与approved review同target时重复compareImplementation，proof每次spawn多条git；server已有in-flight请求合并，无跨请求cache，可见页面20s刷新。候选单snapshot同(worktree,target,head,literal scopes)复用proof Promise，跨snapshot保持dirty/claim新鲜；不同target必须独立验证。进一步有界Git并发先测进程/延时再选。已列协作WPF-D01-07；无新D07树/take/生产修改，不抢scope。D06已release不能续写。

## 04:57 后继公平测量与首连帮助授权

D07准备：root04:53:48.691Z因registry提交eef40cf读取54源snapshot，工具约1.35秒；此前51源2.67/2.73秒受现场负载影响，不据这三点宣称产品卡顿或优化幅度。下一小片只以可复现临时Git样本的调用计数和输出语义保持为主，精确target/dirty/unknown/main证明与跨snapshot新鲜度均保留；没有跨请求TTL、并发限流或全局重构授权。w01只读准备最窄scope，管理04:55 live账本未见aggregate/proof占用，git ls-remote独立确认已发布main e802854f346a81749efdef3f36737b16141b98ef；尚未新take或写dashboard，后续必须freshledger和正式receipt。

GoalOwner明确授权首连帮助小UX，沿既有U11/SVC候选，不新重复计划：空地址连接当前部署中心、远端填管理员提供地址、说明owner token用途及向中心管理员/本机受保护配置取得；复用适当现启动文档链接。产品UI不显示secret、不自动复制、不加匿名token端点；0query验证文案可读性，不新服务/代理。原App owner另领精确scope，排PROFILEI01/queue窗口，不能抢App或阻模块集成。root曾提copy-owner-token仅SVC owner CLI候选，不等于授权执行读取真实凭据。

05:00 名称纠正与方法冻结：此前D07只是我队proof性能候选临时代称，主线已用D07作human下一交付筛选，正式新片改WPF-DPERF01，不能重用编号。首片仅同task/同snapshot/review.target等于implementation.target时直接复用既有compare结果；tree/main dirty重复只留后继假设，不建通用缓存接口。root已核官方[Git Trace2](https://git-scm.com/docs/api-trace2)，可对子进程设置临时GIT_TRACE2_EVENT记录start argv统计真实调用，不改全局Git配置/公开proof接口/真实凭据命令。owner独立新698树、4scope receipt已受领，事实与counter结果由其canonical单写。

05:02 派工时序纠正：DPERF新take后管理者首次使用send_message时worker已completed，消息只入邮箱未启动。root通过actual list_agents发现HEAD仍698 clean/无canonical；管理者改用followup_task携完整bb7ef22fv1 receipt/四scope正式唤醒，明确直接开工。此前仅宣称领取与等待canonical，没有伪造source/实现。以后completed/idle统一followup，running才send_message；不新增agent绕过队列。

## 05:06 证明复用固定候选与范围外基线失败

WPF-DPERF01实现5cd7f00dbe091785b2b7be9cb2b03d33f2af8c52/base698：仅aggregate六行和新proof-snapshot.test.mjs，proof.mjs/registry/human不变。root05:06:23限定APPROVED，独立4新tests PASS/2790ms、单task同snapshot同target24个Git start/1次comparison；作者原29/2基线由root读日志核，未冒充root重跑前测或生产速度幅度。不同target仍单独调用，缺失/unknown不借成功值，跨snapshot重新观察。

作者关联26项25PASS/1FAIL，根因固定698的human-proof.test.mjs:115–116硬编码registry.tasks.length=28，而固定输入实际54源。管理只读git show698核断言，并核当前test/registry对698零diff；root也独立核两文件不变。本feature不改旧test或registry、不删断言、不把完整套件称绿；原red/direct/related日志由owner保留，主线原owner协调后继修复。该已确认旧失败不变成新增产品结论或借口越scope。

PROFILEI01作者已完成60项局部检查（34projection/10outbox/16模块），首strict helper调用形状错误17fail已修且原log保留；真实App HTTPfixture51832/session68857浏览器验证进行中，0模型/DB。只有作者进行中来源，不作为固定候选独立审批。

## 后继可信消息内容renderer候选（root只读，归既有WPF-001-05/X01）

当前main插件ContributionDeclaration只有button/menu/panel/theme，host.contribute只允许panel；ConversationThread直接makeAssistantDataUI注册内建flow-reply-detail，14slots不等完整消息内容renderer扩展。root通过本地assistant-ui技能、官方[Tool Rendering](https://www.assistant-ui.com/docs/api-reference/tools/rendering)/[Message](https://www.assistant-ui.com/docs/primitives/message)与已装react0.15.23/core0.3.22核实：useAssistantDataUI挂载注册卸载撤销；DataRenderers同name数组取首个，无renderer返回null，不能依mount顺序处理插件冲突。

后继仅可信data-renderer窄接缝：专属type/name及schema/version，确定性冲突拒绝，保留Flow命名空间；窄只读payload和已有授权commands，失败/disable/unknown escaped有界fallback不丢正文，不让renderer激活触发模型tool执行、不改中心DTO或凭据，不宣称same-realm隔离。先迁移一个已有data part，验官方Thread插拔、split两provider/disable重启/异常/未知版/0额外detail。候选待PROFILE/queue窗口后正式take，完整第三方隔离/npm生命周期仍Main/Mika，不另造全栈计划或立即生产scope。

K01引用研究依赖来自Mika经root预告：GoalOwner已批准其独立take，未触Web/Thread/host。拟KnowledgeCitation={projectId,sourceId,version,contentDigest,locator:{kind:'utf8-bytes',start,end}}，不可变版本正文、UTF8半开有界范围，resolve显式isCurrent/currentVersion；首片owner-only项目内文本/词法，不扩runner/MCP授权，暂不发中心消息renderer DTO。等待正式contracts commit与Lead统一export/client；当前仅接口预告，不写成类型已存在，不造私有Web协议。可作为后继可信renderer引用场景，已有flow-reply-detail迁移也仍是候选。

PROFILEUX组合边界：root已审PROFILEI01测试使用region `Locked execution profile`及`Creation receipt pending`/`Conversation profile locked`/`Unpinned legacy default`；已交UX唯一owner保留产品含义/稳定入口，details闭合不另建pin状态。后续组合只验证受影响摘要/草稿/焦点旅程，不机械重跑原18组。

05:19 管理clean-code复核：本段只审PROFILEUX职责/接口保持、文档当前与历史时态、owner scope与release；24paths无越界，raw日志保留且fixed检查不冒称全metadata绿。按本地find-skills方法复用已安装find-skills/clean-code（路径/来源基线同既有quality），无新安装、无产品测试。已正式followup同worker有界只读renderer proposal：固定main接口、实际assistant-ui注册生命周期、单个flow-reply-detail例子与模块/将来App接线分离，Flow namespace确定性冲突拒绝；不取新claim/写产品、不扩X01/K01。

## 05:20 固定14c61可信data-renderer一页候选（w01只读收口）

来源为worker固定main/origin `14c61b4062f8040ba6c7239860929366e5bd3fc1` 的git-show及实际安装react0.15.23/core0.3.22；0项目写、0测试、0模型、未建树/take。`conversations/messages.ts:6–11`只为truncated reply生成`flow-reply-detail`/`{turnId}`；`ConversationThread.tsx:14–26,84–92`直接注册并每chat独立provider；`projection.ts:29–35,274–298`已有完整身份cache、显式load、digest核验与dispose。P01只声明button/menu/panel/theme，host已有ID冲突/原子activation/cleanup；不将现有slot数冒充renderer协议。

最窄建议是新独立registry/provider Bridge/现有flow-reply-detail builtin模块：可信声明ownerId/name/version/parse先整批校验，保留`flow.*`、`flow-*`、`flow-reply-detail`，不靠注册顺序择胜；同名冲突确定性拒绝与诊断。旧无显式version的唯一保留名字按legacy v1处理，strict `{turnId}`再由App窄port核conversation/message/turn归属。未知版/schema不给load句柄，parse/render异常和disable由App-owned有界逃逸fallback保留正文与显式Read full reply，权限与projection缓存不变。注册/主题/enable/disable/切pane均0detail，用户点击才1、flight去重与cache复用；不扩中心DTO、不触模型tool、不给aui/client/token或宣称同realm隔离。

官方[AssistantRuntimeProvider](https://www.assistant-ui.com/docs/api-reference/context-providers/assistant-runtime-provider)说明provider职责；精确行为以安装源码为准：core `src/react/model-context/makeAssistantDataUI.ts:24–32`生成注册组件、`useAssistantDataUI.ts:19–24`Effect注册/cleanup；`client/DataRenderers.ts:21–45`同name追加数组且cleanup删除所有同render引用；`primitives/message/MessageParts.ts:363–383`取`[0]`或fallback；`AssistantRuntimeProvider.tsx:28–60`与`RuntimeAdapter.ts:47–53`涉及本地scope/parent继承。故每provider一个稳定且独有注册函数；共享仅immutable声明/host状态，pane本地port和aui注册隔离，单pane清理不能撤另pane。将来显式aui继承须重核，不能依上游先到优先隐式解冲突。

候选模块八literal范围：`apps/web/src/data-renderers/{registry.ts,react.tsx,flow-reply-detail.tsx}`、三个专用test/fixture文件与独立plan/evidence（具体路径须未来正式冻结）；App接线另片预计ConversationThread/session/react，messages只有将来显式version才需。最小验收为冲突顺序反转/namespace、未知version/schema、throw/loadfail/disable、split独立provider/StrictMode/close/换中心、detail0→1→cache、wrongturn拒绝/draft保持/键盘双主题390。此时没有实现/行为通过结论，不另造全栈计划。

领取纠正：worker清单原据约05:17的CLI历史采样，不是当前权。05:18:50 PROFILEI01 7f1v2已released，05:19:27 CHAT082v5移出officialThread，05:19:31 QUEUE01 b4ea85d0v1已领ConversationThread/projection/officialThread等13scope；未来renderer接线必须再核fresh ledger并与QUEUE01唯一writer正式转交。P01/I01其余旧claim仅保留历史观察，不作为将来写权。

05:22 GoalOwner变更下一只读优先级：renderer proposal收口仅候选，未take/写实现。已followup同w01 owner只读现有D05/D06权威图源、latest发布main与freshclaims，准备最小刷新scope（页面上部明确固定快照SHA/核验时间），由root一次桥Lead协调原路径转交后才新feature。不建平行架构事实源、不整页重构；main已含为代码事实，K01/O05未main只planned，runtime验收单列。当前QUEUE01唯一worker优先正常实施。

架构只读proposal固定14c61（研究启动时main/origin clean）：候选只写原architecture-data.js/architecture.js/architecture.test.mjs与原D06plan/evidence，renderer用现有heading p显示同一个baseline的短SHA链接、真实源码verifiedAt及非实时拓扑提示，不写index/CSS/registry。worker05:21账本历史D06v2released、D05v3active但不占五项，正式新take仍必需。14c已含R04停机、P03传输、CHAT/profile/queue领域与只读plugin管理；queue Web操作未完成，FSM/PG/blob和外部SDK边界继续精确保留。研究结束时main已前进eb14991a170b72d7d974428b2e440e1faada2c1e，不把O05倒灌固定14c；正式刷新若选择eb，须明示base并重新核新增域。O04是native goal runs，goal-graph-proposals属于O05，编号与功能不得混写。此段0写产品/0测试/0服务。

来源纠正归因：root曾用动态cwd读取index.ts，将新goal-graph-proposals误归固定14c/O04；w01以git show固定14c证实目录不存在且迁移仅至013，root独立核当前HEAD已eb14991 clean后撤回原claim。此错误不作为图源、不改已审旧D06，后继严格git show固定SHA。原D06唯一source迁移/newbase请求已由root一次桥Lead（拟dashboard-architecture-current/codex/dashboard-architecture-current），未确认前不take；这是证据质量/clean-code安全停点的真实发现与纠正。

05:25 root发现父plan当前REQ44和U11段仍残留早期pause ACK直接选task/v2待冻结，属于实际文档质量finding。管理已修当前工程验收并明确历史时点，保留用户原话/当前14c公共合同与QUEUE01单源，不用末尾追加掩盖正文矛盾。当前fresh GET/单独取消/两receipt/sameRevision规则与owner方案一致；纯文档局部核验，不重复产品测试。

## 未变会话轮询的引用稳定性：固定源码内存探针（root约05:30）

root在已释放PROFILEI树只读运行内存20turn相同GET探针，预先核 `eb14991a170b72d7d974428b2e440e1faada2c1e` 与该树HEAD的 `conversations/projection.ts` / `messages.ts` 两文件diff0。结果无error：各turn对象same=true、turns数组same=false、snapshot same=false；一次未变refresh通知1次，conversationMessages新建40/40消息对象，detail请求0。这是公共内存路径观察，非浏览器timing/卡顿/内存泄漏或模型容量结论；0项目写、0模型，未触已释放scope。

归RS08稳定引用/窄订阅后继候选：QUEUE01集成后独立测真实render，再决定是否保持未变message数组/对象；同revision仍可异步reply/status变化，禁止以revision缓存丢动态事实。当前QUEUE writer独占，不为此另take、不抢实施、不加状态框架；代码与行为证据由root观察，不冒称管理者复跑。

## K02上下文后继预警（未冻结，不是现存finding）

GoalOwner转Mika：已批准设计conversation/queue optional immutable projectId、KnowledgeCitation context≤4/8KiB，尚未take/contractfreeze。未来existing creationFields与assertCreationReceiptMatches显式投影可能遗漏新projectId，应在正式presence/identity语义和exact合同SHA到达后安排最小reader/receipt兼容；root尚未实证未来回执失败，不写成已发生bug。正文只给授权claim执行副本及按需detail，公共task/turn/queue/SSE首读不含正文。保持QUEUE01/D06当前scope，context选择UI另片，不私造K01/K02引用DTO或抢写当前字段。

RS08同一后继面补静态证据：root固定eb查看ConversationThread的`convertMessage: message => message`每render新函数；实际core0.3.22 `external-store-thread-runtime-core.ts:360–370`函数身份变化重建converter，因此即使messages稳定也可能失去复用。与20turn内存探针同一候选，非实际浏览器延迟结论。root重查官方[External store](https://www.assistant-ui.com/docs/runtimes/custom/external-store)稳定converter示例与缓存说明，行为仍以安装源码为准；先量真实render，QUEUE释放后再正式规划，不按revision省略动态reply/task事实，不新增任务或当前写权。

## 05:41 已安装composer受控发送只读澄清

root/w01只读实际react0.15.23/core0.3.22源码：在当前无SDK queue adapter、无voice的路径，显式排队调用 `send({startRun:false})` 保留官方canSend、草稿分离、附件准备、dispatch/send事件与onNew，跳过默认user新run触发的client-tool abort。按钮submit与普通Enter必须走同一form override；普通follow-up仍原primitive，IME/ShiftEnter/defaultPrevented不绕过，steer显式unsupported。publicsend返回void，isSubmitting只表示附件准备，不能充当HTTP ACK门禁；Flow同步inflight/unknown与冻结receipt仍权威。若以后启用SDK `_store.queue`，running默认steer分派会改变该结论，须重核。此次0项目写/测试/浏览器/模型，非moving QUEUE实现批准。

05:40:26.108Z管理freshledger更新早期K02未take历史：Mika K02 claim347d4777-d430-4f06-8cba-ed8b180f2ba9 v1现active，范围是后台context/queue/conversation与shared合同；此领取事实不表示合同冻结/独审/可部署。renderer仍既有八新scope候选无literal冲突，完整X01 npm/第三方隔离属主线，不因空闲就另造全栈计划；固定接口/base建议回root再协调。

## 05:42 renderer readiness建议收口（仍未take）

w01固定main/origin `fb906cb42391971a8b315dbd813f7633927d7265` 建议为新模块base；正式派发若换base须明示。八literal为data-renderers/registry.ts、react.tsx、flow-reply-detail.tsx，test/data-renderers.test.ts、data-renderers.browser.ts、data-renderers.fixture.tsx，以及plans/wpf-renderer01-data-renderers、docs/evidence/wpf-renderer01（源码与test均apps/web前缀）。均新路径，05:40 freshledger无相交，未建树/领取/实现。优先级低于QUEUE及K02正式reader合同，已交root统一协调Lead。

接口建议为静态可信catalog(ownerId/name/version/parse)整批校验+受控registry snapshot/subscribe/resolve/attach Disposable，现PluginHost.list/subscribe/activate只作lifecycle窄输入，attach由context.own/signal回收；不新增manifest kind/公共DTO。每provider一个稳定且独有的注册Bridge，pane只传message绑定资源及reply port；现flow-reply-detail仅此保留名接受无version legacy v1，strict turnId再核message/turn/task，port仅getSnapshot/subscribe/read()，不接受任意detail/task参数。未知版/schema不发load，合法builtin禁用保留App-owned安全显式详情fallback。App接线另需ConversationThread/session/react正式受领，现QUEUE写界不可抢。此独立可信展示模块不关闭完整X01 npm/第三方隔离/CLI生命周期。

## 05:43 K02首DTO候选（仍非生产ready）

root转Mika固定 `1eefebd5dca8f74bbefaf260a106e0e540e7fcf1` / basefb906；管理已git show核 `docs/evidence/k02/interface.md` 和 `packages/contracts/src/conversation-context.ts`。精确候选名为creation.projectId?（创建后不可变）、turn/enqueue.knowledge?:KnowledgeCitation[]（最多4且不重复）、capabilities.knowledgeContext?:boolean（旧缺省false）、turn/queue.context?仅元数据。此前泛称context:boolean只作草案历史，不映射成冻结字段。route仍501/原creation-turn schema尚未挂、NOT_RUN，不因首DTO或take称产品ready。

公共context仅id、contextDigest、executionInputId/executionInputDigest、templateVersion及有界sources metadata；详情owner鉴权双ID按需，最大JSON65536B，原citation冻结文本合计8192UTF8B；执行编译输入另核16000UTF16/49152UTF8B，现queue原输入16000UTF8B继续保留。旧task.snapshot.prompt/user_text不改，runner只在授权assignment副本获得私有输入。具体reader/pin校验由原panels槽只读准备，待实装/Lead固定输入再受领，不抢QUEUE范围。

composer精确安装源码补充：core0.3.22 `runtime/interfaces/composer-runtime-core.ts:67–71`、`runtime/api/composer-runtime.ts:221–225,345–349`说明SendOptions/send:void；`runtime/base/base-composer-runtime-core.ts:302–357,458–479,564–573`为草稿/附件/dispatch/错误恢复；`runtimes/external-store/external-store-thread-runtime-core.ts:702–714,724–742`先SDKqueue分派再默认user-run客户端tool abort/onNew。react0.15.23 ComposerRoot:99–104,131、ComposerInput:251–272,395为用户handler先行和preventDefault；ComposerSend:11–15/core primitive-predicates:13–17为running门禁。这里只保证startRun:false跳过该append自动abort，不泛称所有工具lifetime不受影响；无额外测试/产品批准。

### K02薄reader候选：固定1eef的消费接缝（panels只读，未take）

唯一QUEUE owner按固定309读到 `conversations/projection.ts:46–48` 的creationFields用于assertSummary/snapshot/page与creation冻结，显式字段未包含未来projectId；`execution-profiles/selection.ts`的receipt比较也显式枚举且未含该未来字段。当前1eef公共schema还未接入，所以这是预防未来合同丢身份/单边错拒风险，不是已部署故障。待实装固定后两处按正式presence/identity语义同改；旧缺失不得静默补personal，绑定project不可变。

最小后继候选为projection.ts、execution-profiles/selection.ts及直接projection/profile/outbox/queue四test，自己的plans/wpf-k02-compatibility与docs/evidence/wpf-k02-compatibility（拟名）。owner05:43:48 ledger观察QUEUE仍占projection及两相关test，其他候选当时无writer；此历史观察不授写权，必须QUEUE交付后freshledger/CAS再take。App/Thread/messages/queue生产模块不需为薄reader变化，0UI开放/0context detail GET。

必要验收：旧缺字段plain发送/queue字节保持且0detail；capability缺省false、合法bool读入/非法类型拒绝；project有无/同值/错值/意外新增/漏值在CREATE ACK、snapshot/page一致校验，错ACK为unknown且不续发；context元数据在页/详情保留但不映user/assistant正文；原key/body/pin/project重试与新draft分离、unknown后401不清、跨连接同ID隔离。未来knowledge发送另需typed input透传+深冻结citation/locator，不重取最新版或换key；薄reader不声称已支持引用发送，也不为digest预取冻结正文。panels本次0写/测试/模型，复用本地find-skills/codebase-design/clean-code，设计只在已有身份边界集中校验，无第二DTO/client/状态源。

本段 O07执行配置接口风险预告（root固定源码只读，非Web实现）：Lead给native graph内部access字面量`goal-graph-tools`，完整源target `f95c8eb9e8fc7d29d788fe22a6fd8b7dff098be5`；root核固定fb906 selection.ts的ChatAccess/isChatAccess及configuredSelection仍严格只允许none/configured-readonly。新增内部字面量或unknown目录项可见但不可选，不能因共享合同增加自动开放普通chat。O07尚未独审/无Web入口，本次无修改测试模型；后继K02 receipt薄reader必须保留该allowlist，不扩新Webscope。

## K02固定736实装合同与薄reader范围核对

管理与panels均严格git show `7368497ade6b80725e024d86541b87c971389476` / basefb906，未消费owner现场dirty。`conversations.ts:19,27,40,116`已含projectId:idSchema.optional、turn.knowledge、capabilities.knowledgeContext?、turn.context?；`conversation-queue.ts:11,28`含enqueue.knowledge与item.context。context selection最多4、禁止exact重复但无min，[]合法；idSchema是1..128字符而非UUID。server state无project时省略、不发null。此版本interface明确详情/发送/claim首片已实装，queue/retry仍实施，旧1eef的501边界仅历史，不据该片声称整体批准。

原八scope候选不扩：生产conversations/projection.ts、execution-profiles/selection.ts，tests conversation-projection.test.ts、execution-profiles.test.ts、conversation-outbox.test.ts、conversation-queue.test.ts，以及自己的plan/evidence目录。固定309 projection creationFields:46–48及selection receipt实际值:81–89都显式遗漏未来project；新schema后只修一侧会错拒合法值，两侧都漏会漏验绑定改变，因此按正式presence/identity一起修改。outbox parse+spread已保留scalar，无需改生产outbox。保留none/configured-readonly聊天allowlist，不被O07内部模式扩权。

必要回归：project有无与GET/page一致；P→Q、有→无、无→有、null/empty拒；合法CREATE ACK才继续唯一turn，wrong/missing/unexpected project保持unknown/0turn；原key/payload/pin/project重试、新draft分离；cap缺失false、有效bool可读但不开放UI，非bool拒；有无context metadata原样保留且不进user/assistant正文、不自动context GET。旧plain enqueue/turn请求无knowledge字段。knowledge写入与引用选择/深冻citation属于后继，薄reader不声称支持引用发送、不预取冻结正文重算digest。

原panels仅只读查scope/固定源码/设计，0文件写/测试/模型/新tree。主Lead正在协调准确受控base/shared输入；QUEUE main receipt与旧路径停写/CAS移权在新take之前，不能用历史无冲突观察或同owner身份跨树写。

### U11/REQ43真实过程反馈的最小现有合同（root只读）

root固定fb906核ConversationTurn已有task id/title/status/verificationStatus/updatedAt和telemetry，首段可在turn旁稳定折叠Execution activity，初始0新增detail/events；用户展开再用现FlowClient.events(taskId,after)分页持久reference(id/title)，单项展开才conversationDetail(conversationId,turnId,detailId)，后台queries已有双ID/task归属校验。不要求先跳task页。

这不提供typed tool状态：Reference只有id/title，runnerEvent union无tool/thinking，固定claude循环仅init/result。不能从标题或task总成功推单工具完成，未提供thinking不造。清晰工具状态后继需要native→持久typed activity reference及tool identity/phase/终态证据/detail ref；真正partial另需message+block identity、delta去重与重连cursor。GO对SDK0.3.290的includePartialMessages/tool_progress/tool_result能力研究与root当前代码未使用的事实分别归因；content_block_stop只表明输入参数生成结束，不是tool完成。0项目写/测试/模型，不新建重复计划或挤占renderer/K02范围。

## 05:59 固定候选交接与窄屏后继观察

K02受控输入e9a0259151fcb215e1bd607b5461d81412da2742来自Lead736三contracts原样patch，SHA/before/after管理与root各自独立一致；该输入不代表后台批准。作者固定763与renderer固定747的范围、源码hash、链接/解析已由管理核查，产品行为独审归root，不以文档绿替代行为。原日志/patch空白保留，不把fullmetadata diffcheck声称0。

GO观察、root转述的[synthetic窄屏图](/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-shared-foundation/docs/evidence/f01/queue-live-preflight/second-reply-dark-narrow.png)显示底部两处Execution details与Requested runner-default/Read-only/Thinking off/Unpinned legacy、Continue this conversation和多行说明占用聊天高度。后继U11整合单一折叠执行入口，默认只留用户需要选择的model/access/queue状态；真实unsupported、未知回执和简短fixture身份仍明确。管理未重拍或将此升级当前阻断；原REQ43正文/过程优先保持，既有typed tool状态缺口不被文案伪补。

## CHAT05初合同依赖（固定ae4，未当产品完成）

管理实际git show `ae4cc5c630b88616fe75c72eff9fc276a9f84f6c:docs/evidence/chat05/interface.md`，与root研究对齐：typed task list只含轻metadata，body另lazy activity detail；phase是不可变观察，status是最近观察到的工具状态，停止/uncertain后未解析为unknown。input-ready不等success，SDK tool_result也不等外部副作用独立验证。timeline reference新增可选activity身份须后端HTTP验证保留，旧detail fallback仍读得懂。body UTF8有界64KiB、truncated/originalBytes/full原文sha分清；不保存signature/redacted、不造缺失thinking，unsupported只类型。首段忽略SDK partial，不把assistant-text activity冒充最终reply。该初interface的PG/adapter/client/index尚未全部冻结，Web不先接未审shared，不新增scope；沿REQ43后继依赖，待完整固定输入与公开client再消费。

Root补充固定main3d官方Thread接缝：MessageActions位于hideWhenRunning/autohide的ActionBar内，运行中活动入口不能借此槽。后继独立始终可见的message footer/activity入口须由唯一Thread writer另领；pending turn只有真实user message，不生成伪assistant tool/thinking消息。独立模块先TaskSummary+host-bound lazy port；未来typed活动须Reference.activity明确身份，不按标题猜。官方[工具显示注册](https://www.assistant-ui.com/docs/api-reference/tools/rendering)与[Message primitives](https://www.assistant-ui.com/docs/primitives/message)由root本段核，实装仍以0.15.x固定源码为准；显示注册不赋予工具执行能力。本管理记录root只读证据，未浏览/运行/修改该Thread。

## 06:02 后继只读设计停点（没有新领取）

w01根据固定main3d4985与已审renderer747/final7ff给WPF-RENDERERI01候选：新web-data-renderer-integration/codex/web-data-renderer-integration，准确实现base等Lead包含已审输入。八literal为`apps/web/src/conversations/ConversationThread.tsx`、`apps/web/src/plugin-integration/session.ts`、`apps/web/src/plugin-integration/react.tsx`、新`apps/web/src/plugin-integration/data-renderers.ts`、新`apps/web/test/data-renderer-integration.test.ts`/`apps/web/test/data-renderer-integration.browser.ts`、`plans/wpf-renderer-i01-integration`、`docs/evidence/wpf-renderer-i01`。不写App/officialThread/projection/selection/outbox/messages/queue/P01。05:59:55.298Z作者只读ledger唯一相交为CHAT082v5的session.ts，未来必须旧owner明确停写→freshversion CAS→新take；K02C01仍持projection/selection等六实现文件，不能借接线修改。

session持唯一registry/connection AbortSignal，现有私有SessionContext供官方provider内bridge与ReplyBindings，不重新传全client/token。新纯adapter绑定session/view/conversation/message/turn/task/replyDetailKey，read只bound projection.loadReply；首次真实truncated part可以经P01 registered→activate，disabled保持原状态。ConversationThread只替旧局部ReplyContext注册，queue/profile发送、暂停语义保持。实际App长回复0→1→cache、split/Activity/draft、Extensions启停fallback、同ID中心迟到与局部wrongidentity验收；准确base与take前不建树/写入。

panels给原REQ43独立活动模块候选八literal：`apps/web/src/conversation-activity/projection.ts`/`ConversationActivity.tsx`/`activity.css`、`apps/web/test/conversation-activity.test.ts`/`conversation-activity.fixture.ts`/`conversation-activity.browser.ts`、`plans/wpf-activity01`、`docs/evidence/wpf-activity01`。新树候选web-conversation-activity/codex/web-conversation-activity，全新路径但未take。scope输入connection/view/conversation/turn/task与真实TaskSummary；只读bound port readEvents/readDetail，UI不再造第二Execution折叠。初始0events/0detail，用户展开读取现有轻timeline、显式分页/refresh，reference二次展开0→1→cache；不按title猜tool/thinking，不把终态当verification通过，无新增SSE/interval。

作者实际读到FlowClient.events目前无AbortSignal，因此只能generation/lifetime丢弃迟到，不能声称collapse取消底层HTTP；detail可用signal。缓存含上述身份与已读reference，未读页id拒读；reset清缓存、错误保留旧页/stale。测试候选涵盖分页/reset、401/离线、collapse/换中心、键盘/390与0模型。真实App接线后继由唯一Thread writer在renderer后领取always-visible footer，不用hideWhenRunning ActionBar；pending只真实user message。CHAT05 ae4仍初interface，模块候选不消费未冻结client/typed活动，也不声称已解决窄屏整合。两proposal已交root作优先级/接口协调，未建树、未take、未运行验证。

06:04 renderer接线寿命补充（w01固定3d只读）：App关闭conversation仍setVisible(false)并保留projection/views缓存，hasDraft不能作pane活跃许可。拟宿主adapter拥有display lease代际，Activity cleanup失效/abort旧port、resume新代际，稳定ReplyBindings与纯disclosure保留，projection cache仍权威；旧port捕获代际不能hide→show复活。session.dispose在host异步清理前同步closed/abort。按真实message/turn/task/detail身份允许非focused split A/B各自读，嫁接身份0GET；禁用后restore不偷偷activate。只管理UI绑定寿命，不新建授权/enable权威，仍原八scope候选、未实施。

Root本段实际官方资料核对来源：[assistant-ui导航](https://www.assistant-ui.com/llms.txt)、[data/tool显示注册](https://www.assistant-ui.com/docs/api-reference/tools/rendering)、[Message primitives](https://www.assistant-ui.com/docs/api-reference/primitives/message)、[Claude SDK streaming output](https://code.claude.com/docs/en/agent-sdk/streaming-output)。采用边界仅显示注册不赋执行权限、block结束不等工具执行成功；实装行为仍以当前固定版本源码/已审契约为准。本管理者归档root已访问来源，未独立浏览或据文档宣称CHAT05流式实装，无新增需求/范围。

## 06:09 真实两轮窄屏人工观察补证

[真实queue-live截图](/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-shared-foundation/docs/evidence/f01/queue-live/second-reply-dark-narrow.png)由root人工目视，区别此前queue-live-preflight synthetic。管理只读manifest/checks，实际确认observedAt06:04:30.199828Z、web3d4985fca060155435b159e0467815bf8e88b8b8、centerRunnerfb906cb42391971a8b315dbd813f7633927d7265、caller0695bae99a20acd639b02826bf092c64040a21a1与CLOSED2/2，checks PASSED_TWO_QUERY_QUEUE_AND_VISIBLE_MEMORY、结束06:02:28.394Z；不重新测试。

Root目视真实两轮中文回复，底部同时0 waiting loaded、两处Execution details、Requested runner-default/locked/Read-only/Thinking off/Unpinned legacy、禁用Thinking/Tools/Steer和长footer，配置说明约占底部三分之一。这是定性截图观察，非输入延迟/完整产品复验，不撤销功能通过。既有U11后继按真实聊天与折叠详情链优先，再单一外层execution disclosure；保留model/access/queue主要项、可达技术语义、unsupported/unknown明确，用同390×844与键盘验证。完整归属/hash见[观察证据](queue-live-ux-observation.json)。

CHAT05后继输入边界补充（Lead→root，经GO接收）：超过64KiB仅存prefix及完整原文digest，超限原文不能追回；truncated JSON必须明确截断并回退为文本，JSON parse失败不是provider失败，不扩blob存储。此typed native活动限制与当前generic ACTIVITY的MAX_DETAIL_BYTES1MiB契约独立，不混用验收或声称可取回未存原文。

活动实施中root只读发现awaitSignal在已abort早退时可能未消费原promise rejection且reader已先执行，已交唯一owner修正/局部验证。记录为moving实现中的质量反馈，不是固定candidate独审失败，也未收到修复证据前不记已关闭；不改变当前scope或扩大产品测试。

## X01/RS08后继npm renderer互操作约束（root只读研究）

Root核本地frontend/codebase-design、固定747 trusted renderer/P01 hostApi1，并实际读[React invalid hook call](https://react.dev/warnings/invalid-hook-call-warning)与[npm peerDependencies](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#peerdependencies)：未来第三方npm renderer进入同一React树时，hostApiMajor=1不涵盖React/aui模块实例兼容；组件与renderer需要解析同一React模块。peerDependencies可声明宿主版本范围，但声明不证明打包后单实例。后继真实X01 Web包接入需固定host-shared React/ReactDOM/aui上下文模块，核peer范围并做同树useState/useAuiState装卸smoke；独立iframe/独立root可以有自己React，不能粗暴禁止整页多副本。当前747仅build-time trusted模块，无新loader/依赖，这不是当前finding、不影响既有approval，不新增授权系统或任务，排在聊天关键路径之后。

RS08固定3d追加精确证据（w01只读）：ConversationThread的queue/profile状态可使父组件render，inline identity converter改变身份；installed core0.3.22 useExternalStoreRuntime effect每次setAdapter，converter身份变化清旧converter并绕过相同messages/isRunning早返，原message WeakMap复用因此失效。最窄未来候选为module-level纯identity converter，保留onNew实时closure与新intent门禁（store更新在早返前）；不memo整个adapter、不做revision-only缓存、不省略converter。SDK早返仍通知订阅，不等零render或延迟收益；plugin后代自身render也不必触发该父组件。此固定3d静态证据与旧eb20turn内存探针分别保留，没有新测试/时延测量，准确scope/base与必要行为验证后再决定实现，不默认混入renderer接线。

ACTIVITY作者61b固定候选已在validation记录awaitSignal factory/gate、双reject handler与reset独立detail代际，并以22direct通过覆盖此前moving反馈；管理仅核source hash/范围与原始报告，root固定行为独审仍未出结论，不把作者修复记录冒充独立关闭。
