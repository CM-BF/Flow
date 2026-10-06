# CHAT06P01：固定正文的分片提交成本

状态：SOURCE_PREPARATION，未运行PG测量，0provider/0云。基线 main `fa9a8288341d4f2bd8160e03fe9173dafa2de1a6`。目标仅测现有每patch重读/重哈希已有prefix的成本，不改产品。

## 最小方法

同一正文由16 UTF-8 bytes的literal `A中🙂é\_%\r\n`（末尾实际CRLF；e后为组合重音）重复2048次，共32768 bytes；保留精确codepoint顺序、组合形式、反斜杠与换行。3组分别4、16、64片，即8192、2048、512bytes/片，均符合现有8KiB patch上限。纯生成器必须用真实字符串验证16B与最终digest一致，报告需另列escaped显示，不能把文字\r\n与CRLF混用。

每组一个真实POST /api/tasks的claude任务、一个正式runner注册/claim与session，但不启动runRunner、SDK、模型或云。通过 POST /api/runner/events 逐片单event顺序提交；session单独先提交，所有patch共享一个stream/nativeMessage/block。最后patch声明block-complete，不伪造Flow成功；按需读取校验后通过正式completed(cancelled)关闭attempt。每组总正文相同，profile/prompt/调用配置一致，不改SQL使ready。

## 计量口径

- 原始输入正文每组32768 UTF8 bytes；每patch text、report JSON及完整ACK UTF8 bytes分别记。
- `readPrefix`精确SQL返回的decoded content UTF8 bytes与次数单列；其他SQL返回decoded rows JSON UTF8 bytes另列，均不称真实PG wire。
- 服务端request context内SHA-256的输入bytes/调用数/本机耗时：完整正文prefix输入单列，identity/canonical-event/payload/auth等其它输入单列。只能按已知精确prefix匹配，不用长度猜类型。样本生成/hash预计算在计量外。
- 查询数分事务BEGIN/COMMIT/ROLLBACK、prefix SELECT、其他SELECT和写语句；后台scheduler/scan独立。HTTP发起至完整ACK记录提交往返，COMMIT语句完成时延另记；不能将HTTP时间全部叫PG commit CPU。
- 最终持久化`sum(octet_length(data->>'text'))`和`sum(octet_length(data::text))`、block/patch行数、相关关系pg_total_relation_size与专库pg_database_size分别记。前两项为逻辑持久字节，关系/DB为现场物理占用快照，不声称WAL/磁盘写放大。
- 每次patch保存N/ordinal/fromBytes/addedBytes/prefixBytes与原始样本。若列p50/p95/p99须nearest-rank及n=4/16/64，注明不同prefix大小、非独立同分布、非稳定tail/SLO。顺序固定4→16→64；无重跑/择优，无冷热对照推论。

源码预测（非实测）：旧prefix读取 B(N−1)/2，对B=32768分别49152/245760/1032192B；完整prefix hash B(N+1)/2分别81920/278528/1064960B。固定B时预测随N线性，不能把这个矩阵称二次增长的实测。其它hash/JSON/索引/事务成本以现场分类为准。

## 观察与正确性

后续入口只复用本WT真实createServer/routes/PG源码。实验专属onRequest上下文与pg Client.query/Node SHA观察方法可参考已审B02 instrument.ts，并在本scope最小适配；不得改产品SQL/hash算法。必须保留callback/Promise/错误身份，所有prototype/builtin hook在finally还原。若request/background无法隔离或实际prefix计数与生成的明确预期不符，整体失败，不填推算结果。

校验阶段在计量外用公开task+attempt patch分页重建原文，核每片offset/digest与最终正文完全一致；按需block全文与存储逻辑字节/行数交叉核对。公开行集与逐patch计数原样保存；完整合成正文可由固定literal+digest复现。失败、未完成提交、资源清理异常与源变动永久保留；不冒称完整CHAT06权限/恢复回归。

## 待申请的首轮资源预算（当前未授权运行）

一次矩阵，3 tasks/3 attempts/3 sessions，84个正文patch，正文总输入98304B；无额外warmup任务或自动重试。最长30秒含setup/校验/清理，前20秒停止新增工作，至少10秒清理；每HTTP/SQL操作共享deadline。最多1个中心进程、无执行runner进程、1个观察pool，OS动态loopback端口与UUID唯一临时DB；创建前拒绝既存。全部自有DB/临时文件/原始证据合计上限64MiB，单HTTP响应体1MiB上限，最多256个HTTP请求（含有界claim轮询）。先app.close，再observer pool.end，确认自有DB连接0后普通DROP；不强制踢连接、不碰既有服务。0模型调用/真实用户文件/新云。

只有Mika独审入口且GO/Lead给明确窗口后才可开始该PG矩阵；本合同和纯单测本身不产生任何测量结果。修改预算/失败后重跑须重新协调，不能换label自行再测。
