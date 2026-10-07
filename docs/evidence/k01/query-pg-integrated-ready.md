# K01 查询诊断候选：READY / CLOSED

记录时间：2026-10-07T19:08:27.644021+00:00。唯一运行输入：[runtime-inputs](query-pg-integrated-runtime-inputs.json)，SHA256 `9d1d91036cbb667031beb958a5e7a1d93b07d7ece34abe4f6c7ced8bc95208d0`。此处仅准备完成，**NO_NEXT / NO_RUNTIME_GRANT**。原两次PG失败及数据库、scratch KEEP不变；当前修复后完整诊断尚未运行，也未集成main。

源码 `74934ecd9fd8e33f2c83e858dcc3e1b4e343581c`，产品输入 `3c9345df4aec85a37e8a2a155e079db260d515b1`；Mika于18:33:14Z限定批准源码与29纯用例结果，见[独审回执](query-entry-postflight-independent-review.json)。24实验文件、27运行绑定、17外部与3内部alias、245产品输入（含33SQL）和pg动态入口按runtime-inputs固定；不宣称全部第三方或当前main逐字相同。

候选总150秒，同一origin的70/110/120/130/140/150截止；原70工作、40正常清理、10子结果不减少，另保10主进程收束、10单次只读DB观察、10父回执。primary配置18加observer1保守19连接，管理余量及fresh floor须由未来经理提供。原12金样本、10 EXPLAIN、30 timed SELECT与语义断言不减。DB128MiB只是末次样本限制，不是峰值保证；新local/TMP/evidence合计8MiB含raw2MiB，progress与observer原件计入一次，预留不构成额外配额。

当前[permit](query-pg-integrated-closed-permit.json)明确CLOSED且过期。未来精确operator argv已在runtime-inputs的`invocation.futureActualOperatorArgv`固定，指向尚不存在的`query-pg-integrated-actual-permit.json`；不得直接运行模板。新namespace仅在未来合法准入后创建，当前不创建、不读取admin值、不采资源。private输入沿已授权fixedGit fixture表达式，凭据不进入记录。

最多一次精确身份只读观察，无DROP/terminate/重试；身份、余额或闭合未知就KEEP，测量FAIL不会因零连接观察改为PASS。实际生命周期、计划与时延结果仍NOT_RUN，不能把局部纯测试当PG准入。

本次metadata段19:01:30—19:09:30 UTC上限，新增≤1MiB，0工程/PG/HTTP/provider/actualnamespace。提交推送后全部STOP，0pending launch；K01-06及留存K01-08～10继续开放。
