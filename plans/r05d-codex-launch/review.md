# R05D 独立审查

状态：APPROVED — D0配置/构造；实际app-server/生产factory仍NOT_RUN

Base：f181d84b5fb3652d62e2a181acff442d42b3e066。D0 target固定，空review不表示通过。Review默认只读，源码修复交owner。

审查前核实际WT/branch/head/dirty与claim。验收：严格小配置、显式factory、无默认executable/任意args/env；旧Claude manifest/profile/hash/env保持、S01并发接线不回退；未得共享真实兼容证据时不能发布可运行声明；旧host/lease/journal/outbox仍唯一所有者。首片只注入行为检查，后继真实启动边界独立绑定来源和方法预算。检查原始stdout/exit/selected及固定manifest，记录未执行范围、severity/findings和结论。

Review target commit: 178ef49e568147849e63e08b3f7211ee5df823d3

D0 scope：configuration.ts、configuration.test.ts、native-harness/codex/launch.ts、launch.test.ts。只读核[manifest](../../docs/evidence/r05d/d0-fixed-manifest.json)与4源码diff，沿旧Claude/profile/S01 main直接消费者；检查有界文件读取/finally关闭、严格profile与无JSON启动授权、无默认factory/construction零native I/O、旧具体profile返回类型保留。原始green72/root types0与red缺实现输出均保留；第一次命令误列main.test.ts未选到该路径，实际main-concurrency22独立补齐，不把未选路径当检查。Findings/结论：NOT_STARTED，等待Lead独立只读review。

## D0 独审finding与修复

Execution Lead完整读初始4file delta、24 manifest条目fixed/current一致与50+22/root types0原证据；发现1个P2：stat后open(r)遇路径替换FIFO可能无限等待。其余无blocking。Owner修复commit 178ef49e568147849e63e08b3f7211ee5df823d3，改为O_RDONLY|O_NONBLOCK再fstat；定向test在真实stat后unlink/mkfifo，断言非阻塞flags、拒绝并close handle恰一次。1选择通过/19未选，root tsc0，未重跑72。固定增量[d0-fifo-manifest.json](../../docs/evidence/r05d/d0-fifo-manifest.json)。Execution Lead增量只读APPROVED 178ef49e568147849e63e08b3f7211ee5df823d3，P2 CLOSED。已完整读初始4源/此次2文件delta，核24原manifest+9增量条目、原50+22与新FIFO1/19未选、tsc0原raw，未重跑。O_NONBLOCK/fstat/finally及真实FIFO替换符合有界入口；未知JSON拒绝、仅受信factory，旧Claude类型/profile/lock/main保持，无其它P1/P2。批准仅D0配置/构造，真实启动/production factory仍NOT_RUN。

独审记录时间：2026-10-06 10:13:50 UTC，源码停写供集成。

主线收口：Execution Lead回执41315b033deb0b1953484359b686c0b228997367，4源码对独审target相同，owner本机逐文件SHA复核；组合root noEmit0，无真实provider运行。见main-receipt.json。
