# 实际 conversation 与组合 pane 插件入口：后继覆盖检查

记录时间：2026-10-06 09:40:30 UTC。研究来源为 /root 对固定 main `80ba95ad70cdf724251be4d88130b6bac56d3606` 的只读源码核查。沿 WPF-001-05、REQ22–23，并绑定 MATURE05-02/03；没有新大task、实现或浏览器复现。

## 固定事实与缺口

App.tsx 约712使用实际 ConversationList，该组件没有扩展入口。已有 `sidebar.item.actions` 只在 App.tsx 约163的旧 ChatListItem（Execution tasks）接入；validation只提供task context，NavigationSnapshot与 `flow.chat.open` 只接taskId。实际conversation sidebar和group/tab header不因已有16个旧slot而完成覆盖；当前group/tab header只见内置Close，未见pane/tab actions slot。

## 后继接口与验收

在统一P01 registry内定义与真实conversation及稳定view身份匹配的小上下文/command；连接scope及成员校验仍属私有宿主。不能拿conversationId冒taskId，不能拿latest-turn权限冒整chat权限。关闭的sidebar行仅显示/动作授权不应强制创建view、加载历史或正文。

用真实ConversationList的sample按钮与组合pane菜单验证无需修改核心即可贡献及禁用；核跨连接、closed、hidden、旧task兼容，以及来源view明确绑定。MATURE05布局/焦点/草稿验收保留，不能用reducer或slot计数替代实际App旅程。

App、types、validation当前由STEIRI01唯一writer持有；此处仅记录后继，待其释放或精确amend后才能实施，不扩大当前13scope。尚无新browser复现、运行时失败判定或产品变更。


## w01窄接口候选与root规模研究（只读，未take/未browser性能复现）

w01固定f181、root复核8d8：真实ConversationList无AppSlot，App conversation tab只有Close；旧sidebar.item.actions仍task路径，session一个center lifetime且validContext仅task/composer。候选ResourceContext显式conversationId及conversation-view{conversationId,viewKey}，sidebar slot支持前者，新chat.tab.actions仅后者，统一P01 host/声明+grant+私有连接身份验证。最小实际消费者为closed sidebar row和live pane header；closed行只catalog成员不ensureView/读历史，pane稳定viewKey+所属conversation，不借latest task或global focus授权。复用flow.conversation.open current/split及view.close原风险确认；跨connection/关闭/隐藏/route rename/disabled/revoked验证。候选生产App、ConversationList、plugins types/validation/host/sample、session/react；tests plugin-host/plugin-app-bridge/新conversation-actions.browser。均apps/web下，后续精确scope领取，不与ATTACHI预占。

GO/root固定0b0d5fe7af9c0f40861ec6d2847f7383bcd76739：App877所有ChatPane挂载+hidden；closeNow515–536仅setVisible(false)并保views/projection/drafts。stream/activity预算不代表整个workspace预算；turns/turnVersions/details随访问增长是源码观察，未测浏览器内存或延迟。Projection.dispose会queue/lifetime/outbox.dispose并清未确认entry，不能普通closed回收；setVisible(false)仅abort观察，loadReply/loadMore仍用lifetime，关闭后可能迟到回填；机械删历史prefix会使从turn1连续扫描的historyCursor退0、重新读历史。

后继MATURE05并关联06-04：visible/hidden/closed-clean/closed-protected明确读缓存/代次/可回收矩阵；App drafts/profileSelections、knowledgeBindings、stream/view登记一起处理，mutation/outbox保唯一authority。未知receipt/草稿/附件选择需pin，容量满且全protected时拒新打开/新未决而非丢失；关视图不cancel后台task，重开固定会话恢复。实际App有界0model验内容/DOM/订阅effects/读取数、输入与切换时延及未确认恢复，区分agent并发、visible pane和驻留缓存预算。[React Activity](https://react.dev/reference/react/Activity) hidden保state/DOM、清effects且可低优先render，不能机械替换hidden宣称省内存。此段仅只读提案，优先RELEASE01/ACK/ATTACHI。

## Overview与workspace feed生命周期（GO/root固定c450，只读输入）

固定 `c450c2da7e6185b88db9f46e0299ee504ee6f3e8`：WorkspaceOverview始终挂载，effect无条件start；active仅改hidden/ActivityWindow，未接pageVisible。workspace-feed默认2500ms轮询，entries/buffered merge无驻留上限。这同时供sidebar/task summaries，不能离开overview就全停；stop/invalidate还影响actions pending，后继必须分观察与命令生命周期。本段是源码事实，不推算实际后台QPS/heap。

WORKSPACEPERF01若尚未冻结且原90s/8MiB预算有余量，可区分可见overview/聊天隐藏overview/pagehidden的/api/workspace与stream请求；否则仅保后继，不增加时限或为该输入重跑。DOM/请求不是JS私有cache或heap证明，生产修改另fresh精确scope。沿MATURE05-05与06-04，不新大task。

### c450成本路径与稀疏cursor约束（root进一步只读）

WorkspaceFeedProjection在arrived=[]/following=true时仍merge旧entries/buffered、sort并新数组；ActivityWindow useMemo因此可能重建全entries的ids/indices/Float64Array。DOM窗口不能界定CPU/JS驻留，未实测成本或收益。server m2-workspace的nextCursor/previousCursor按rawEntries计算，之后legacyTimelineEntries过滤，cursor可自然稀疏。后继不能以保留列表末条替代deliveredCursor或将不连续当漏事件；裁剪前缀要同时定义历史窗口/anchor/hasEarlier及重取语义，不能残留旧previousCursor使被裁内容不可再取。读旧页时新buffer需明确受保护anchor、待取区间及watermark，不能无限增长或静默跳过。App syncWorkspaceSummaries还给catalog/legacy TaskProjection轻摘要；观察暂停/摘要与按需活动历史应单一owner划分，不造重复authority。来源root本地codebase-design/clean-code与[MDN Page Visibility](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)，不追加本轮实验或生产scope。

### 最小回收片的额外保护接缝（root固定main2e71，只读）

知识bindings Map会订阅projection/host，目前仅session.dispose全量释放，因此views.delete不能冒称所有JS引用已释放。后继小Interface需现session的窄release seam并保selected/project状态，不造第二authority。projection读cache新generation在catch/finally也须guard，避免旧flight清新loading或写错误；queue详情读生命周期必须明确本片涵盖或作为开放后继。未dismiss的rejected/queue receipt仍有材料身份，不能仅按“非unknown”静默回收；现steering显式离开确认不可绕过。root仅源码观察/设计约束，无新产品实验。

### Retained chats操作的现有P01接缝（root固定4ec291只读审查，后继）

缓存片在App提供Retained chats按钮，限定批准不代表原插件完整目标完成。root已核现有chat.header/sidebar/workspace.actions等SlotId，chat.header实际挂AppSlot；global/task/composer现有ResourceContext与ui.layout足以承载表现层命令。Retained chats工作区入口后继复用现有P01 slot的builtin command/button贡献；App私有callback仍唯一控制dialog/views，不新slot/通用总线或公开views；验证disabled/unload/连接旧callback及键盘focus。当前缓存片限定批准不等插件完整覆盖，不立即领取App。 此为原REQ22–23/WPF-001-05、MATURE05-03后继，未实施/未browser验收，不抢ATTACHI共享App窗口。

### Arc布局仍开放（root固定eb95，只读）

workspace-state.ts:1–61与App:803–965仍是ChatGroup[]各自tabs/activeId和至多2个独立tablist，splitChat硬上限2，merge flatten回一个tablist；不是一个顶层tab内部A|B。隐藏tab仍挂ChatPane，CACHE限定回收也不代表全部DOM/订阅优化已完成。MATURE05-01/02/03/05继续pending/in-progress：一个唯一layout模型表达顶层tab持有有界pane数组，先A|B、3+另验；stable view.key与App既有views/aliases仍唯一资源owner，layout命令仅移动引用、不复制材料/消息或cancel。无连接/版本/无效ID/storage失败设计与验证的持久布局保持后继未知，不能另造views镜像或通用docking引擎。ATTACHI优先，不另派App/session重叠writer。本段无新实验/代码。

Root后续源码只读定位（同现有MATURE05研究，未browser验证）：App `navigateChatTabs` 110–135方向键立即activate并focus；有加载延迟的pane后继须分离focus与activation，Enter/Space确认。`closeNow` 548+沿workspace-state.closeChat关闭active默认tabs.at(-1)，并非稳定相邻tab。新layout命令只移动原view.key，每view只被一个pane持有，拒不存在/重复key，split/merge不创建新runtime或复制材料/读history；App继续唯一保护/回收权。原05-02/03验收覆盖，不新增App writer。

Arc后继读取预算（root源码核对，未新实验）：`conversation-stream/host.ts` 的 StreamConnectionBudget.acquire仍为每连接最多2个lease；CACHE四bodyflight保证建立于最多2可见pane。3+不可只解除groups>=2限制；同一layout方案须明确整体预算、公平前进/隐藏释放与实际消费者验证。panels仅在DPERF/基线metadata安全收口后续原Arc只读Interface/scope研究，ATTACHI写权优先，无新task/claim或workspace authority。

Panels现有Arc只读Interface已收敛，[候选18literal/唯一layout/稳定平铺host/P01实际消费者与90s预算](workspace-arc-readonly-proposal.json)。正式base必须等待ATTACHI02固定接收再核；与其已领24范围交集五处（App/session/types/validation/plugin-host专测），未建树/take/实验，ID只是未预留候选。首验同一顶层tab的A+B，2可见沿现预算，3+与持久恢复开放，不另造views/aliases/材料状态权威。

### 附件条目动作仍缺 P01 覆盖（root固定9eec源码审计，后继）

[原始固定审计](attachment-plugin-coverage-9eec.json)对应REQ22–23/WPF-001-05、MATURE03-03与MATURE01-02。Files入口和整个composer面板已走P01，但Picker的草稿/项目目录/恢复条目动作仍硬编码；ResourceContext没有pre-task attachment item。现artifact.actions是task reference，不能把upload ref套成task artifact或借taskId冒授权。后继优先复用单一registry，让真实上传条目可由sample贡献动作，宿主核当前center/view/project/fixed-ref；不公开private FlowClient。declare/grant、disable/unload/revoke及旧view回调须实测；unknown upload尚无ready ref，不能授权为已接受artifact。本次仅源码coverage缺口，不是ATTACHI02新blocking finding、不扩范围/抢06-04优先级。


### 恢复界面扩展覆盖后继（fixed82d78，只读）

[root固定源码审计](recovery01-plugin-surface-coverage-82d78.json)确认恢复入口已是P01 sidebar.footer command/button，但RecoverySurface内部refresh/restore/retry/remove仍固定按钮，无header/record-actions扩展接缝。沿REQ22–23与原06-04覆盖后继，由plugin co-lead定义最小record id/domain/phase+当前binding context；不暴露raw journal/client/全部namespace，保原命令授权与失效代次。此为partial实现的覆盖记录，不是当前21scope新finding/验收gate或全plugin完成；0运行，不扩写权。


## 未认证/重新认证连接页覆盖（固定f13源码研究）

[root原始双源审计](connection-plugin-surface-f13.json)固定f13de5c13e3983b94e16ae857ddc7b01cbba7a26，管理git show核两hash一致。Connection只有data-extension-slot=settings.sections标记；实际AppPluginSession/Provider位于Workspace内，外部Connection不受其包裹，AppSlot无SessionContext返回null。因此不能用已登录settings或Recovery入口证明此页面可贡献按钮。此为REQ22/23、WPF-001-05原覆盖后继，非当前Recovery21的新阻塞或完整review结论。

后继由原plugin co-lead协调唯一host生命周期和最小私有授权Interface：真实preconnect/reauth页面通过既有P01模型显示一次审定贡献，无须每加button修改Connection；明确未认证前可用能力，贡献context不得暴露owner token/CSRF/cookie/raw client。禁用/卸载移除DOM并撤回callback，连接换代不能复活旧中心动作；保错误/unsupported/offline、键盘及双主题行为。未指定新公开slot、第二hostauthority或第三层task；未实现、0UI/browser/plugin执行，不扩Recovery写权。


### 连接页候选接线收敛（固定2498，未实施/未领取）

[W01原报告](connection-plugin-2498/report.md)、[十产品源及固定需求清单](connection-plugin-2498/sources.json)、[管理hash与原TODO映射](connection-plugin-2498-intake.json)延续REQ22/23、WPF-001-05，仍是建议。候选把现有唯一P01 host所有权移到认证外层，AppPluginSession以精确业务registration/lease借用；复用现settings.sections与Appearance的真实ExtensionSlot/PluginView，不新增公开slot、第二registry或假session。

preauth仅审定打包builtin与本地主题，不提前加载全部Workspace业务。Connect贡献无参请求宿主私有form submit，Enter同入口；token/CSRF/cookie/client/journal不进入公开context/args/config。postauth必须经实际session/namespace/generation及retained guard才建立业务lease，撤权先于异步动作；重认证页面保留旧Workspace稿件/材料/capture/unknown但不保网络权限。停用/卸载撤贡献与旧callback，旧lease清理不能dispose唯一host或新session项；同global context不代表同授权代次。同realm builtin不冒X01第三方隔离。

待决范围为六产品路径加两新专测，完整精确fixture/plan/evidence与公开API能否支持尚需原plugin co-lead协调；见原报告，不能据此take。App/session当前仍Recovery独占，当前21不扩大。真实preauth/reauth按钮与Appearance panel、禁用卸载、凭据隔离、保稿/跨身份旧callback、390双主题与键盘均待验；仅标记DOM或新增slot计数不算完成。无新增第三层task、claim、产品执行或资源采样。
