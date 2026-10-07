# 固定 b2b 产物构建与内部加载结果（待独审）

本次一次真实构建成功，产物 ID `c2c695e7da5a3b2efeaaa68bf407dda65c8e8a8afd5413657ab4b98a334509b7`，source 是 `b2b5612b2a63106ad0e674ddf12b2e8f96cf3388`，sourceRepository 是真实 Flow。自有根 `/private/tmp/flow-svc06-b2b-artifact-F63Mk3` 保留供后继验证；没有个人安装或服务变化。

[唯一原始结果](build-once/actual-first/result.json)、[完整外层Report](build-once/outer-report.json)与[限定分析](result-analysis.json)相互对应，外层stdout逐值等于持久result。entry真实开始09:01:39.222Z、结束09:02:10.132Z；entry30,909ms，supervisor30,975ms/exit0，owned group43300最终absent、双EOF、无signal、无primary/secondary failure。原初次unknown观察完整保留，不能从最终absence推造未记录的每个子进程exit0。实际重窗口结束即告Lead归还，后续仅封存metadata。

真实离线frozen安装选择7/12 importers、271包，原输出reused271/downloaded0，pnpm exit0。prepare/verify核固定源码69项及33SQL、完整产物清单/内部链接/Node20 images，inventory15,626 entries、363,822,116 logical B；含manifest367,018,355B。这些是逻辑字节，不是CoW exclusive分配或可回收量。build-record里的 `published` 指自有后台产物store原子发布，不是用户网页指针发布。

实际从产物内部解析pg/tsx/Vite/Claude SDK与native binary metadata；server factory、runner runtime、host、preview、maintenance入口和新浏览器策略/retention模块成功加载。实际只读Web-host选择使用本产物，center/runner哨兵选择保持，错来源拒绝；策略未读取/安装。SDK0.3.290的233,260,816B可执行文件仅stat，未执行；factory/runRunner/provider调用均0。此次没有拒读/删除开发checkout实验，不将内部解析等同完整隔离宿主运行。

fresh外层准入23,912,873,984B；entry首采23,912,050,688B、62次采样最低23,463,669,760B，采样下降448,380,928B，包含其他writer活动。满足原fresh3,927,965,696B、live1GiB及新增2,317,352,960B观察界限；精确物理峰值UNKNOWN。原raw含outer/7run文件/私有原build-record共14,688B，低于2MiB。

entry核无prepare.lock或未完成stage目录；原stage JSON、owner、artifact manifest及自有产物全保留。全受监督组已不存在，没有PG/Chrome/detached服务需要清理。旧3230/422产物、mode三项观察、status历史UNKNOWN与所有旧失败原件均不改。

后继仍按[候选顺序](candidate.md)：legacy模式先新Web宿主，三个保留真实App的新后台+配置v2报告，实际迁移/新backend+policy，第四App独立CAS。以上没有在本次执行；当前结果只是固定产物和内部加载，SVC06-03/04/05整体仍open。等待唯一结果独审，不新增检查或服务操作。
