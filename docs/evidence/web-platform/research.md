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
