# SVC07 真实连接窗口准备

状态：PREPARED / **NOT_RUN**。固定产品实现 `e28c4ed0a30ec2800eeca2ca5c444c0081c38165` 与首片15例原始证据不变；本探针是 SVC07-04 的独立验收输入，不作为已有PG/HTTP能力。

## 精确范围与输入

- 源码：[pg-transaction.test.ts](pg-transaction.test.ts)，配置：[pg-vitest.config.mjs](pg-vitest.config.mjs)，固定身份：[pg-input.json](pg-input.json)。数据库 `flow_svc07_72770249ea6c`，marker `cbd4e630-5588-415e-a789-2e628bc6e38c`；subject/admin各自独立固定application_name。
- 仅导入本树 `apps/server/src/database.ts`、现有pg/vitest和Node内建；不导入createServer、workspace contracts、既有flow_c01 fixture，不运行迁移。无新增依赖/供给请求；既有五入口见 [dependency-links](dependency-links.json)。
- 凭据只由Lead已授权配置注入 `FLOW_SVC07_TEST_ADMIN`；不写入input/output，不扫描或输出环境。限制本机PostgreSQL。实际窗口前必须确认目标是当前Lead安排的共享本地PG；探针不启停该服务。

## 行为与资源

2个实际断连用例：借用后无active query、正在执行自己的固定SQL。每例先在事务写自有receipt，控制连接在同一条终止语句中核 `pid + backend_start + datname + application_name + current_user`，只发一次terminate请求；ACK未知不重发。通过client公开end事件观察断连，不另加client error监听替产品兜底。空闲用例确认业务回调未结束前事务未返回/连接未释放；随后同一个Pool产生新连接并成功提交新事务，旧写应不存在。

最多2个同时连接：admin pool max1，subject pool max1。无HTTP listener、Chrome/native/provider、外部服务或共享PG重启。自有临时表仅在该唯一DB。数据库磁盘预留64MiB；运行前fresh free必须至少1,207,959,552B，且减去64MiB仍保留1GiB，不把source只读供给当运行准入。由Lead交接实际共享holder。

整体窗口30s涵盖启动、2例、正常关闭、身份/连接核对及DROP。Vitest单例/钩子各5s，内部查询/连接和观察有界；外部监督仍须硬上限30s。超时整个结果为UNKNOWN，停止本次自身进程组后保留固定身份与原始输出，交owner核对，不重跑、不批量终止共享连接、不直接强制DROP。

## 待授权执行命令与输出

工作目录：`/Users/citrine/Projects/AgentHarness/Flow-worktrees/server-transaction-disconnect`。实际执行前由owner逐项核固定源/input/config hash、claim v1当前active、既有依赖入口、fresh磁盘、共享holder和所有预定输出尚不存在。环境仅本次子进程清除NODE_PG_FORCE_NATIVE，设置NODE_DISABLE_COMPILE_CACHE=1、NO_COLOR=1、TMPDIR为本scope的 `pg-tmp`。

```text
/opt/homebrew/opt/node@24/bin/node node_modules/vitest/vitest.mjs run docs/evidence/svc07/pg-transaction.test.ts --config docs/evidence/svc07/pg-vitest.config.mjs --configLoader runner --no-cache --reporter verbose --no-color
```

固定未来输出（现均不存在）：`pg-run-reservation.json`（wx，运行一次门闩）、`pg-result.json`（身份/用例/清理事实）、`pg-output.log`（外部合并stdout/stderr）、`pg-exit.json`（外部exit/wall/input hash/预算事实）、`pg-tmp`（本次TMPDIR）。外部raw上限64KiB，result/reservation合计32KiB；超限保留已有有限原始字节并判UNKNOWN，不把截断当完整结果。执行封套须在开窗前满足这些界限，不从本文推断封套已经实现或运行。

## 关闭与失败优先级

每例finally先解除自己回调gate，再等pending事务收束；清理等待失败不替换已有主失败。afterAll只处理本次成功独占reservation的attempt：subject.end → 有界观察专DB连接归零 → 同时核创建/marker已确认且当前marker相符 → 普通DROP → 再确认数据库不存在 → admin.end。任何确认失败保留UNKNOWN，不使用FORCE/DROP CASCADE、不终止未登记PID。pool.end ACK不等于远端零连接，故单独观察；admin.end仅报告API ACK。

CREATE提交未知且DB已存在但marker未确认时必须KEEP；已有同名DB或reservation均拒绝。既往输出不覆盖，cleanup错误不抹去主失败。真实COMMIT丢ACK仍由首片fake限定验证，本窗口不人为截断COMMIT，不声明HTTP/个人服务恢复。

## 交接

下一步先固定这批输入供独立只读审查，再由Lead安排当前holder与精确30s实际窗口。等待窗口期间owner可安全停止本scope写入，claim保留；任何其他feature另建/领取独立worktree与scope。

## 准备检查

2026-10-06 20:18 UTC，当前fixture源码经局部types exit0，实际wall0.576960s；[v2回执](pg-types-v2.json)。早一版types保留，两个检查都未运行任何module/PG。Mika中间只读指出的结果覆盖与finally错误优先级已修：预查result仅ENOENT允许、result写wx/0600；显式caseFailed与secondary事实保留原失败。正式固定target审查与真实窗口仍未执行。
