# 独立实际PG窗口（尚未OPEN）

唯一入口：`/opt/homebrew/opt/python@3.13/bin/python3.13 -B docs/evidence/x01-version-lifecycle/execute-pg-once.py --admission /absolute/fresh-admission.json --sha256 <admissionSHA256>`。

admission必须Mika新OPEN、stage=X01_VERSION_LIFECYCLE_PG、全claim v1 identity/scope同claim-take、ledgerObservedAt≤60s、真实clean head、manifestSha256、独立32hexwindow、非负pairedBytes。不能复用X01旧实际窗口。run目录pg-run-r1必须不存在；不换namespace重试。紧前自身PG/资源状态与他lane交接另由Mika确认，当前0actual。

总180s=110work+60cleanup+10final，Git前置≤3s/开始PG截止15s；child监督剩余deadline−8s，最后receipt持久化后delivery校验整体deadline。1markedDB，17连接上界（center8+fixture4+admin1+boss预算4），1runner/capacity2，3tasks，2包装材料，256总centerHTTP，8registryHTTP上界（正常4），单响应128KiB/center累计4MiB。TMP32MiB/4096entries末采样不是实时硬隔离；raw全archive1MiB，DB/WAL预留128MiB不是hardcap。新admission最低floor为5,479,333,888B，并须取fresh完整组合更高值；local段已闭合。

同PIDcheckpoint/fsync→exec，OPS14独立组/合并capture；最终reaped absent/EOF及错误事实保留。afterAll明确runner drain→app/registry关闭→fixture pool/admin关闭→同OID/owner/marker、0conn、普通DROP ACK+不存在。来源断言与ownersclosed相互独立，FAIL不改PASS。任何identity/生命周期/receipt未知KEEP，禁止停他人服务/强制DROP；未授权不执行cleanup扩权。已消费原件不改。

外部工具时间另记录，不能用内部before-final-persistence代替最终交付墙钟。实际输出至少reservation/admission/launch/preflight/output/runtime四receipt/vitest/result，caller有24项/总字节封顶。

## 2026-10-07T11:32:06Z 窗口拓扑与新准入规则

fixture明确新增应用child只有两次串行 `/usr/bin/tar`（A/B各一次、各≤5s/8KiB输出），代码version-rollback-pg.test.ts:77记录PID/exit/signal并等close。registry与center均为Vitest worker内的Node对象，共两个`127.0.0.1:0`动态listener（:86、:105）；单个public `runRunner()`也在同一进程内（:178），中心注册capacity2（:161）且runner.maxConcurrentAttempts2（:180）。它不是OS runner/main进程，不启动模型/provider。其余fixture/package-store/host路径没有spawn/fork；A/B/C实际工具由已安装本地ESM载入。

基础工具链不可算成“只有两个tar”：现入口另有一个受监督Git preflight进程组，以及同PID Python checkpoint→exec Node/Vitest组；Vitest4.0.18未指定pool时默认forks，配置maxWorkers1，因此有单个fork worker；Vite7.3.6的esbuild0.28.2按需启动单例转换服务child（源码lib/main.js:2270–2272）。这些内部child都继承Vitest监督组，由最终group absent/EOF等事实闭合，不另外宣称只有leader退出就全部完成。代码中没有新OS center/runner、浏览器、provider或其他应用child；工具链实际PID/是否启动按运行原件记录，不预填已观察事实。

已审caller与manifest保持原字节，其历史hardcoded floor5,334,630,400B不能单独作为本次准入。OPEN前fresh实际manager完整floor至少5,479,333,888B；自有base=1GiB+32MiB TMP+1MiB raw+128MiB DB/WAL=1,242,562,560B。新admission必须设 `pairedBytes=max(fresh真实配对声明合计, fresh完整floor−1,242,562,560)`，并记录声明来源、manager观察时刻、原始配对与policy补足分别多少，不能把补足冒实际活动child占用。仅取当前最低值时pairedBytes至少4,236,771,328B，使已审caller实际computed floor达到5,479,333,888B；更高fresh组合必须同步提高。紧前free需不低于该实际computed floor，不是文档口头提高。

manager11:32:06确认SVC已于11:27:03.659 RETURN/0重holder，Release c2未READY；保留旧artifact/private-run KEEP，并纳入新main types KEEP三项logical1,357,748B、allocatedUNKNOWN。未来运行必须重新取得来源与完整组合，不把这些历史观察当现在OPEN，也不接触或清理KEEP。当前没有NEXT/OPEN，PG仍0。
