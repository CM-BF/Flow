# ENG01D 固定Interface

A：HarnessContext新增可选 `readonly executionIdentity?: Readonly<{taskId:string;attemptId:string;ownerVersion:number;runnerId:string}>`。runtime只从实际assignment一次复制构造，Object.freeze值且context属性不可写/不可配置。它不提供token、client、release、journal、grant。旧独立fixture手写context可省略；未来需要身份的新consumer在缺失时dispatch前unsupported，不能猜测。不新增native writer消费者或扩授权，现assertOwnership仍唯一租约核验。

B：`runOrdinaryCodexTurn(profile, trustedTransportFactory, {prompt,workingDirectory,signal,assertOwnership}) -> ordinary assistant-final`。profile是配置层已校验的有限Codex普通profile，factory仍受信显式注入；Module唯一拥有现receive pump、请求顺序/ID绑定/deny/timeout/close/unknown，返回已核final，不emit、不持有outbox/claim/journal。不传整个HarnessContext，adapter在其外保留现任务purpose检查及session/final/text artifact/verification事件映射。旧adapter导出的factory类型维持，public descriptor/index无需改动。提取保持原body语义，不添加新工具/自然通知兼容。

仅静态结构与注入直接消费者可验，真实factory/0.154自然通知仍依赖Mika；不启动诊断、账户或模型。首真实native工程验收不能被host-applied calculator替代。其实际停止、checker stdout伪证/后台写入隔离和>=Sol资格都未被本片关闭。
