# ATTACH01 text-v1 Interface（root已冻结设计；phase1合同先行）

模块唯一职责：表达中心发布的固定文本附件身份、可发现边界、恢复receipt与context v2。它不发HTTP、不持有token/权限、不承担上传/GC或runner状态。运行模块将在独立amend后复用既有owner auth/project/commandInTransaction/context输入。

## 类型与预算

首支持UTF-8 .txt / text/plain，原字节1..8192（空/非法surrogate/NUL拒绝）；fatal decode后encode必须与原bytes相同，保留BOM、CRLF、空格，不trim/NFC或截断。名称仅纯显示文本，拒路径分隔/control。浏览器File只在本地；wire是有界text，metadata/timeline无text/base64/blob URL/绝对路径。

UploadReference={kind:'upload',projectId,resourceId,version:1,contentDigest}；元数据另含name/mediaType/byteLength/createdAt/expiresAt/state/retained。改文件是显式新resource。能力公开protocol text-v1、types/extensions/file bytes、requiresProject、合计4引用/8192原bytes、knowledge-then-attachments顺序、24h未绑定TTL、128项/1MiB初始live+retained资源限额。不是模型能力。旧center缺能力/false不得启用；网络失败=未知。

## HTTP（后继typed client/mount由Lead唯一writer接线）

- GET /api/projects/:projectId/attachments/capabilities：授权project能力与recoveryScopeId。
- POST /api/projects/:projectId/attachments：Idempotency-Key；body={recoveryScopeId,name,mediaType,text,byteLength,contentDigest}；事务commit才ready。
- GET同集合?q&after&limit：有界ready元数据，limit至多20；nextCursor不是全量总数。
- GET /api/projects/:projectId/attachments/:resourceId：当前metadata。
- GET /api/projects/:projectId/attachments/:resourceId/versions/:version/content?digest=…：显式授权正文，返回完整reference；原bytes至多8192、encoded响应至多65536。
- GET /api/projects/:projectId/attachments/upload-receipt?scope=…&key=…：按原key读取已提交receipt与当前可用状态。404只表示当前没有可见committed receipt，不证明原POST不会稍后完成。

后继conversation capability新增attachmentContext?:boolean，缺失false。项目cap可在创建conversation前读取/上传；Send/Queue必须conversation.projectId相同且实际cap已确认。现仅单owner权限域，owner端读写沿同一认证，runner凭据拒绝；不虚构独立read/write角色。

## 恢复、生命周期与错误

recoveryScopeId是DB初始化opaque namespace，不是principal/凭据/授权；token轮换仍同owner域，未来多owner另做主体绑定。客户端持久化仅有限scope/key/ref/digest/name/type/bytes元信息，不存token/File/text；容量失败在POST前可行动。reload只显式恢复upload，不自动附到新稿/Send/Queue。lookup未命中需用户重选完全相同bytes及原metadata，原key/fullbody重试，绝不freshkey猜受理；Send/Queue跨reload未决receipt仍既有page-local限制。

pending是客户端未获事务结果，没有虚构中心后台processing行。upload command按canonical完整请求持久幂等，重启返回原resource；已有receipt不因TTL变成新资源。首次Send/Queue在幂等replay之后原子pin与冻结。锁序operation-key→conversation（适用时）→project→resource IDs排序；cleanup只project→同resource顺序、不反向锁task/conversation。仅过期未绑定新资源可清；in-use/audit资源和knowledge_sources/versions不删。command receipt保留原key墓碑；GC后lookup返原ref+expired，metadata404不代表从未受理。全pinned达到128/1MiB明确拒新增；现全局command journal尚无GC，不声称永久元数据全部有界回收。draft remove本地，queue取消不unpin。

失败类：400 invalid_attachment_request/invalid_attachment_text/attachment_digest_mismatch；413 attachment_too_large/conversation_context_budget；415 attachment_type_unsupported；404 attachment_not_found/attachment_upload_receipt_not_found；409 attachment_scope_mismatch/attachment_reference_mismatch/conversation_project_required/attachment_budget/idempotency_conflict；410 attachment_expired；401/403不洗白此前unknown。

## context v1/v2 与授权runner

无attachments或[]维持原template1；知识也为空则无context。仅非空attachments用template2，strict discriminated reference含order=knowledge-then-attachments、sources[]知识metadata、attachments[]固定metadata；各段保持请求顺序，总数≤4、原bytes≤8192。旧v1字段/算法/guard不松。v2 digest包含版本/顺序/引用及exact正文，executionInputDigest含userText/template2/编排prompt；prompt仍≤16000codeunits/49152bytes。metadata无正文，contextDetail授权按需可含正文。

公共ACK校验由F01/TUI/Web同一合同消费，必须核完整有序refs/bytes/context身份；不以长度或digest存在冒充匹配。后继freezeContext/private executionInputForTask复用现中心权威，queue promotion/recovery沿原input；runner通过授权claim获得private prompt，不增任意文件读取或provider SDK耦合。018原不可变trigger不放宽，新迁移编号未领取。upload、knowledge、runner file分型；首片runner file/PDF/image均unsupported。

## 验证与非目标

phase1仅pure schema tests和类型消费者。后继PG/HTTP含原bytes/BOM/digest、元数据0正文、失ACK/restart/同key、lookup404并发commit、pin与expiry/cleanup两种时序、quota并发、in-use/audit不删、队列重启promotion/recovery，以及实际authorized claim→通用fake HarnessAdapter收到冻结材料。0provider；不能将phase1视作后端/App已接通。
