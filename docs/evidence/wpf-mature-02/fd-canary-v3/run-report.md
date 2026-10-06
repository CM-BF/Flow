# v3 regular-file对照：目标失败，结果已封存

窗口 `go-c-fd-v3-a10b4fae-once`，执行HEAD `65bf450366edfd9f8599cab3cf22d7a973bbc948`。紧邻执行11:43:12.639Z核v4 ACTIVE/clean、47固定绑定和8产物缺失；2026-10-06T11:43:23.079Z唯一入口开始。

1compile正常exit0；5条compiler verbose是报告的命令清单，后代PID未知。控制目标报告完整：fd0/1/2均socket，fstat/fcntl成功。第二目标使用原profile及三个自有regular文件fd；父进程已核mode0600/path inode与open fd一致。该目标SIGABRT，report=null，failureStage=target-2-health/类别unclassified。没有子报告，不声称观察到子fstat/errno，也不能证明stdio为旧失败根因、具体pre-main阶段或拒绝规则。没有第三项/重试。

此目标stdio为文件，safe streams=null；stdoutBytes/stderrBytes=0只是没有管道capture，不能解读为已证明子进程无输出。原自有stdio文件随精确root清理；本窗口不追加读取或崩溃历史探测。

[安全CLI](safe-cli.stdout)：measurementComplete=false，compilerInventoryPersisted/resultPersisted=true；所有阶段close/groupGone确认，descriptorsClosed/cleanupComplete/outputAccountingComplete=true，retainedRoots=[]。991.047291ms为result持久化前，997.3055ms为持久化后CLI写前；工具exit1，已完成runtime。人工review/Git/此归档在外，符合本次GO明确时间边界，不合并声称这些也发生在997ms内。

原compiler两流0600仅本地保留，自动[清单](compiler-inventory.json)已经在入口clock内写/fsync；其bytes/hash/mode/inode再次只读匹配，原文未回显、未Git。capture11679B与raw副本均计量，runtime prepared122648/capture11679/artifact166418/receipt9369=310114B，CLI和人工安全归档实际值见[accounting](archive-accounting.json)。这是可见owned/verbose输出口径，不是全系统IO证明。

[manifest](run-manifest.json)绑定本次安全结果与固定输入；a10源码/recipe批准不代表本结果通过。窗口已消费，真实SDK/Codex/provider/auth/network/个人服务均0。当前等待独立结果审查；隔离和实际Codex目录仍未验证，失败原因unknown。
