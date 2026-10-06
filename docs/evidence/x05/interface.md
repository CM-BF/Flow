# X05 首 Interface（901699d 合同，列表收敛为轻摘要）

共享consumer可用的名称：PackageFetchRequest/Command/Accepted/Operation/Attempt/Audit/History/List、packageFetchRequestSchema/packageFetchCommandSchema、PACKAGE_FETCH_LIMITS。owner routes沿createServer已有鉴权preHandler；runner token不能受理/命令。

| 路由 | 输入 | 输出 |
| --- | --- | --- |
| POST /api/plugins/:id/versions/:versionId/fetch | expectedRevision,integrity,registryRef；稳定Idempotency-Key | 202 {operationId,attemptId,replayed} |
| GET /api/package-fetches/:id | 无 | PackageFetchOperation，最多3attempts；可选验证receipt |
| GET /api/plugins/:id/package-fetches | after=UUID，limit默认20/max40 | PackageFetchList，轻摘要不含attempts/artifact正文 |
| GET /api/package-fetches/:id/history | after=整数cursor，limit默认20/max40 | PackageFetchHistory，events+nextCursor |
| POST /api/package-fetches/:id/commands | {action:retry或reconcile,reason}；稳定key | 202 accepted；不直接跑网络 |

id未知404；输入/游标/key非法400；版本CAS/宿主错误/不允许状态/额度/同key异输入409；未认证401、runner403；body最大4096B、响应64KiB。受理缓存仅稳定ID，状态通过GET重新取，重放不冒称当前仍queued。

Module exports：migratePackageFetches(pool)；registerPackageFetchRoutes(app,pool,host)；startPackageFetchWorker(pool,host)→Promise<{wake():void,stop():Promise<void>}>。host={storeId,root,registries:{ref:{url,allowInsecureLoopback?}}}，root/URL完全来自可信宿主。schema无URL/路径/凭据输入。注册路由不自动创建worker；生产Lead先migrate、注册、启动worker，再onClose先await worker.stop后关pool。模块不用额外broker，持久queued行+短扫描/本地wake；默认1并发，PG专属session锁同store跨进程互斥。

FSM：queued→running→succeeded/failed/interrupted；重启running→本地校验（有已知receipt则succeeded，否则interrupted/failed），绝不在恢复路径重新发GET。显式reconcile从failed/interrupted→recovering→只读artifact核对；显式retry从failed/interrupted创建新attempt与artifactId→queued，最多3次attempt。所有状态变更伴审计，同key只恢复受理。停止/失去专用PG锁连接时abort当前下载，原尝试不自动重复。

每次尝试先PG持久分配artifactId，X04同ID原子目录发布；重启按已知ID+name/version/SHA512/声明SHA256/source URL核验。rename后PG/ACK/cleanup失败可以补录，未知不是未发布。不同store不能执行/重试/reconcile该操作。root是center本机私有文件，runner/其他center只能看登记事实，不能据此加载。依赖闭包、脚本、解包/包内manifest、启用、信任、任意URL均不支持。

实现固定9ebb3bdd781b3667f0c164405e9a17387ce89d76与1405551合同一致。注意：所有命令在当前owner鉴权后进入幂等helper；已缓存的成功receipt可跨center仅重放原稳定ID（replayed=true），不重新执行host操作；新retry/reconcile仍须当前store/ref匹配。共享挂载须明确启用本机host配置，先worker初始化成功再listen，并在pool关闭前停worker；根目录marker只约束可信配置，不提供跨机器身份认证。SIGKILL遗留未发布staging不做自动GC。
