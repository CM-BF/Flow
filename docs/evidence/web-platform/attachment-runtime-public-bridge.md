# ATTACH01 已审运行域公共桥接输入

来源：workspace_panels_owner 对固定 da04127fd0c033135d20657742979845e1b80a63 只读核查，c450c2da7e6185b88db9f46e0299ee504ee6f3e8 相关源码相同；root 已审 runtime 8701a6cf547248e70aa5758f05da1d7d314ae9c0，final 1d236cbe2299117e3b63887fda3d1c0e140f56b0。以下是给唯一公共 writer 的输入，不是本管理或 Web 的写许可。ATTACH worker不写共享出口。

1. `packages/contracts/src/index.ts` 仅补 export attachments.js；context 出口已有，8701 已含 optional 请求字段、union/cap。
2. `packages/client/src/conversation-acknowledgement.ts` 保 v1 guard；按冻结请求 nonempty attachments 分派现 `parseAttachmentContextReceipt({projectId,knowledge,attachments},wire)`，返回已知字段投影；省略/[]仍v1，错误统一 UnknownConversationAcknowledgementError。项目、有序完整 ref、结构/预算严格；optional descriptors只由实际持有验证upload receipt的caller加严，不能伪造name/bytes。capability支持missing/boolean attachmentContext，CREATE持久原receipt不能混GET当前cap。
3. `packages/client/src/index.ts` 保实际HTTP body快照→同decoder。六窄方法候选：attachmentCapabilities(projectId)、uploadAttachment(projectId,input,key)、attachments(projectId,{after?,limit?,q?})、attachment(projectId,resourceId)、attachmentContent(reference)、attachmentReceipt(projectId,{scope,key})；均signal+既有owner transport，精确路由以runtime Interface为准。upload invalid200/非JSON为unknown，核原body/key/namespace/ref/digest；lookup404不证明未受理。
4. enqueue暂无共享整个ACK decoder。最窄公共导出同一版本分派context入口给queue wrapper，复用其outer identity/text/sequence；若收拢整enqueue也仅一个ACK模块。ACK01已审2fa8删除Web turn重复guard，请从实际接收输入核，不重复派turn补丁；queue wrapper仍需消费新公共版本。Web不另造v2验码器。
5. `apps/server/src/index.ts` 引 migrateAttachments/registerAttachmentRoutes；026在project/knowledge/context后、scheduler/listen前；routes在现owner hook下/listen前，无新timer。生产createApp入口需直接专测，独立fixture注册不代替mount验收。
6. 局部测试：公共ack测试覆盖v1/[]/nonempty v2/additive/错orderedref/预算/invalid200；client conversations/queue测试实际序列化和原key/body；新attachments专测六路由、编码、signal、upload/lookup身份；唯一mount owner专测生产入口。UI owner消费公开固定输入后跑原projection/outbox/queue真实函数：旧GET正文可读但不展示附件，坏v2ACK保unknown原key、新draft独立、everUnknown后4xx不洗白。无需Accept/header/GET阻断/伪v1降级，不重复PG或模型。

公共合同/方法/decoder/mount尚待共享owner固定实现和独审；ATTACHI只可准备新模块/fixture精确scope，不能把本提案当已public-ready。backend PG/HTTP78独审与App附件端到端验收分开。
