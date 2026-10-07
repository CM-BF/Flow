# K01 启动/失败记录/计时边界修复：局部结果

实现9c802db4d3d859bcfb0b335b30f27f4bd4e9d3fb，继承a82/固定产品3c9345d；没有修改产品、旧输入清单、旧PG失败结果或任何KEEP。

两串行child：listen.test.ts 9/9（原3 listen + 新6 startup/progress/timing）；focused noEmit exit0。实际sourceFiles前后同字节，types没有抬root lib。operator累计2847ms，监督2636ms；raw519B。64548/68289各exit0/finalabsent/MERGED EOF完整、无first/secondary/signals，各自scratch exact REMOVED/lstat absent；actualRETURN16:57:35.046460Z。ordinary已直接交architecture_read，本段不再启动child。

行为范围：pending import到work deadline拒绝，晚resolve不触发factory；pending factory能在cleanup deadline内交回资源，超期仍unsettled/UNKNOWN；post-import guard拒绝、原import错误身份保留；append-only进度保留已完成结果和首错、不二次覆盖，超单record上限不写；fake clock明确guard7ms/query3ms/e2e10ms，guard拒绝不调用query、query原错误不替换。

所有用例0PG/HTTP listener/模型；只用合成Promise和child TMP内小文件，不证明真实Fastify/PG运行生命周期。本次没有先运行red，原PG失败不能当这个纯测试red。原corpus4和无新改动的caller/budget全部未重跑。独审后仍需另一个明确的有界诊断窗口。

新增progress按64条/每96KiB/总768KiB限量，同时受原combined8MiB/raw2MiB+末回执reserve约束，不能用局部通过推实际PG峰值或性能。查询计时clientSqlRoundTrip仅包住driver promise；guard扫描另列observerBeforeQuery，clientEndToEnd含二者，结果sizing/progress在计时后；EXPLAIN ANALYZE TIMING OFF保持原单独口径。
