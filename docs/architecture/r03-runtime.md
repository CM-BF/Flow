# R03 保守租期

既有 AttemptControl 用中心 leaseExpiresAt 减 runner Date.now；机器偏差会提前或延后停机，且初始performance起点在execute/mkdir之后才取。现在固定可证明保守的相对时长：

- ClaimResponse 顶层新增 remainingLeaseMs：有assignment时为本次中心 grant 的租期毫秒数，无assignment为0。不要把它解释成收到响应时仍有这么久；客户端必须扣整个请求耗时。
- HeartbeatResponse 已有同名时长语义，stop=0。leaseExpiresAt继续供展示/审计，runner安全判断不减本地墙钟。
- runner发送claim之前取得 monotonic requestStart；该时间跨网络、解析、目录准备传到控制器。初始deadline=requestStart+remainingLeaseMs。
- heartbeat同样从发送前取起点，只有当前本地租期仍活跃时才能更新deadline。响应即使服务器已续租，晚于本地截止也不复活。assertActive同步检查deadline，不能依赖event loop准时触发timer。
- remainingLeaseMs必须是1..300000的安全整数；缺失/非法/已耗尽 fail-closed，不以10秒或跨机墙钟猜测。旧runner可忽略新增字段；新runner对旧中心缺字段不运行adapter，须先升级中心。

保守性：center grant发生在requestStart之后，故本地requestStart+grantDuration不晚于该grant的有效期（正常单调速率下）。它有意将往返、排队和本地准备全部计入已消耗时间。中心数据库clock/fence继续裁决所有写入；不声称能用浏览器/runner本地计时取代中心权威，中心墙钟突变也由fence拒绝。

本地工作目录/attempt目录不可准备时使用既有 EventStorageError 停止runtime，不能connection-lost循环继续领取。构造控制器在目录成功后；后续finally关闭timer，请求使用同一个abort信号。退出或丢失的controller永不接受迟到回包。

Seams：公开 runRunner + 独立HTTP peer（synthetic lease/延迟）；真实 createServer + 专库 flow_r03 验证公共字段和fencing，不新增测试专用生产接口。SDK/harness loop不重写，纯fixture0模型。decision 20ms轮询、outbox目录扫描、FS/PTY和多runner能力留后续。
