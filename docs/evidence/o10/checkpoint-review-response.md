# O10 P2 清理前证据增量

固定增量target `b1a88ce90d2366f0fda6e4411471a4ddc5894e5e`，base为原准备3c770b52bb4e2e8b3c8b217b9d7900dda688263d；产品和O08依赖仍fc113不变。Root此前唯一P2要求完整worker/center/failure证据在不可恢复清理前持久保存，原11不同检查及9source/16raw/15dep已由Root核对，不重跑。

本增量3文件：driver增加独占checkpoint写入/文件sync/目录sync和不可恢复清理门禁；新定向测试；实验README说明保留与恢复。final收尾先stopWorker/读取事实/app.close，再saveCheckpoint；失败返回unknown，DB/tmp均保留；成功后才DROP/rm。final result后写若失败，清理前checkpoint仍可读但不证明清理已完成。没有新provider许可或自动重跑。

实际红：`checkpoint-red.txt`1失败（期望failed-or-unknown但旧driver仍rehearsal-passed），对应原始报告/测试操作者清理回执均保留。使用真实checkpoint目标目录冲突，未mock持久化结果。

绿：`checkpoint-final.txt` **2/2，3.921s**。一条真实写失败分支核runner/center停止、DB+worker文件确实保留、unknown与0native，之后测试操作者单独清理；一条成功0query旅程核checkpoint含task/goal/final/worker/Read结果且还未声称DB/tmp删除，再核最终清理全部true。两旅程sourceDigest一致。没有重复原11矩阵/O09的27领域。

两变更JS文件syntax exit0；默认preflight无HTTP/PG/query，sourceDigest **c7fa26cdf75f63eb62723a13f3a6ea29b9f82b1453a1ed51b56b8c2743b8d0c6**。没有新增root typecheck（mjs），旧原始syntax/manifest与历史pending原样保留。未生成有效permit、不读取真实登录凭据、不触个人服务。

边界：这是Node文件+目录fsync顺序与真实PG/独立runner注入验收，不模拟OS断电或底层磁盘控制器故障，不证明SDK/native/语义/费用；checkpoint写失败时保留资源需要明确人工核对清理，不能自动重试模型。批准仍待Root增量复审。
