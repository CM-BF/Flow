# CONTEXT02 receipt interface

本片准备接收接口，不接当前 UI。`OutgoingConversationTurn.knowledge` 与 QueueCommand enqueue input 增加可选 readonly citation[]；解析后引用、locator、数组与 request 均深冻结，旧 unknown 重试保留原 key 和同一 request。

`receipts.ts` 集中两件事：复用 selection.freezeContextSelection 对可选 knowledge 克隆/校验/深冻结；核对 context ACK 的 sources 与请求引用的完整 tuple 和顺序。Send helper 供后继 projection 在 accept/bind 前调用，当前 projection 不修改。Queue 在既有 receiptMessage 的 identity/text 校验后实际调用共享 guard。

知识为空的兼容行为和额外 ACK metadata 校验将由固定合同/现 reader 行为证据确定，不自创 capability。仅预校验同 project 与引用限额；已建 conversation project 与 knowledgeContext gate 由后继宿主绑定，不从首项目或 API 存在猜测。CREATE 的 projectId 已有则本片可校对引用与冻结 creation 一致。

后继必须接 conversations/projection.send + queue/projection.enqueue 两入口，保留原新草稿而不在旧回执完成后清空；创建项目/模型配置在 CREATE unknown 后锁定。core0.3.22 异步 MessageNotSentError 会把旧文本 prepend 到新草稿，不能盲目用于异步预算拒绝；后继显式恢复单独处理。本片无 runtime 接线。
