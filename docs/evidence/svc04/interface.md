# SVC04 首接口与不变量

`publishPreviewWeb({directory, artifact, expectedVersion, expectedBackendHead, compatibility})`、`rollbackPreviewWeb({...})`、`bootstrapPreviewWeb({...})`；操作由现CLI显式进入，加载现私有配置、复用同operation.lock。bootstrap只更新Web进程持有，publish/rollback只原子更新Web release指针。center/runner的PID/source、DB/token/profile/native目录及maintenance gate均不改。

`web-release.mjs`拥有有界release文件格式/CAS/当前与保留artifact集合、精确asset索引；`web-artifact.mjs`继续拥有可信冻结构建和完整文件集验证；`static-web.mjs`只读release快照、路由文件并复用loopback API/SSE proxy；`preview.mjs`组合原有私有配置/锁/owned process。无第二registry/scheduler。

新格式在build之前固定release ID/asset namespace，在build之后才算manifest digest，避免digest-base循环。现v1仅作为一个已验证legacy资产集合保留；同旧URL异内容碰撞拒绝，不猜hash文件名。未知namespace/path返回404，不退SPA HTML或任意文件。目录/路径逃逸、symlink、元数据损坏均拒绝。

最多3个保留artifact、总192MiB，每artifact仍受64MiB上限。新发布先验证预算，满额不发布；无自动TTL删除。回退只选已验证保留项；显式清理不得删除current/rollback所需项，且必须确认旧页面已关闭，不能从无请求推断。未提供清理时满额由明确后继解除，不能静默复用旧路径。

兼容必须匹配实际backend source以及明确已验证的公共API合同输入，不能只health/ancestor。拟按固定contracts/client公共源码摘要与backend已加载提交逐字核验，兼容声明记录验证依据；这不是对任意后端实现语义的自动证明。细节在实现前固定，未知/缺证据不切换。

错误边界：build/校验/预算/CAS/兼容失败发生在指针变更前，旧服务保持；指针未知先核原版本，禁止盲重放不同发布。首次Web-only进程替换若无法确认，报告Web unknown并保留旧artifact/source/operation事实，不牵连后台角色，不自动回滚数据库。旧页面不被主动reload，代理观察断线按既有游标恢复；不承诺无限保留未声明旧tab。
