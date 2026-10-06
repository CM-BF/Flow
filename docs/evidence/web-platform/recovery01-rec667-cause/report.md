# Recovery 首轮 IDB 失败：固定源码只读因果核

结论：至少存在两个独立问题。**观察器在库缺失时可创建空 v1、同步异常未终结 Promise** 是确定的 harness 缺陷。另有**自动保存依赖 Recovery 插件 active，但该 button 贡献不会因显示而激活**的静态可达产品缺口。两者可串联解释本次现象，但 raw 没有插件/IDB事件时间轴，不能称已逐事件复现，不能把一般 race 当唯一根因。

输入：封存 metadata `2f32b0f085d2498fcfc525e244ee13cfe74a5900`，browser source `667889058d3decc0abc9f635a37fd0f05f2c090c`；九个直接相关项目 blob及四份原raw hash在 sources.json。未读取 moving 源。仅 git show/文本/hash；0项目/owner记录修改，0产品import/执行、HTTP、PG、Chrome、空间采样或重试。报告非完整feature批准。

## 1. 实際观察及其不能证明的事

固定 `browser.json`：只有 cookieRead 一项完成；textIntentDraft FAILED，materialDraft NOT_COMPLETED；pageErrors只有 `Failed to execute 'transaction' on 'IDBDatabase': One of the specified object stores was not found.`；最终failure为 `Timeout 5000ms exceeded while waiting on the predicate`。后续reload/Restore、unknown、cross-tab、auth-loss均未到达。原raw未记录pageerror stack、IDB oldVersion/objectStoreNames、Recovery plugin state、current授权或saveDraft开始/commit时刻。

wire依序有无cookie session GET、显式Bearer connect200、cookie/noBearer session GET200、conversation/turns/queue等GET200、attachment capabilities与目录GET200，随后普通conversation/queue/workspace轮询。除了connect没有业务POST，bodyLoss为空。它支持已连上中心且材料目录已被打开；**HTTP成功不能证明本地Recovery插件active或IDB已经初始化**。process.log是Vite/Chrome启动及系统诊断（包含CVDisplayLink等错误），没有本地IDB/插件状态事件，不能拿它填补时间序列。

`budget.json`实际14846.267375ms；supervisor清理无错、数据库removed/remaining[]/connections0、worker/Chrome退出、scratch删除。清理与失败已封存，这次研究不增加运行证据或预算消费。

从既有脚本可限定失败位置：browser307–312第一用例完成；314–323第二用例打开Files、Browse、Use两文件、填正文并选Queue next；**324是首次records()调用**，它位于expect.poll里。只有该处在已到达路径使用5s默认predicate轮询；后续325/326没有进入证据。结合pageerror与唯一timeout，首records处是最符合源码/原raw的定位，但raw没有精确调用stack或独立step事件，仍应把定位写成强源码归因而非新增动态追踪事实。

## 2. 确定的观察器缺陷（browser201–206）

1. `indexedDB.open("flow.conversation-recovery.v1",1)`并非纯只读探针。对不存在的库会开始首次升级；没有onupgradeneeded处理，会提交一个未建任何store的v1。该观察器可能先于真正owner制造错误schema。
2. onsuccess直接在事件回调中执行 `database.transaction("records","readonly")`，没有try/catch；缺store时异常在异步事件栈抛出，不会自动reject外层new Promise。于是pageerror出现、database未close、page.evaluate Promise悬挂，最终表现为外层predicate超时而非清楚的schema错误。
3. 无onblocked/自身有限deadline，也没有失败后晚到onsuccess的close处理。即使后续把外层expect timeout改长，也不能修复这些终结/连接所有权问题。
4. 真正Journal使用同name/version（journal116,132），其onupgradeneeded134–136创建records及manifest。若观察器已建空v1，产品同版本open不会再升级；transaction159会抛错。产品transaction Promise的executor内抛错会reject给binding，和观察器事件回调的悬挂不能混为一谈。

**最小harness修正建议**：保持只观察。缺库升级时立即abort并明确返回/抛出有界的“尚未由owner初始化”结果，绝不创建store；若已存在v1缺任一required store则立即报告malformed schema并close，不能返回空列表伪装暂无草稿。所有open/error/blocked/transaction创建失败、abort和超时必须settle一次；放弃attempt的晚成功必须close，事务成功也close。probe pending可以让原expect.poll按既定deadline继续等真实owner初始化，但永久pending要使现有完整草稿断言失败。不能先在用例中打开Recovery来掩盖默认保存缺口；不能删库/补store/忽略异常/放宽材料与草稿断言。

## 3. 产品自动保存的完整源码链

### 身份与私有授权

- App1191–1195：BrowserWorkspace创建ConnectionSession和一个Journal，Journal构造仅保存factory/name，**不立即open数据库**。
- App1215–1232：公开session ready且identity匹配后保留同namespace/session/client；1247渲染Workspace。App379–381的authorized为active且session.authorized(namespace)。
- App653–664：RecoveryHost提供journal、当下authorized namespace/generation、stable viewKey→routeId/project owner以及完整draft。界面可编辑或其他API成功不替代这几个门禁。
- App783–804：唯一AppPluginSession创建并updateActions；原projection接session.recovery.commandPort。没有在这里主动激活Recovery插件。

### changed确实有调用入口

- Thread182–187订阅官方composer，将文本写原draft Map后onDraftChange；App1073转session.recovery.changed；App1074设置intent后同样changed。
- session193：附件binding发布也changed；205–212：knowledge binding/controller订阅同理。故本次选择材料、输入文本、选intent均有潜在保存触发点，不宜未经证据假定onChange完全缺失。
- binding140–147：closed/restoring/未authorized时直接返回；否则读取完整draft并缓存lastData，handoff时defer，普通稿调用enqueue。enqueue116先调用current，current100要求uiAllowed+host.authorized+namespace。
- binding103–105：uiAllowed只接受本session未abort且RECOVERY_OWNER状态恰为active。若仍registered，enqueue同步抛错，changed catch只publish error，**journal.saveDraft/open根本不会到达**。该错误在RecoverySurface的dialog内291，未打开时原raw没有自动记录UI文字。
- 真正通过current之后，enqueue126–138依序等待journal.saveDraft128，journal194–202执行事务；只有此路径或journal.list等才open。

### 激活缺口，而非只靠快慢解释

- session125–128：构造RecoveryWorkspace后host.register(createRecoveryPlugin)，host89–113注册状态为registered。
- binding281–285：Recovery贡献是sidebar.footer的**button**，声明view事件+command事件；实际load只注册open命令。
- plugins/react17–70：ExtensionSlot仅订阅并渲染button，click后host.execute；没有在mount时调用activate/show。host546–568的view触发只适用于**panel**，不是该button。
- host326–356：执行实际command时才按command activation event激活；host608–642的slot snapshot把未disabled的registered贡献也发布，因此“按钮已经可见”不等于active。
- App409/887/919：1280下sidebar默认显示，确有AppSlot sidebar.footer；这并不能激活button。PluginProvider（plugin-integration/react28–30）只是context provider，也不激活。
- 固定apps/web/src只读定位所有host.activate/RECOVERY_OWNER：有reply renderer/stream显式激活与Settings启用路径，没有Recovery默认激活入口。browser307–324没有调用openRecovery或点击Settings；openRecovery第一次计划在reload后的331。
- binding81–87虽订阅host，并在false→true时重放已有draft.changed，但这个恢复依赖后来真的变active，不能替代首次激活。

因此存在一条确定静态可达链：新authenticated App→Recovery registered→用户编辑/选材料→current拒绝save→库仍未创建→records首次open创建空v1→onsuccess缺store抛出→悬挂/timeout。**链条前提和分支源代码均成立；本次raw未实测plugin state及IDB升级事件，不能断言它就是此次唯一完整因果轨迹。** 同时，先前其他插件激活不会自动改变Recovery entry状态。

**最窄产品修正方向**：在原session/私有Recovery生命周期内，让获授权、已配置的默认Recovery在首次编辑前按既有PluginHost API激活，并明确registered/activating期间如何保留和重放draft变更；保持显式disabled不被任意changed自动启用、auth失效不授读写、旧generation回调失效。无需新增host/slot/HTTP/第二草稿权威；不以取消active门槛或未授权预创建数据库替代生命周期接线。具体实现应由root/原owner按现scope另派，本报告不修改它。

## 4. 仍未证实的候选与最小验证增量

- 没有本次初始化时间轴，不能排除其它原因先造成IDB缺失/异常（save前namespace/owner校验、完整draft转换失败、generation变化、storage open失败/配额/环境限制）。当前raw没有相应结构化错误，不给它们“已复现”标签。
- 此运行新Chrome context且未到reload，外部遗留malformed库不是首选解释，但未保存实际IDB元信息，仍不能把schema来源直接定死。
- 需要后续有界用例保留当前用户路径：不先打开Recovery，正常授权后选材料/输入/intent，观察真实owner创建两store并提交完整draft；observer不得主动创建。记录非秘密的plugin state、授权布尔、数据库version/store names及请求/commit错误顺序即可，不记录token/CSRF/正文副本。
- 分开验证：observer碰到缺库不留库，已存在malformed v1明确失败/关闭；正常owner初始化后观察成功；blocked/晚success终结；默认自动保存与显式disabled/reauth代际行为。保持完整text/intent/有序材料assert，不能用一个手工pre-open把两缺陷合并隐藏。
- 这些只是后继建议，不是新增case执行许可；剩余75.153732625秒为预算算术，原失败raw必须保留，任何修复/重跑需后续固定target及fresh gate。

## 5. 只读clean-code核查

本地find-skills/clean-code/codebase-design/webapp-testing沿已读版本复用，无安装。职责发现：records“观察”实际具有建schema副作用，违反只读观测边界；Promise在IDB事件回调缺少错误终结及DB释放。产品门禁本身应保留，但默认激活责任与按需button展示混淆，使需要主动工作的checkpoint模块被UI点击控制。建议修正职责接缝而非加sleep/增timeout/忽略错误。报告只列可证源链、分开运行证据与推论，没有产品改动或新运行结论。

## 补充：root独立复核与规范归因

Root本段独立读取session127、PluginHost registered→activate与binding current/changed后，确认上述激活缺口为静态可达。最窄修复仍限已配置且当前授权namespace的默认registered生命周期，经原host.activate进入active；显式disabled不重启，激活期间保内存draft并在同一generation确认后重放，auth/namespace改变与dispose都撤销旧续接。不能放宽uiAllowed，也不能把browser先点Saved drafts当默认保存验收。

Root已独立查W3C IndexedDB原文 [Opening a database connection](https://www.w3.org/TR/IndexedDB/#opening)：不存在时建立version0、无store，再进入升级。此为root提供的规范依据，本agent未重新联网。即便加databases()预查，它也只是快照，仍需onupgradeneeded立即abort防TOCTOU；不创建store，所有错误路径close/reject。该规范解释观察器风险，不补造本次运行的open/upgradeneeded时间戳。
