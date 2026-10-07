# 固定 Flow 来源宿主产物：一次构建入口

状态：PREPARATION_NOT_RUN。输入固定 Flow `422f4b150e5801d6010e5bbd6b53574e35384f87`；不读moving HEAD，不切checkout。仅本证据目录写入。

复用原已审SVC06 procedure，以既有 `prepareBackendArtifact` / `verifyBackendArtifact` 为唯一构建实现。builder由原backend-release固定绝对路径加载，其9模块与Flow422逐字相同；私有yaml2.9.0、固定Node24/pnpm9.15.4与原CAFS来源保留。没有新打包器、安装规则、selector或监督循环。此入口的实际消费者为Flow422的Web-only宿主选择；旧e5不改来源或原件。

`supervise.py`复用固定OPS14 NEW_CHILD_SESSION：420秒工作、0.5秒TERM、2秒reap，所有builder/install/import子进程同组。外层0600 exclusive `outer-report.json`保留1MiB完整capture，停止决定先于输出fsync；不能声称外层fsync有硬截止。只有child exit0、双EOF、group absent且无primary failure才成功。`actual-first`和新0700随机root独占；失败/unknown保留原reservation、artifact/stage/锁与诊断，不自动重试或清理未知。

初始必须fresh至少3,391,094,784B（≥2.5GiB且新增预算2,317,352,960B+1GiB收尾取严）。500ms采样实际free，live低于1GiB或全卷可用下降超新增预算即停；不是硬quota或排他物理峰值。selected seed536MiB、archive32MiB、HOME/cache128MiB、产物/manifest1GiB、metadata512MiB、raw2MiB同时计入；stage根到最终artifact为rename，不能假定CoW零成本。原354,552,778B仅选中文件逻辑量，cache旧3条mode观察保留。本段未重扫整CAFS，真正builder按相同lock逐选中项hash失败关闭。

完整产物verify、原bytes恢复、30SQL、271snapshots/7importers/tsx+rootpg+Vite及固定直接入口逐hash后，在产物cwd执行15秒有界import-only。只检查SDK公开query导出、平台原生文件实际布局及内部解析，0调用。新增真实 `serviceRuntime` Web选择/固定来源拒绝和纯resolver的center/runner保留，不写state、不启角色、0PG/provider/Chrome/个人操作。read-only selection会调用原产物verify，仍受原15秒限制。三角色host、个人迁入/采用、旧网页长连接与retained退役另排，当前均NOT_RUN。

执行入口（仅取得共享重窗口并fresh门槛后）：`/opt/homebrew/opt/python@3.13/bin/python3.13 -B docs/evidence/svc08/flow-host-artifact/build-once/supervise.py`。外层raw存在则拒绝，不覆盖原件。先记录真实tool退出/EOF/组状态即归还窗口，再封结果；不得用准备或旧e5结果当此次构建通过。

方法沿已安装find-skills/codebase-design/clean-code：Module单一构建实现、Interface仅固定仓库/目标/目录/工具；验证与个人部署分段，不传播角色特例或复制生产模块。仅本地元数据准备，无产品检查。
