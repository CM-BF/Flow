# P04 preparation clean-code check

2026-10-06T11:04:05.929Z，status_read / gpt-6-astra。范围：一个文件内的测试资源 owner 与九项真实生产Interface交错，生产runners.ts未改。

- 复用现有createServer迁移完成后先关闭其scheduler/pool，再进入四个独占max1 PG连接池；无HTTP监听、runner、provider或native SDK。不复制新状态机。
- SQL blocker正证据验证等待；不同attempt的三个实际事务须在首事务释放前完成。没有用耗时差当并行或吞吐结论。
- 自审修复：把backend PID预读取移到取得持有锁之前；所有已发promise有拒绝观察，finally先释放自有持锁连接，再settle已发请求，即使释放异常也不跳过settle。独占claim复用同一持锁资源owner。
- CREATE发送前记录requested；任何创建结果不明仍查精确随机数据库，所有自有pool已关闭且pg_stat_activity无连接才普通DROP；未知保留名字，不FORCE、不terminate_backend、不访问旧S01资源。
- 局部strict初次失败为直接Module调用没有HTTP parser默认的taskId/parent；补显式null后strict 0。初次raw保留。9项实际PG行为仍NOT_RUN，不把类型检查当行锁证据。
- 生产路径仍由ENG01B持有；此准备不能授予runners.ts写权。根方法已同意，资源/实现固定独审尚未进行。

2026-10-06T11:06:45.467Z 目标red后安全停点：18个preparation绑定逐项未变，raw显示唯一选中检查在真实Lock/blocker正分支失败；finally仍完成自有连接关闭/专库absent。保留原strict失败与未选8项事实，不放宽断言、不重试、不改未持有源码。
