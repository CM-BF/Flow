# ATTACHI01 Interface

固定输入8701a6cf547248e70aa5758f05da1d7d314ae9c0的packages/contracts/src/attachments.ts。公共index/client未发布，首片直接复用这个本树固定Module，绝不复制DTO/HTTP/ACK解析。typed ports由宿主注入并已验证其HTTP回执；Module仍核当前绑定/ref/order/bytes及真实text digest，不把TypeScript当授权。未来FlowClient六方法是后继适配层，当前无stub。

Controller绑定不可变connectionKey/viewId/projectId，暴露稳定subscribe/getSnapshot、显式readiness、目录/选择/预览、upload/recover、capture/consume/dispose。visible/online/read/write只限制现view动作，不赋权限；dispose只表示宿主最终销毁绑定，不等于用户关闭tab。未发送ready选择属于protected draft，宿主关闭view应先停读并保留绑定，只有唯一session/view owner确认可回收后才dispose；换连接/撤销旧授权仍必须失效旧引用。hide/offline/revoke使旧epoch无效并settle本地请求，不保证取消中心commit。未知upload保留原key/body identity，不能从abort/404推定未受理。

Recovery只存scope/project/key/name/type/byteLength/contentDigest及可选已核ref等有限元信息；16条/64KiB，不存File/text/token。容量不足在POST前报错，unknown不silent eviction。用户显式lookup，同scope/project且读权限成立才读；不存在仍unknown，重选完全相同bytes/name/type后原key/fullbody重试。found不自动附新稿，expired/unavailable不允许新capture。namespace不是principal，认证仍宿主提供。

官方AttachmentAdapter add先处理上传至ready后yield requires-action，send只转换metadata-only CompleteAttachment(content=[])；原始全文绝不注入message.content。complete的@file路径绕send，因此onNew前capture统一复核ids来自当前controller、固定refs、ready/expiry和conversation project/cap。空refs不注入attachments字段。后继真实outbox同步产生newreceipt后才consume选中代际；网络ACK不清新draft。fixture只证明capture，不调用现纯text Send/Queue。

Module无定时poll。单飞upload/list、2并发正文，15秒本地deadline即使port忽略abort也结算；当前页20条，正文4×8KiB。selection≤4，合计knowledge+attachments≤4/8192；中心最终准入和整个prompt预算仍权威。元数据默认，展开才正文，HTML文本转义。文件仅UTF8 .txt，保BOM/CRLF/空格；hash对完整upload正文有效，勿套用knowledge全版本hash到chunk。

首片复用官方Thread的ComposerActions/composerInputOnKeyDown与AttachmentDropzone/add/remove；@file列当前project上传资源，不冒充runner filesystem。安装版本react0.15.23/core0.3.22不升级。六client方法、HTTP、生产App/plugin绑定与shared v2 decoder/Send/Queue实际消费均pending。

恢复journal不是已选草稿自动恢复，也不是Send/Queue unknown重启恢复。宿主必须为同一storage namespace提供串行journal owner；本片不宣称跨tab存储原子协调。fixture在一次提交的同步点击栈capture intent/text/有序refs，adapter异步准备后只验证同一个token；真实App未来接线仍需补同样捕获时点，不能从onNew当时的可变意图重建。

## 导出和宿主消费

`controller.ts` 的 `createAttachmentInput` 返回 `AttachmentInput`：稳定`subscribe/getSnapshot`，显式`setReadiness/browse/upload/select/remove/preview/recover/forgetRecovery`，`capture/assertCapture/consume`与终结`dispose`。`recovery.ts`导出有限`createRecoveryJournal`，storage由host注入并序列化；known记录可显式forget，unknown禁止丢弃。`adapter.ts`导出`createAttachmentAdapter`、`createExistingAttachment`、`bindAttachmentComposer`，后者只跟踪实际公开composer曾持有的ID，不能删除尚在准备的独立恢复上传。`AttachmentPicker`只接input和onAttach/onRemove窄回调，Dialog/焦点与P01 authority由host拥有。

公共ports读回已通过中心decoder验证的值，本Module再次核ref/metadata绑定。upload receipt的requestDigest是中心对完整请求的标识，本片不虚称独立重算；恢复依完整不可变请求identity与原字节内容digest。一个绑定最多5个逻辑flight（upload/list/recovery各1、body2），每个内部capabilities读取有同一deadline，后续使用该绑定的缓存cap；新授权/connection由新代际或新实例提供，不能缓存token/权限。

生产接线必须在官方composer开始异步附件准备之前冻结click intent/text/knowledge/attachment IDs，onNew只验证该一次capture，不读取后来改变的intent/profile/knowledge。只有新outbox/queue receipt实际同步接管后consume；其后异步失败保留receipt/旧稿并与新稿分离，不能让MessageNotSentError自动拼回旧text。fixture演示失败capture单列，而未实现真实生产receipt恢复。
