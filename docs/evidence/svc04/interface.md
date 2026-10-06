# SVC04 首接口与不变量

`publishPreviewWeb({directory, artifact, expectedVersion, expectedBackendHead, compatibilityId})`、`rollbackPreviewWeb({...})`、`bootstrapPreviewWeb({...})`；操作由现CLI显式进入，加载现私有配置、复用同operation.lock。bootstrap只更新Web进程持有，publish/rollback只原子更新Web release指针。center/runner的PID/source、DB/token/profile/native目录及maintenance gate均不改。

`web-release.mjs`拥有有界release文件格式/CAS/当前与保留artifact集合、精确asset索引；`web-artifact.mjs`继续拥有可信冻结构建和完整文件集验证；`static-web.mjs`只读release快照、路由文件并复用loopback API/SSE proxy；`preview.mjs`组合原有私有配置/锁/owned process。无第二registry/scheduler。

新格式在build之前固定release ID/asset namespace，在build之后才算manifest digest，避免digest-base循环。现v1仅作为一个已验证legacy资产集合保留；同旧URL异内容碰撞拒绝，不猜hash文件名。未知namespace/path返回404，不退SPA HTML或任意文件。目录/路径逃逸、symlink、元数据损坏均拒绝。

最多3个保留artifact、总192MiB，每artifact仍受64MiB上限。新发布先验证预算，满额不发布；无自动TTL删除。回退只选已验证保留项；显式清理不得删除current/rollback所需项，且必须确认旧页面已关闭，不能从无请求推断。未提供清理时满额由明确后继解除，不能静默复用旧路径。

兼容采用固定产品协议 `flow-web-api-v1` 的本机测试记录：精确 backend source + 完整Web artifact descriptor；四项检查read/send/recover/negotiation不可缺，分别有固定布尔观察项和原始JSON SHA256。`importPreviewCompatibility({directory,reportDirectory})`核结构、组合、原始bytes/hash并导入不可变记录；publish/rollback引用compatibilityId。任意文字evidence、缺项/失败项/未知组合/变更原始证据均拒绝。源码加法差异本身不构成不兼容，不要求全部client/contracts相等。

记录是可信本机测试执行者的结构化声明，不是数学语义证明或对所有未来Web路径的承诺；这里只覆盖本产品读取、普通发送、同key恢复和协商。fixture实际执行这四类HTTP消费并把固定结果绑定Web artifact；不为现有personal安装自动签发记录。后台升级前，每个保留artifact也需该新backend的明确记录，否则在停止进程之前拒绝。记录最多32个，满额拒绝、不静默删历史。

错误边界：build/校验/预算/CAS/兼容失败发生在指针变更前，旧服务保持；指针未知先核原版本，禁止盲重放不同发布。首次Web-only进程替换若无法确认，报告Web unknown并保留旧artifact/source/operation事实，不牵连后台角色，不自动回滚数据库。旧页面不被主动reload，代理观察断线按既有游标恢复；不承诺无限保留未声明旧tab。
