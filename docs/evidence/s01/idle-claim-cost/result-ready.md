# S01 idle 单次结果（双审通过）

唯一窗口 `s01-idle-claim-cost-once` 已消费，执行 `1bd2a0660b84fc4a7602e74a42682264881fb689`，源码 `fd24a1f4d89839c867ed9184ef2c28680c5922cd`，生产镜像固定8d84。新result-manifest绑定8原始文件；原case/outer的pending snapshot不重写，最终结论同时依据CLI和external-exit。

实际为1个public runtime，capacity1、active0，12次空claim全部200；Vitest父进程及1个fork承载case，另有已审薄入口。24次rename（begin/accept-null各12），file.sync及directory.sync各24，193完整samples/24durable phase。初始read ENOENT保留为1次失败调用。正常stop发生在第12请求已接收之后，最后accept-null目录sync晚于stop12.432ms，runtime关闭晚于stop12.748ms，最终journal EMPTY。

Node start→exit 6641.184ms，外部收据持久后6641.648ms，tool exit0；内部CLI6551ms不是全程替代。runtime/server/文件句柄/socket/子进程组/stdio全部确认关闭，自有root同identity删除后现场absent，retained=[]。

预算计量1,774,593B = input427,009 + sampled own peak1,081,344 + journal保守4,096 +自动/人工预留262,144，低于2MiB。raw8文件28,786B；最终人工档案依overall-archive复核，不重复将已预留文件再加总。采样间峰值UNKNOWN，这不是硬配额或系统全部I/O。

观测层耗时（各24次，毫秒，sum/median/max）：
- file-sync: 123.413626 / 4.783771 / 15.610916
- directory-sync: 114.549627 / 4.627688 / 8.987208
- rename: 8.644293 / 0.274729 / 1.019708

这些值是包装的异步API调用耗时，含排程和观察开销，不能解释为纯存储介质延迟。默认500ms poll未变，实际相邻HTTP到达均值524.856ms（521.461–538.395ms）。只证明该单实例12轮的调用成本；不外推100agent/100runner、功耗、SSD磨损或吞吐SLO。0PG/provider/native；未改durability/poll/恢复，未读旧unknown journal。

Mika 19:15:35 UTC与architecture_read 19:16:32 UTC均批准固定结果 `e4ed2cd8fa80159839a07ba8a2f7f212732f2b2a`（0P1/P2），回执[result-review.json](result-review.json)。本页为Lead最小接收入口；结果未标main已接收，原S01未完成项继续保留。
