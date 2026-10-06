# WPF-MATURE-05 Arc式组合标签与独立pane

| 字段 | 内容 |
| --- | --- |
| 大task ID | WPF-MATURE-05 |
| 状态 | in-progress；完整验收未完成 |
| co-lead | Web /root（执行管理 d01_owner） |
| 优先级 | P2 |
| 唯一来源 | 本目录plan/status/review，管理worktree合法claim v3；不另填聚合进度 |
| 用户来源 | [成熟度原话与六项分工](../../docs/evidence/web-platform/mature-task-handoff.md)；原WPF REQ仅追溯，不形成第三层 |
| 收益 | 一个顶层标签代表一组并排pane，让真实对话与文件/产物能在同一工作组独立操作且可恢复布局。 |
| 边界 | 本计划定义完整用户结果；具体实现须独立worktree、fresh精确scope take和固定独审，计划目录领取不授产品写权 |
| 依赖 | CONTEXTI已main并释放，STEIRI01已main并释放，布局与插件入口后继仍须fresh精确交权，不能借旧free观察写入；复用workspace-state，先核持久布局接口与真实view身份，不改会话历史。 |

## 已有能力与gap

现有聊天split/group和原生hidden可见性已用于真实流/活动接线；这不等价于Arc组合标签。旧TaskThread fixture不是此项验收。

尚缺：组内pane数组、组合标签图标/选中容器、独立焦点/滚动/草稿、比例/交换/合回/布局恢复，窄屏退化与有界3+pane后继。

中性轻质外壳、低对比紧凑sidebar、分组小图标短行高；圆角选中容器内多个图标表示pane组合；嵌入式并排panel各有圆角细边框/轻阴影/窄gutter/精简header，活动pane靠明确边界而非大块高饱和背景。玻璃集中shell/sidebar/浮层，正文保持稳定不透明可读。控件紧凑而正文适度留白，避免满屏大卡片。 参考图实际有3pane；不把首期A与B验收等于数据模型仅支持2。

## 稳定TODO与完整验收

- [ ] **WPF-MATURE-05-01** 固定组与pane模型：顶层tab/group包含任意有界pane数组，不写死两栏；首验A与B，最大pane数在实现前明确。
- [ ] **WPF-MATURE-05-02** 接真实conversation双pane：同顶层tab显示A与B，独立焦点/滚动/未发草稿/上下文，不靠全局focused授权其他pane；真实ConversationList扩展用conversation/view上下文，不借旧task slot冒覆盖。
- [ ] **WPF-MATURE-05-03** 提供布局操作与恢复：比例调整、交换、合回与恢复；关闭视图不cancel，split/merge只改布局不拼接history；组合pane菜单复用P01 registry并核sample贡献/禁用及跨连接身份。比例键盘与窄屏焦点实际验证；有显著按需加载延迟的tab使用方向键移动focus、Enter/Space手动激活，关闭后焦点落相邻tab或New Chat。Retained chats工作区入口后继复用现有P01 slot的builtin command/button贡献；App私有callback仍唯一控制dialog/views，不新slot/通用总线或公开views；验证disabled/unload/连接旧callback及键盘focus。当前缓存片限定批准不等插件完整覆盖，不立即领取App。
- [ ] **WPF-MATURE-05-04** 兼容内容种类与窄屏：模型可容chat/文件/产物；首个两栏旅程与3+后继分明，390键盘可达且不强迫外部内容同色。
- [ ] **WPF-MATURE-05-05** 固定真实交互验收：实际App双会话及内容pane交互/刷新恢复/关闭重开证据，主题和比例/焦点测试；大量反复开关后DOM/缓存/订阅有界，区分visible/hidden/closed-clean/closed-protected，草稿/附件/unknown不可静默丢失，满额保护时拒新开，重开恢复且不cancel后台任务；实际0模型测DOM/effects读取/切换输入时延及未确认恢复，Activity不是内存上限；另核overview/feed同时服务sidebar的观察与命令生命周期，按visible overview/聊天隐藏overview/pagehidden区分请求，不能仅离开overview就全停；后继裁剪必须保raw稀疏cursor/watermark、阅读anchor/hasEarlier/可重取和单一轻摘要来源，不用DOM推算CPU/heap；关联MATURE06-04，没有实现的3+明确开放。

## 验证与交付规则

每个实际子task直接链接本大task稳定ID及co-lead；进度只维护其唯一status。仅完整TODO验收通过、证据环境/固定源码明确并完成受控主线集成后才可将本大taskDone；当前所有大task验收仍开放。普通片段ready/review/merge/claim不向GO发送，内部worker通信保留，需GO解决的整任务独立blocker仅一次。新scope依D04查重/原子领取，本计划不授权重启个人服务、刷新用户tab或新增provider调用。验证按影响范围，不为文档重复产品测试。

## 固定研究输入

见[固定b1c2源码与官方接口研究](../../docs/evidence/web-platform/mature-task-handoff.md)：现有split硬限两个group，尚无组合pane模型；现theme tokens可复用。可聚焦splitter键盘/ARIA需实际验证，不透明fallback不可只靠支持有限的media query。研究未构成实现或产品验收。

### 组结构和预算后继验证（root 09:12固定main77c只读）

现App tabs.map在groups.map内，跨group移动即使View.key同也可能remount，未来A|B合并/交换/resize需实际验证composer草稿、scroll、知识/附件选择、unknown receipt；不能只测纯reducer。持久仅版本化有界结构/相对比例/view refs，不存token；reload身份另核，未知ID占位不后台遍历conversation。现stream连接预算最多2读取lease、8cachedturn/4MiB（pane4turn/2MiB），3+pane须测公平前进/隐藏释放，不能解开UI上限就声称全部实时，A|B不需改host。原slot手动focus/Enter激活避免方向键触发批量按需读。React官方preserving-and-resetting-state支持tree位置推断，本轮无实测失败；来源https://react.dev/learn/preserving-and-resetting-state 与https://www.w3.org/WAI/ARIA/apg/patterns/tabs/ 。

实际插件入口覆盖见[root固定main80ba只读研究](../../docs/evidence/web-platform/conversation-plugin-coverage-research.md)，沿REQ22–23/WPF-001-05；未browser复现或实施，不扩大STEIRI写权。

规模验收补充（GO/root固定0b0源码观察，未browser复现）：大量反复开关后DOM/读缓存/订阅有明确上限，草稿/附件选择/unknown receipt不丢；关视图不cancel、重开恢复固定会话。visible/hidden/closed-clean/closed-protected生命周期和受保护满额拒新开见[既有研究](../../docs/evidence/web-platform/conversation-plugin-coverage-research.md)，关联MATURE06-04；不把stream/activity已有预算当整个workspace已有限，不新增大task或提前占App。

### 下一ready产品片排程（GO最新优先级，覆盖先前Arc先行）

WORKSPACEPERF01固定partial基线已足够，不再补齐所有截图/分位数。下一生产片优先05的最小cache回收/观察生命周期：可回收view与正文缓存有界，protected draft/attachment/unknown与未dismiss rejected/queue receipt材料不丢，现steering离开确认不可绕过；views.delete不代表knowledge bindings订阅释放，须原session窄release seam并保selected/project，读cache代次在catch/finally也核，queue详情范围显式；区分关闭DOM、异步读取与JS引用；复用原controllers和唯一mutation authority，不造第二workspace状态源。panels先只读固定当前main，提出小Interface、精确scope及容量/选择策略；反复开关、保护满额、late detail/history与重开原身份为直接验收，原8项沿用、新差异重测。

不同时大改feed/layout，不预占宽App范围；与ATTACHI后继App接线按精确有序窗口交权。Arc组合目标01/02/03完整保留为随后产品片：A与B同顶层tab、swap/merge/比例、独立焦点/滚动/草稿，任意有界pane数组、首验2/3+开放；复用唯一P01真实conversation/view身份。当前仅只读proposal，未take新生产范围，不能沿基线四scope修改产品。

Arc后继键盘参考（root本轮只读来源）：[W3C tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)支持有明显加载延迟时手动激活；[window splitter](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/)给出可聚焦separator、名称/controls/value/min/max和方向键，但该页面说明模式仍待工作组完成review，不写成完整认证。03/04须用真实比例、窄屏和关闭后焦点验收，不只添加role；此研究不改变当前cache优先级、不新增scope/测试。

CACHE与附件宿主的共享接缝：session.ts可能同时承担知识binding回收与ATTACHI实际挂接，两个owner先以最新main/账本定单writer窗口，再fresh精确take；不预领App/session宽范围。附件journal损坏隔离与cap/namespace失效属03-05并与05-05保护矩阵衔接，不作为4c4d模块既有实测，也不把缓存回收升级为第二状态authority。

共享写入窗口准备（11:27:52 fresh账本）：App/Thread/session与候选projection/outbox/queueprojection/workspace-state当时无writer，详[时点记录](../../docs/evidence/web-platform/workspace-attachment-sequence-observation.json)。先ready CACHE小Interface经root结构审查后精确领取，再为ATTACHI实际绑定明确单writer窗口；free不是写权，不提前领宽scope或改变两层task归属。

CACHE完整[16literal只读方案](../../docs/evidence/web-platform/workspace-cache-attachment-binding-proposals.json)已到，待root结构审查；预算32驻留conversation、closed-clean0、reply2/2MiB与queue4/64KiB、每类1flight，保护稿件/选择/任意未dismiss收据并提供重开入口。与附件生产24literal相交四生产及两专测，先CACHE小Interface再明确交权，fresh COMMITTED前不建可写实现。以上为候选，不把UTF8正文上限当JS堆/全workspace上限，不预占宽scope。

执行安全点（11:34）：附件运行域/公共桥接已受控main fd1322；独立UI模块4c尚待main。CACHE root批准16literal后已fresh COMMITTED883321 v1，六共享路径含两专测先CACHE后ATTACHI02。双方保护pending composer submission/capture，即使items已移除也不自动回收；未提交profile/project选择才属选择保护。范围、容量、输入与收口见[当前集中队列](../../docs/evidence/web-platform/mature-task-handoff.md)及[精确方案](../../docs/evidence/web-platform/workspace-cache-attachment-binding-proposals.json)，不继承旧claim。

执行审查安全点（11:54）：CACHE固定4ec291/final55b48已获root限定APPROVED，原05仍in-progress。14源与16scope管理核通过，独立133与作者分次7 browser/68.689s分别归因；最终settlement绑定全部14源，早期App差accepted小增量，不称最终完整browser重跑。main尚待正式接收；两阶段附件共享窗口仍先CACHE收口与CAS再ATTACHI。详见[当前队列](../../docs/evidence/web-platform/mature-task-handoff.md)。

正式接收（12:00）：CACHE获审4ec十四源已main017adc，owner10ca8双端clean后全部16scope停写，883321 v2 released；六附件交集已合法释放，后继需fresh领取。完整05/Arc/plugin与附件组合验收仍开放；无新产品测试或部署宣称。
