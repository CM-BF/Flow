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
