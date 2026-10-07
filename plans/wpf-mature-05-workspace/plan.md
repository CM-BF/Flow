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
- [ ] **WPF-MATURE-05-05** 固定真实交互验收：实际App双会话及内容pane交互/刷新恢复/关闭重开证据，主题和比例/焦点测试；大量反复开关后DOM/缓存/订阅有界，区分visible/hidden/closed-clean/closed-protected，草稿/附件/unknown不可静默丢失，满额保护时拒新开，重开恢复且不cancel后台任务；实际0模型测DOM/effects读取/切换输入时延及未确认恢复，Activity不是内存上限；另核overview/feed同时服务sidebar的观察与命令生命周期，按visible overview/聊天隐藏overview/pagehidden区分请求，不能仅离开overview就全停；后继裁剪必须保raw稀疏cursor/watermark、阅读anchor/hasEarlier/可重取和单一轻摘要来源，不用DOM推算CPU/heap；关联MATURE06-04，没有实现的3+明确开放。 长时活动读取的累计缓存验收见[本条补充](#活动读取累计缓存验收)。

- [ ] **WPF-MATURE-05-06** 完成日用会话导航：近期会话排序和全授权标题搜索采用明确兼容合同；有界摘要/分页与稳定选择、草稿和焦点；完整验收见[导航后继](#日用会话导航后继)，当前未take。

## 验证与交付规则

每个实际子task直接链接本大task稳定ID及co-lead；进度只维护其唯一status。仅完整TODO验收通过、证据环境/固定源码明确并完成受控主线集成后才可将本大taskDone；当前所有大task验收仍开放。普通片段ready/review/merge/claim不向GO发送，内部worker通信保留，需GO解决的整任务独立blocker仅一次。新scope依D04查重/原子领取，本计划不授权重启个人服务、刷新用户tab或新增provider调用。验证按影响范围，不为文档重复产品测试。

## 固定研究输入

见[固定b1c2源码与官方接口研究](../../docs/evidence/web-platform/mature-task-handoff.md)：现有split硬限两个group，尚无组合pane模型；现theme tokens可复用。可聚焦splitter键盘/ARIA需实际验证，不透明fallback不可只靠支持有限的media query。研究未构成实现或产品验收。

### 活动读取累计缓存验收

原05-05主责同一长时view及其各turn聚合的metadata/body entries与bytes、in-flight界限，不能用单body/单页或view数量代替总量。多次展开/分页后应有明确计量、超额/淘汰与生命周期策略，保持connection/view/turn/task隔离、unknown/草稿/附件/未决回执和后台执行。先评估现有ReadCache/lifecycle，不默认预取或新框架；淘汰后的cursor、显式重读与焦点验收由原06-03共同核对。固定d057的[共享源码事实与验收输入](../../docs/evidence/web-platform/activity-cache-total-bound/report.md)只补覆盖，尚未实施或测量，不改变Recovery/Quick优先顺序。

### 组结构和预算后继验证（root 09:12固定main77c只读）

现App tabs.map在groups.map内，跨group移动即使View.key同也可能remount，未来A|B合并/交换/resize需实际验证composer草稿、scroll、知识/附件选择、unknown receipt；不能只测纯reducer。持久仅版本化有界结构/相对比例/view refs，不存token；reload身份另核，未知ID占位不后台遍历conversation。现stream连接预算最多2读取lease、8cachedturn/4MiB（pane4turn/2MiB），3+pane须测公平前进/隐藏释放，不能解开UI上限就声称全部实时，A|B不需改host。Root后续核 `conversation-stream/host.ts` 的 acquire仍上限2；CACHE每pane reply/queue各一flight、两可见pane共四bodyflight的保证依赖该可见数量。3+布局必须重新核整套读取预算，不能仅解除groups限制；panels在两项metadata收口后只读收敛原Arc Interface/scope，ATTACHI当前App/session/types/validation写权优先，不建树/take/新实验。原slot手动focus/Enter激活避免方向键触发批量按需读。React官方preserving-and-resetting-state支持tree位置推断，本轮无实测失败；来源https://react.dev/learn/preserving-and-resetting-state 与https://www.w3.org/WAI/ARIA/apg/patterns/tabs/ 。

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

当前Arc边界按root固定eb95[源码研究](../../docs/evidence/web-platform/conversation-plugin-coverage-research.md)：两独立tablist/flatten merge不等顶层tab内A|B，CACHE不等全部DOM/订阅优化。沿01/02/03/05保留唯一layout引用模型、stable view.key和原App资源owner；持久化的连接/版本/无效ID/storage失败未验仍开放，不新增重叠App/session写权。

原05-02/03的具体后继验收：现App方向键立即activate、关闭active默认最后tab仅是已定位源码事实（未browser测）；Arc新接口须显式focus/Enter或Space激活、关闭后稳定相邻焦点。同一view只归一个pane，split/merge移动已有view.key，拒不存在/重复key且无history副作用，App仍唯一保护/回收owner。详[现有研究](../../docs/evidence/web-platform/conversation-plugin-coverage-research.md)，当前不领取App。

Arc后继当前只读18literal方案已集中到[现有研究入口](../../docs/evidence/web-platform/workspace-arc-readonly-proposal.json)，仍归本计划01/02/03；没有新写权或第三层执行计划。候选同一平铺ChatPane父节点保持view.key与实际composer/材料，唯一layout有界pane数组；首片2可见、3+和持久化后继。正式实施先等附件固定接收和五条当前交集移交，再核准确base/结构/fresh scope；90秒/10秒清理/8MiB只是候选验收预算，尚未执行。

最新GO优先级覆盖此前Arc紧随缓存的候选排程：附件与已审dashboard安全停点后先完成原MATURE06-04连接/刷新/未决发送恢复，Arc/装饰后排。18literal仍只读未领，复用已有研究，不因等待而预占App或产生并行writer。


## Arc × Recovery 固定接口研究（2498，仅原01/02/03/05）

[root原始八源研究](../../docs/evidence/web-platform/workspace-arc-recovery-2498-interface.json)与[管理来源核](../../docs/evidence/web-platform/arc-recovery-source-intake.json)只细化已有目标，无新任务或写权。布局仅持有open-layout的stable view.key引用，在同一稳定keyed父级中移动；App继续解析route alias和拥有view/controller，Workspace/Recovery不因split/merge换代。closed-protected的32驻留上限不能解释为32个永久Thread DOM，显式close沿原保护/释放、重开由原owner恢复，布局不cancel任务。

结构恢复先核中心/主体身份，再按版本化有界view引用、比例和选中项恢复；不复制journal、请求、controller或凭据，不为同稿造第二view.key，未知引用有界占位。首验同顶层tab内A|B；3pane仍开放，须核stream lease在持续hasMore/wake/reacquire下的进展及reply/queue整体并发，不从lease上限2推断公平或饥饿已实证。P01 pane目标需协调实际typed context，不用global focus/task冒归属，私有App仍唯一mutation owner。

真实App必须覆盖独立焦点/选择/scroll、profile/知识/附件及pending capture/原receipt保留、手动tab激活/相邻关闭焦点/390 splitter键盘；纯reducer或stable key本身不证明这些行为。此研究0产品执行，不扩Recovery21，后继仍待合法App交权与独审。

原05-03/04/05加入[app1750固定截图的用户结果验收](../../docs/evidence/web-platform/app1750-product-acceptance-followup.json)：390展开导航遮盖内容不是完整移动验收或单独bug证据；关闭导航后需完整读消息/编辑发送/展开详情，desktop↔narrow切换保持草稿、焦点与可见性，导航开关键盘语义明确。沿现布局/草稿authority，不新增状态源、任务或App写范围；不重跑已green RELEASE。

同一app1750验收补[root固定506导航两源研究](../../docs/evidence/web-platform/app1750-narrow-navigation-root.md)：fresh窄屏与desktop resize须分别验；导航开关expanded与关闭/选会话后的焦点回交需真实键盘验证，保持main/draftMap和原plugin slots身份。源码推导不等运行bug，原native disclosure/modal取舍按实际交互核；不阻RELEASE或新建任务。

原05-03插件菜单验收补充（fixed main22a，仅研究）：[九源报告](../../docs/evidence/web-platform/workspace-native-tab-seam-22a/report.md)与[root限定核验](../../docs/evidence/web-platform/workspace-native-tab-seam-22a/root-review.json)确认外层workspace.tabs、header/actions及active artifact.actions已接P01，剩余一项是右侧Task workspace逐内置tab动作位，尤其inactive detail B。后继必须在A激活时准确绑定B原task/tab身份；仅显示/展开菜单零正文GET，显式读取才沿原reference.load；禁用/卸载/撤权、换连接和B关闭后旧callback受tab lifetime限制，不能借全局active A或第二tab状态源；390浅深与键盘核动作发现、tab焦点/激活和关闭回交，不在role=tab内嵌button。04内容/窄屏与05真实App验收沿用。具体接缝由原P01接口owner协调，不在此新建slot/公共契约/任务或领取写权；原Close/Delete和私有布局owner保持，Recovery P1优先。全部为源码覆盖和候选验收，不是运行通过。


<a id="arc-msg03"></a>

## Arc × MSG03 草稿与材料生命周期（仅原01/02/03/05）

[固定c4bee的12源增量研究](../../docs/evidence/web-platform/arc-msg03-ownership-intake-20261007/arc-msg03-peer.json)复用原Arc与Recovery提案；root已核固定源与准备期间卸载会标记失败的行为路径。以下是未实现的设计约束与验收补充，不是已复现的布局故障或运行通过。当前两group上限不等完整Arc；不新建task、公共接口、draft store或outbox，也不领取MSG03当前19scope。

六项约束沿原TODO分配：

| 原TODO | 约束 |
| --- | --- |
| 01/02/03 | 一个稳定父级持有每个view唯一composer。移动只改布局引用，保留view.key、已应用设置C、ownership Symbol、Thread pending与材料准备回填观察；禁止先close/release再reopen实现move，也不能用跨父节点的相同key代替保活证明。 |
| 01/02/03 | 同一个已提交的真实可见view集合同时驱动pane可见性、projection、私有read.editable与configure。隐藏、tab停用或结构移动按既有close/revoke撤销未应用opening，已应用C不变；不以CSS或全局focused pane授予另一个pane权限。 |
| 02/03 | 保留opening撤销和提交当场read+CAS双guard。pane结构版本不替代draft ownership或connection generation；旧Apply/omit、插件重新启用、A→B→A不得恢复旧权限，回焦只到仍合法可见的原控件。 |
| 02/03/05 | 已发送A、已排队B和当前稿C各保原冻结tuple/key/body。材料等待时移动不重建capture、不自动cancel/retry/send；失败、取消与迟到结果仍保护新稿，held稿只经原完整恢复与当前目标CAS写入。 |
| 01/03/05 | Recovery CompleteDraft已包含messageSettings，布局持久化仅存有界结构和view引用，不复制Symbol/catalog/opening/候选/请求。reload生成新ownership，旧设置暂不可用须保值并阻提交，不能自动omit/nearest；settings-only空正文仍按protected稿处理。 |
| 01/02/05 | 一个session/host/read budget，目录仅在合法opening按需读取。声明3+前须证明stream/reply/queue公平前进、隐藏释放与请求计数有界；修改上限2本身不能证明完整Arc或性能收益。 |

原05实际App验收补充八项（01/02/03对应实现也须满足）：

1. 同一顶层tab的A/B，以及未来声明范围内的第三pane，分别持有不同设置/profile/intent/正文/有序材料；swap/split/merge/move/resize保身份与C，且不新增业务POST。观察真实composer DOM、选择、scroll与准备owner，纯reducer不够。
2. draft-route接受为conversation-route时再移动，保view.key、原receipt/key/body与新稿；不出现第二alias/composer/binding或两布局引用争用configure。
3. 设置弹窗暂选Y后切tab或隐藏，保已应用C、撤销旧Apply/omit/details；重新显示只新opening可写，关闭回焦不抢隐藏pane。
4. 真正adapter材料await期间编辑settings-only或同值新ownership稿并移动；迟到成功、失败、公开cancel均不覆盖新稿/其他pane；显式完整恢复保材料顺序且不重复，仅延迟HTTP ACK不能替代。
5. 当前settings/profile/intent改变与恢复await、同view双restore、授权A→B→A交错，原lease/CAS拒迟到写，journal不丢，无自动send/retry；布局回放不复活旧authority。
6. 仅settings、无正文/文件的close或close group仍closed-protected并可重开原view；可回收时App只release一次，不由layout直接删Map绕过保护。
7. 390与双主题真实挂载验证当前pane/设置入口/主操作、键盘move/resize、手动tab激活及关闭邻居焦点；局部回焦不窃取另一pane的输入选择。
8. 仅在明确声明3+时验证持续backlog下stream/回复/queue公平前进、隐藏释放和目录请求上限。若首片保max2，就报告max2与3+未完，不引用旧MSG/Recovery绿色结果冒新Arc实证。

### 日用会话导航后继

来源是GO经root准确转述（管理U17），不是用户逐字。固定ee98的[11源研究](../../docs/evidence/web-platform/quick-b3-return-navigation-20261007/navigation-root-research.json)发现当前随机UUID创建、ID升序分页、Catalog每页50，列表只在已加载items上按title过滤；这是日用能力缺口，不是已测性能回归。updated_at目前随turn admission变化，不能标成最近浏览或所有后台活动。

用户结果及验收：

- 默认能找回近期使用/活动会话；实施前冻结真实排序语义、创建fallback和稳定ID tie-break。若另提供本地最近打开历史须明确区分，后台活动不得不断抢动当前行。选中会话、pane、草稿与焦点独立保留。
- 标题搜索覆盖当前中心/项目真实授权范围；项目筛选不授新权。复用conversation/client接口和轻摘要，不先拉全库、正文或详情；“仅筛选已加载页”须诚实标注，不能冒全库搜索。
- 旧省略模式保after/limit与ID cursor兼容（当前after<=128、limit<=50）；新模式需明确能力/version/query/project/sort绑定，定义规范化、大小写/通配字面转义、query与结果字节上限及参数化查询。不能暗改旧cursor或向旧strict中心盲发新字段。
- 新旧响应按中心/项目/query/sort/cursor generation隔离，快换时取消旧请求并丢迟到结果。连续翻页/刷新在同时间戳及并发新活动下须有明确去重和刷新合同；可变活动时间加时间上限并不自动形成历史snapshot。
- 有界前端列表/summary缓存与按需分页；更新提示或显式刷新代替后台重排。空结果、错误/重试、键盘、窄屏和主题必须可用。
- 固定隔离材料至少>50会话，只有未加载页出现命中；覆盖同时间戳、连续翻页/刷新、快换query、切中心/项目、恶意/外来cursor与旧中心能力。记录真实请求数、响应bytes及局部延迟；有index不等低延迟承诺。

[共享接口与精确路径候选](../../docs/evidence/web-platform/quick-b3-return-navigation-20261007/navigation-scope-candidates.json)仅用于协调原center/contract/Web writer。App/projection仍属Recovery，后继不借旧claim写入；未来fresh查重、独立树和精确take后实施，不新增大task/第二搜索状态源。当前恢复/模型设置验收优先；不要求等全部Web完成才协调共享接口。本文不授权真实用户服务扫描、全库预取、provider或运行。

原REQ10/12、RS04键盘后继补[固定9f0e FileTree重入研究](../../docs/evidence/web-platform/recovery-created-turn-admission-20261007/filetree-reentry-research.json)：现roving重挂仅取active/首项而未采用保留selectedPath，为静态发现、尚无browser复现。候选由原可复用Tree恢复单一tabstop，父层保task选择身份；验选中项重入、唯一tabstop、无eagerdetail和插件action键盘边界。未take/实施、不新task，不阻Recovery/Quick。

### 既有Arc执行位恢复

I01实际App接线已main5592且61abv2于17:11:49.694Z正式释放。现由原panels恢复既有WPF-WORKSPACEARC01候选，独立web-workspace-composition/codex同名，沿本计划01/02/03/05推进，非新同义大task。原18literal于17:18:21.411Z观察无active冲突，固定mainf885含I01，目标树/分支不存在；这是准备观察，实际修改前仍须精确范围fresh原子领取。三pane及以上不能仅取消两栏限制：现stream两lease与持续hasMore要收敛公平前进和整体读取上限，保持唯一composer父级、view/draft/Symbol/材料准备与pending状态，隐藏/断开立即撤旧CAS和activation。新16MiB仅source固定供给/项目delta/own记录/TMP静态准备上界，工程验证另给有限段；K01实际测量期间不启供给、协调CLI、编译或测试child。精确当前进度沿[管理交接](../../docs/evidence/web-platform/mature-task-handoff.md)，产品实施完成不由本准备说明推断。

本片复用[完整批次FIFO公平性输入](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/arc-three-pane-batch-fairness.json)与[插件调用生命周期输入](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/arc-plugin-invocation-lifetime.json)：两条stream lease在完整有限batch后优先交等待者，持续backlog与迟到第三pane都要重复进展；不改共享projection源，不把挂载或布局身份当调用永久有效。当前[固定供给索引](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/arc-static-preparation-index.json)只有静态闭包证据，196源/1,809,043B与22外包候选不等runtime验证。


### 原Arc片的可访问性验收补充（2026-10-07）

在现有20范围内，沿[固定补充输入](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/arc-accessibility-followup.json)核手动激活tab、关闭后的邻项焦点、可达close/menu、separator键盘与指针同clamp，以及隐藏视图的授权和效果清理。保持紧凑密度时检查实际点击区；不以图标视觉尺寸替代命中区。实验性tabs-actions和仍未完成最终示例审查的splitter文档保其适用限制，不据此增功能或框架。尚未运行真实检查，不构成完整视觉或合规结论。
