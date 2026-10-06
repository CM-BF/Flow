# 第二次真实浏览器子集 — FAILED，原始证据保留

2026-10-06 20:52:18 UTC。仅一次run `rec4d-20261006-205056-a30d13`，执行HEAD `d3d45bcb58e2b34064abfdbb90b9d56edc6cd0d9`，19源固定4d330（产品/helper2b01）；[manifest](browser-second-manifest.json)逐项核current/fixed/run来源。使用新manager显式隔离admin，未读取/归档凭据值；[gate](browser-second-parent/gate.json)原样保留。

**actual exit1 / FAILED**：[browser.json](browser-runs/rec4d-20261006-205056-a30d13/browser.json) cookieRead PASSED；textIntentDraft在Saved drafts and receipts对话框内按Saved draft+conversation route过滤后，Restore without sending匹配2按钮，strict mode violation。pageErrors=[]、materialDraft NOT_COMPLETED，其他运行检查未完成/未跑；不以.first()改结果、不先归因为产品或harness根因。本次没有旧missing-store pageerror不代表完整IDB/草稿恢复通过。旧首轮失败和原50受控PASS不改范围。

父[supervisor](browser-runs/rec4d-20261006-205056-a30d13/supervisor.json)、[budget](browser-runs/rec4d-20261006-205056-a30d13/budget.json)与[parent stdout](browser-second-parent/parent.stdout.jsonl)/[stderr](browser-second-parent/parent.stderr.log)/[actualexit](browser-second-parent/actual-exit.json)分别原样保留。较早budget序列化elapsed10671.133875000001ms；更晚终态postWrite10674.167625ms。加旧14846.267375ms，最新累计25520.435ms、余64479.565ms；未来整数准入须保守spent25521/remaining64479且含15000清理。外层captureWall11362.417250056751ms单列，不混同父计时。剩余不是续跑许可，当前0重试。

清理完成：随机ownedDB `flow_recovery_04d9cb1c628b41d6a215dbafab664f94` removed/confirmed、remaining=[]、connections0、errors=[]；marker前后两次观察零。两ownedgroups10546/12234 exit0且allOwnedGroupsAbsent=true，scratchRemoved=true，cleanupErrors=[]，budget.complete/cleanupComplete=true。11run原文件及4capture/gate文件均保真。log3759B、采样peakScratch26394699B、minimumFree1195659264B、晚终态evidence943695B为本次监督观察，非物理硬峰值或独占分配归因。清理结果已立即交manager归还窗口，临时env由manager处理。

原prepared same-origin subset未扩大；SSE delivery、CREATE两阶段、Queue/Steer恢复、完整profile/knowledge/steering稿及第二center仍开放，三中心语义亦未因本次运行关闭。完整feature review NOT_STARTED / targetUNKNOWN / main未集成。19源保持冻结；后继须单独派工和新准入，不自动修改源码或重复检查。
