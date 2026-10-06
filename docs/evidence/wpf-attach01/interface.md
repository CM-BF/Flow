# ATTACH01 text-v1 Interface（root已冻结设计；phase1合同先行）

模块唯一职责：表达中心发布的固定文本附件身份、可发现边界、恢复receipt与context v2。它不发HTTP、不持有token/权限、不承担上传/GC或runner状态。运行模块将在独立amend后复用既有owner auth/project/commandInTransaction/context输入。

## 类型与预算

首支持UTF-8 .txt / text/plain，原字节1..8192（空/非法surrogate/NUL拒绝）；fatal decode后encode必须与原bytes相同，保留BOM、CRLF、空格，不trim/NFC或截断。名称仅纯显示文本，拒路径分隔/control。浏览器File只在本地；wire是有界text，metadata/timeline无text/base64/blob URL/绝对路径。

UploadReference={kind:'upload',projectId,resourceId,version:1,contentDigest}；元数据另含name/mediaType/byteLength/createdAt/expiresAt/state/retained。改文件是显式新resource。能力公开protocol text-v1、types/extensions/file bytes、requiresProject、合计4引用/8192原bytes、knowledge-then-attachments顺序、24h未绑定TTL、128项/1MiB初始live+retained资源限额。不是模型能力。旧center缺能力/false不得启用；网络失败=未知。

## HTTP（后继typed client/mount由Lead唯一writer接线）

- GET /api/projects/:projectId/attachments/capabilities：授权project能力与recoveryScopeId。
- POST /api/projects/:projectId/attachments：Idempotency-Key为1..200 visible ASCII（不含空白），不trim/Unicode规范化；body={recoveryScopeId,name,mediaType,text,byteLength,contentDigest}；事务commit才ready。
- GET同集合?q&after&limit：有界ready元数据，limit至多20；nextCursor不是全量总数。
- GET /api/projects/:projectId/attachments/:resourceId：当前metadata。
- GET /api/projects/:projectId/attachments/:resourceId/versions/:version/content?digest=…：显式授权正文，返回完整reference；原bytes至多8192、encoded响应至多65536。
- GET /api/projects/:projectId/attachments/upload-receipt?scope=…&key=…：按原key读取已提交receipt与当前可用状态。404只表示当前没有可见committed receipt，不证明原POST不会稍后完成。

后继conversation capability新增attachmentContext?:boolean，缺失false。项目cap可在创建conversation前读取/上传；Send/Queue必须conversation.projectId相同且实际cap已确认。现仅单owner权限域，owner端读写沿同一认证，runner凭据拒绝；不虚构独立read/write角色。

## 恢复、生命周期与错误

recoveryScopeId是DB初始化opaque namespace，不是principal/凭据/授权；token轮换仍同owner域，未来多owner另做主体绑定。客户端持久化仅有限scope/key/ref/digest/name/type/bytes元信息，不存token/File/text；容量失败在POST前可行动。reload只显式恢复upload，不自动附到新稿/Send/Queue。lookup未命中需用户重选完全相同bytes及原metadata，原key/fullbody重试，绝不freshkey猜受理；Send/Queue跨reload未决receipt仍既有page-local限制。

pending是客户端未获事务结果，没有虚构中心后台processing行。upload command按canonical完整请求持久幂等，重启返回原resource；已有receipt不因TTL变成新资源。首次Send/Queue在幂等replay之后原子pin与冻结。锁序operation-key→conversation（适用时）→project→resource IDs排序；cleanup只project→同resource顺序、不反向锁task/conversation。仅过期未绑定新资源可清；in-use/audit资源和knowledge_sources/versions不删。command receipt保留原key墓碑；TTL到期未回收时current为expired；GC后lookup返原ref+unavailable，metadata404不代表从未受理。全pinned达到128/1MiB明确拒新增；现全局command journal尚无GC，不声称永久元数据全部有界回收。draft remove本地，queue取消不unpin。

失败类：400 invalid_attachment_request/invalid_attachment_text/attachment_digest_mismatch；413 attachment_too_large/conversation_context_budget；415 attachment_type_unsupported；404 attachment_not_found/attachment_upload_receipt_not_found；409 attachment_scope_mismatch/attachment_reference_mismatch/conversation_project_required/attachment_budget/idempotency_conflict；410 attachment_expired；401/403不洗白此前unknown。

## context v1/v2 与授权runner

无attachments或[]维持原template1；知识也为空则无context。仅非空attachments用template2，strict discriminated reference含order=knowledge-then-attachments、sources[]知识metadata、attachments[]固定metadata；各段保持请求顺序，总数≤4、原bytes≤8192。旧v1字段/算法/guard不松。v2 digest包含版本/顺序/引用及exact正文，executionInputDigest含userText/template2/编排prompt；prompt仍≤16000codeunits/49152bytes。metadata无正文，contextDetail授权按需可含正文。

公共ACK校验由F01/TUI/Web同一合同消费，必须核完整有序refs/bytes/context身份；不以长度或digest存在冒充匹配。后继freezeContext/private executionInputForTask复用现中心权威，queue promotion/recovery沿原input；runner通过授权claim获得private prompt，不增任意文件读取或provider SDK耦合。018原不可变trigger不放宽，026已预留，写权未领取。upload、knowledge、runner file分型；首片runner file/PDF/image均unsupported。

## 验证与非目标

phase1仅pure schema tests和类型消费者。后继PG/HTTP含原bytes/BOM/digest、元数据0正文、失ACK/restart/同key、lookup404并发commit、pin与expiry/cleanup两种时序、quota并发、in-use/audit不删、队列重启promotion/recovery，以及实际authorized claim→通用fake HarnessAdapter收到冻结材料。0provider；不能将phase1视作后端/App已接通。

## 当前可消费导出与兼容决策

`attachments.ts` 导出 request/reference/descriptor/metadata/capability/receipt/lookup/list/content 的严格 schema 与相应类型、`ATTACHMENT_LIMITS`、局部 `ATTACHMENT_ERRORS`。`decodeAttachmentText` 保原 UTF-8 字节；`assertAttachmentTextDigest` 是必须额外调用的实际 SHA-256 校验，schema 的 digest 正则不代表内容已核。异步调用方在返回后仍须核自己 generation/授权；helper 不管理生命周期。

`conversation-context.ts` 保留原同名类型兼容 v1，新增 V1/V2 discriminated reference、v2 detail、`conversationContextReferenceSchema`、`conversationContextResponseSchema`、`conversationContextTemplate` 与 `parseAttachmentContextReceipt`。后者仅处理本次非空附件 v2：expected.attachments是序列化frozenAdmission中的完整ordered references；expected.descriptors可选，由持有已验证upload receipt的caller额外提供；外层 conversation/turn/task/queue 身份、幂等 key 和权限仍由调用方先验。v1 请求继续现旧 guard，不因新 helper 而放宽。

Root 已收敛为无需额外媒体协议协商：仅本请求非空 attachments 产生 v2；无附件/[]保持 v1（知识也无则无context），不能按 conversation/project 整体升级。原 key 的持久 v1 ACK 永远原样重放。新 Web 对旧 center 无 capability 时禁附件，纯文字请求必须**省略** attachments 字段；旧 strict schema 连 [] 也拒绝。

实际 f181 旧 Web GET history/queue 可保留 v2 metadata 并显示普通正文，没有附件显示能力；不能声称旧 loaded JS 完整展示附件。其 Send/enqueue guard 只认可自己请求的 v1；错误 v2 ACK 必须 unknown/原key重试，不能伪装成功或确定拒绝。未引入 Accept/header、整页 GET 阻断或删字段冒 v1。新的 shared decoder/客户端序列化和 backend admission 是 runtime 后继，phase1未接生产 capability。

测试直接导入本树与 f181 字节相同的 ConversationProjection、QueueCommands、ConversationQueueProjection、conversationMessages 和 FlowClient；只有 fetch 响应为 fixture，不手写旧 guard。源码/检查来源在 resource-checks.json。F01 受控发布 export/client 时按上述真实消费矩阵接入，本owner不抢写 index/client。


共享 ACK decoder 对齐：`conversationContextReferenceSchema` 是中心 producer 严格输出约束；`conversationContextResponseSchema` 是消费者已知字段投影。同一结构/locator/source/合计规则复用，context、source、citation、locator、descriptor、upload reference 的未知附加字段逐层忽略，已知 identity/order/version/bytes/name/type 不放松。返回对象不保留额外正文或未知字段。`parseAttachmentContextReceipt` 内部走 consumer projection，故TUI/F01无需先复制一套strip规则，不会出现外层承诺additive、内层又严格拒额外字段的矛盾。expected冻结引用与生产请求仍严格，可选descriptor只投影四个已知展示字段后校验，未改旧v1 guard。


公共 ACK 调用约定（TUI001-09/F01/Web共用）：

```ts
parseAttachmentContextReceipt({
  projectId,
  knowledge: frozenAdmission.knowledge,
  attachments: frozenAdmission.attachments,
  // 可选：只有持有已核upload receipts的caller才提供；共享decoder不得推造。
  descriptors: verifiedUploads?.map(upload => upload.resource),
}, response.context)
```

必选refs核全project/resource/version/contentDigest与请求顺序；响应name/type/bytes均经公开结构与合计预算校验，但name不是执行身份，bare refs不能证明预先知道其值。可选descriptors增加精确name/type/bytes比较，其ref和长度还必须对齐同一ordered request。完整AttachmentMetadata可直接作descriptor输入，先投影reference/name/mediaType/byteLength，createdAt/state等不进入回执比较也不导致拒绝。shared decoder无需第二ACK实现。调用方仍先核外层身份和当前授权，helper不授权限。
