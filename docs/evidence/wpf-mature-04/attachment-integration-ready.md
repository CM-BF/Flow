# 附件上下文历史兼容修复接收入口

唯一机器可核输入：[attachment-integration-ready.json](attachment-integration-ready.json)。固定实现 `4f87934f585b8241faa7cdb76b79a202fd353b6f`；Mika独审APPROVED，21不同+strict0。仅按该两源接收，不能用metadata HEAD替代实现target。

附件v2材料unknown但真实executionInputDigest/历史sample保留；不新增附件材料DTO或current/remaining声明。旧producer已main，本修复尚待主线接收。既有Web消费者交接见[handoff-current](handoff-current.md)。
