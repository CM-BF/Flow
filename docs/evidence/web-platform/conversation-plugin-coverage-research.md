# 实际 conversation 与组合 pane 插件入口：后继覆盖检查

记录时间：2026-10-06 09:40:30 UTC。研究来源为 /root 对固定 main `80ba95ad70cdf724251be4d88130b6bac56d3606` 的只读源码核查。沿 WPF-001-05、REQ22–23，并绑定 MATURE05-02/03；没有新大task、实现或浏览器复现。

## 固定事实与缺口

App.tsx 约712使用实际 ConversationList，该组件没有扩展入口。已有 `sidebar.item.actions` 只在 App.tsx 约163的旧 ChatListItem（Execution tasks）接入；validation只提供task context，NavigationSnapshot与 `flow.chat.open` 只接taskId。实际conversation sidebar和group/tab header不因已有16个旧slot而完成覆盖；当前group/tab header只见内置Close，未见pane/tab actions slot。

## 后继接口与验收

在统一P01 registry内定义与真实conversation及稳定view身份匹配的小上下文/command；连接scope及成员校验仍属私有宿主。不能拿conversationId冒taskId，不能拿latest-turn权限冒整chat权限。关闭的sidebar行仅显示/动作授权不应强制创建view、加载历史或正文。

用真实ConversationList的sample按钮与组合pane菜单验证无需修改核心即可贡献及禁用；核跨连接、closed、hidden、旧task兼容，以及来源view明确绑定。MATURE05布局/焦点/草稿验收保留，不能用reducer或slot计数替代实际App旅程。

App、types、validation当前由STEIRI01唯一writer持有；此处仅记录后继，待其释放或精确amend后才能实施，不扩大当前13scope。尚无新browser复现、运行时失败判定或产品变更。
