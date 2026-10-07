# SVC06 诊断产物与下一宿主候选

唯一新 runtime source：`6c0fdcda8858aac33489c48c1948e902dd6a3d7e`（Lead 固定 `codex/svc06-diagnostics-runtime`）。父为 b2b；仅已独审 source3cb 的 preview/直接专测/new diagnostics/专测四文件变化，其余 Git blob 均相同。不是 moving main。旧 c2c 与 b2b r1 失败/清理及所有原始证据不变。

## 构建小差异

沿前次 build-once 方法，builder九模块、Node24、pnpm9.15.4、私有yaml2.9.0入口以及OPS14不变。新目录 `build-once` 与新随机私有根 `flow-svc06-diagnostics-artifact-*`；旧 actual-first/outer不复用。entry仅根前缀变化，supervise仅Python module别名变化；新增runtime-proof只从新产物内部import诊断模块、核64KiB常量及export，不打开诊断文件/进程/服务。

源归档998 files /7,834,095 logical B；72关键固定输入含33 SQL。14 package/lock/workspace声明与b2b字节一致，仍7 importers /271 snapshots，root tsx+pg、显式Vite host工具。fresh仅271旧选择索引2,252,500B逐hash核同；未扫描/哈希10,648 payload，实际selected clone核原件+目标hash。旧3mode观察不改，不冒cache全部完整或物理峰值。

总新增规划2,317,352,960B，包括stage/install→final同份1GiB、seed512MiB、archive32MiB、私有pnpm HOME/cache128MiB、metadata余量512MiB、raw2MiB。另live1GiB和协调512MiB；fresh最低3,927,965,696B，仍严于原2.5GiB。实际并发超协调余量则加严，不降gate。work420s+.5TERM+2reap，clone/install各180s，outer capture1MiB/总raw2MiB。原500ms filesystem sample不是原子峰值或硬预留。

## 宿主后继的最小差异（本packet不运行）

先等本新artifact真实build/import结果与descriptor固定，再开全新自有namespace（不能重用r1）。复用原真实维护/owned process及独立cleanup入口；选择新artifact为实际center/runner/Web代码，af51旧代表数据流程仍必要，不另造SDK/模型启动或绕过ready。

首先只进入原默认宿主启动检查；若再次失败，按本run nonce读取新阶段JSON、受控父首错、原数字exit事实，并仅在私有诊断中检查每role最早64KiB stderr。公开结果只bytes/hash/truncated/EOF/受控code/role/phase；不把raw输出、argv/env/凭据写进公开证据。不能从缺阶段推出child未启动，配置load前仍可能unknown。原ready10秒不增、不用注入替换真实spawn。成功才继续原packet尚未到达的迁移/策略检查；失败按原独立cleanup证明work组终态、detached nonce身份、marker/OID/有限零连接后normal DROP，unknown KEEP。具体host入口待新descriptor固定后独审/窗口；此处不是可执行个人操作。

真实三retained App报告仍由Web owner对**新6c实际后台source+normalized publicOrigin/policy digest**生成；b2b、旧af51/v1或手工loader fixture不能冒此组合兼容。未来个人顺序仍legacy先新Webhost→三retained完整v2新tuple→新backend+policy→第四App显式CAS，原身份/后台/指针/tabs不动，当前无个人窗口。
