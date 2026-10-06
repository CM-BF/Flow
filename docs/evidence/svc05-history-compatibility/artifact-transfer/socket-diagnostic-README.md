# 一次隔离 socket 诊断

2026-10-06 18:28 UTC。固定source d8b4c961b9d36915f07ff4109299fac642566519，结果 `CHURN_NOT_REPRODUCED_CAPACITY_DROP_CONFIRMED`。原3980提案/输入不变；这里只使用随机loopback端口60350/60351，无个人HTTP/连接操作、PG、browser、provider或安装/build。目录名1830仅预选标签，真实开始是2026-10-06T18:26:40.595Z。

## 观察与解释

- 固定af51四模块与d629真实10文件/现有兼容报告复制到自有0700目录；调用原startStaticWeb，cap仍64。Vite8.3.2原公开入口/Node24.20.0，注入仅转发原createServer参数并添加观察，不改clientError、proxy、超时或销毁策略。
- 133次连接尝试，包含32个未完header RST、32个读16B SSE后abort；每8次观察时仅最后一个close在途，最后双方getConnections/tracked均0。32次clientError与32次socket-error记录为ECONNRESET；完整运行228个受观测socket最终全部close。此序列没有复现个人64 CLOSED残留。
- 只有churn归零后才进入64个合成SSE保持流。frontend/upstream getConnections各64。上溢identity：drop 0→1、frontend HTTP到达99→99、无HTTP status/正文、客户端ECONNRESET。关闭这些自有流后双方归零，再次identity精确d629通过。这证明隔离中的容量拒绝路径，不证明个人为何积累64个CLOSED fd。
- Node嵌入式source与static-preflight记录非EOF读错误先destroy；Vite early-return不能单独当泄漏结论。现有内核计数也不等Node内部计数。没有加压、重试、升cap或修复个人服务。

## 单次运行与资源

Node实际工作409ms、含关闭414ms；外层699ms，不作为通用性能结论。35s工作+10s清理的外层观察上限未触发。最低采样free 1619140608B；tmp逻辑采样峰1621521B，最终raw 175306B，固定输入copy已知逻辑1619271B。最终累计双侧socket read/write 51802B（含代理两段，非用户有效载荷）；中间采样峰不冒物理峰值或OS空间预留。外层采样peakRaw1575B发生在最终checkpoint落盘前，不能拿它当最终raw总量。

[checkpoint](socket-once-20261006-1830/evidence/checkpoint.json)先完整持久，随后确认child/wholePGID47524消失，两个动态port的lsof无任何项，再核初始dev16777234/ino123125766，外层[cleanup-decision](socket-once-20261006-1830/cleanup-decision.json)持久后删除该tmp。operator-result证实tmpRemoved=true。没有保留本次活动资源，也未删除此前任何unknown目录。

## 边界

这次是功能/生命周期隔离诊断，非用户页面健康检查或根因证明；没有真实浏览器、中心/SSE业务、长时间自然流量或所有abort时序覆盖。输入是现场磁盘包hash与固定源码，非个人进程内存映像。所有原始结果不可重写，新的复现必须另派窗口。当前独审待完成；个人发布仍独立前置。

本地find-skills/clean-code/codebase-design已复核：原宿主Interface不改，合成上游为唯一数据Adapter，观察与释放职责在单次脚本/外层；未新增生产部署或连接管理框架。
