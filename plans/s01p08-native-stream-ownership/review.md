# S01P08 独立审查

状态：PENDING
Review target commit: `e3d28f96b971256abd155904b4cbd333bbdc57ad`

范围为adapter最小检查位置改动、新native-stream-ownership.test及[optimization-review.json](../../docs/evidence/s01p08/optimization-review.json)绑定证据；base311e621、baseline192d8b35仅历史fixedGit。21bindings/当前raw对照，7旧语义+4新保护=11distinct，不将7+11累加为18。产品只删已发布session时重复batch assert；AttemptControl、native start/逐patch/final gates和server fence未改。

标准：前后同样5patch/9emit/32768B下15→11真实控制心跳调用；session后的取消仍挡首patch、patch间取消挡后续、native前拒绝0factory、sink失败unknown；周期、过期late reply、stop/disconnect/shutdown/inflight-only sharing保持。实际0PG/HTTP/native/provider，不用计数推断延迟收益。

审者只读核Git/WT/hash、首失败与两个预算段、进程/EOF/TMP和来源；不复跑/不写owner树。C02 v13正式交回、本v2合法领取前无产品写入。main NOT_INTEGRATED。发现交原owner；本片未另建authority/cache/supervisor。
