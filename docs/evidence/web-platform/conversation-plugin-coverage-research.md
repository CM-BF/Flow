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
