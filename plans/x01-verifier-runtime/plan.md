# X01-VERIFIER-RUNTIME01

所属大task：[X01](../../../plugin-enable-binding/plans/x01-plugin-management/plan.md)；co-lead mika；owner db_transaction_owner。

- [x] X01VR-01 固定实际主线/配置交权与精确claim。
- [x] X01VR-02 v4真实runRunner消费验证器执行、两阶段授权与typed outbox。
- [x] X01VR-03 恢复后单次PROCESS初始化与取消/UNKNOWN，直接局部检查。
- [ ] X01VR-04 固定独审/登记/主线接收。

接口：显式pluginExecution.verifier包含精确trustedAlgorithms与可选toolExecution；无配置保原v2/v3。bind→recover→bind→unresolved/capacity→单次PROCESS open→publish/initialized/claim；失败stop保原错，旧资源不接管。已持久terminal可先重报，未知结果不得重执行；不声称PG/公开整链或T7完成。
