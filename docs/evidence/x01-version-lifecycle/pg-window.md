# 独立实际PG窗口（尚未OPEN）

唯一入口：`/opt/homebrew/opt/python@3.13/bin/python3.13 -B docs/evidence/x01-version-lifecycle/execute-pg-once.py --admission /absolute/fresh-admission.json --sha256 <admissionSHA256>`。

admission必须Mika新OPEN、stage=X01_VERSION_LIFECYCLE_PG、全claim v1 identity/scope同claim-take、ledgerObservedAt≤60s、真实clean head、manifestSha256、独立32hexwindow、非负pairedBytes。不能复用X01旧实际窗口。run目录pg-run-r1必须不存在；不换namespace重试。紧前自身PG/资源状态与他lane交接另由Mika确认，当前0actual。

总180s=110work+60cleanup+10final，Git前置≤3s/开始PG截止15s；child监督剩余deadline−8s，最后receipt持久化后delivery校验整体deadline。1markedDB，17连接上界（center8+fixture4+admin1+boss预算4），1runner/capacity2，3tasks，2包装材料，256总centerHTTP，8registryHTTP上界（正常4），单响应128KiB/center累计4MiB。TMP32MiB/4096entries末采样不是实时硬隔离；raw全archive1MiB，DB/WAL预留128MiB不是hardcap。floor=max(5,334,630,400,1GiB+TMP32MiB+raw1MiB+DB128MiB+实际paired声明)；local段已闭合。

同PIDcheckpoint/fsync→exec，OPS14独立组/合并capture；最终reaped absent/EOF及错误事实保留。afterAll明确runner drain→app/registry关闭→fixture pool/admin关闭→同OID/owner/marker、0conn、普通DROP ACK+不存在。来源断言与ownersclosed相互独立，FAIL不改PASS。任何identity/生命周期/receipt未知KEEP，禁止停他人服务/强制DROP；未授权不执行cleanup扩权。已消费原件不改。

外部工具时间另记录，不能用内部before-final-persistence代替最终交付墙钟。实际输出至少reservation/admission/launch/preflight/output/runtime四receipt/vitest/result，caller有24项/总字节封顶。
