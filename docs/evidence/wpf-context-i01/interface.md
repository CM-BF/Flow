# 实际聊天知识接线

固定基线 d7e1e64e7792f4d1ad4933db042f10f266ad0cca，受领二十范围。所属 WPF-MATURE-03 附件 / 版本绑定大 task；本片是知识引用前置，不代表上传、拖入、@file、runner 文件已经支持。

## 用户旅程

Knowledge 是 P01 的真实 composer button；独立 typed `chat.composer.context` panel 复用同一 host 的 load / activate / disable / dispose。项目默认 None，每次最多 40 条 / 一个页面，Next projects 明确翻页、保持前页选择，不伪装全目录搜索。目录请求单 flight / 15 秒截止，忽略 abort 的 port 也本地结算；旧页及选择在失败后保留。

显式 Prepare 使用 ConversationOutbox 的 `kind: creation` receipt（request=null），冻结创建 profile/project，零 turn/model。unknown CREATE 重试同 creationKey；正确 ACK 设置 snapshot + project/profile 锁，首条 Send 使用已建 ID；已有无项目会话不补 project。已拒绝、从未 unknown 的创建可明确重新选择；unknown 不允许伪装失败解锁。

CONTEXT01 的 selection/controller/ContextPicker 完全只读复用：4 refs / 8192 UTF8 locator bytes；search 20 hits / 256 query bytes / 512B excerpt；resolve 4096B，1 search + 2 body flights / 8 cache / 15秒截止。citation 是整 chunk 引用，excerpt 仅短预览；只有显式展开 resolve。不验证 chunk SHA 等于整版本摘要，不自动升级引用。

## 权限与生命周期

App 持有 FlowClient，插件拿不到它。私有 KnowledgeIdentity = connectionId / stable View.key / conversationId / projectId；public composer viewId 仅 UI 位置。P01 唯一 manifest 声明 ui.layout、workspace.read、knowledge.read；每次读取前后检查 host active / typed panel、session、实际 App view、conversation/project、visible、online。准备前无 knowledgeContext 广告，不猜测服务器支持；正确 CREATE/GET true 后才读。project metadata 与 knowledge 读取检查分别走 workspace.read / knowledge.read；不新增安装/授权数据库。

原生 hidden 显式 configure(false)，不是假设 React Activity 清 effect；split 两个当前 pane 独立可见。关闭 picker 停读但允许已授权固定 refs 冻结。hide/offline/disable/close/epoch 中止读 controller 的 flight，旧响应不能回填；不停止已受理中心任务。缓存与选择跟现 App View/session 寿命；同 session 路由重命名复用 View.key，新连接整套 binding 释放。

## 草稿与请求

Outbox/Queue request parse 后通过既有 CONTEXT02 helpers 深冻结；发送 guard 已接到真实 `submitConversationTurn` ACK，queue 原 guard 继续使用。完整来源 tuple / 顺序 / byteLength 与已声明 metadata 不一致保持 unknown / 原 key；缺省与 [] wire 形状保留；纯文本接受无 context 或合法 sources=[]，拒意外新增 sources。

`ConversationKnowledge.capture` 同步记录 controller、selected 数组 identity、detach frozen refs。只在同一提交栈观察到新本地 receipt ID/key 后 consume 一次，网络 ACK 从不清选择或文本。相同 citation 删除再选产生新数组代际；正文/cache/ready 更新不改变代际。创建 prepare 不消费草稿。async method 首 await 前错误仍是 rejected Promise：调用者检查真实 receipt，并处理异步失败；无 handoff 可局部 MessageNotSentError，handoff 后失败只留 receipt，不让 assistant-ui 把旧文本 prepend 到新稿。

中心还会检查合成执行输入预算；预算拒绝保留旧 receipt 中的文本/refs，新草稿/refs 独立，不自动截断或丢来源重发。receipt 未决信息只保留本页面，重载不会恢复未确认 local receipt（沿现产品限制）。

## 保护与未验证

旧 CONTEXT01/02 helper、ProfilePicker、ConversationQueue、官方 Thread、stream、shared/client、manifest/lock 零修改。后端/provider SDK 可替换，Web 仅消费通用 profile/capabilities；没有新增 provider SDK 或凭据接口。真实中心/模型/数据库、完整文件附件、刷新后草稿持久化、Safari/Firefox/屏读未验。
