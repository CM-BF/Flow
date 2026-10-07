# SVC07 真实连接窗口准备

状态：PREPARED / **NOT_RUN**。固定产品实现 `e28c4ed0a30ec2800eeca2ca5c444c0081c38165` 与首片15例原始证据不变；本探针是 SVC07-04 的独立验收输入，不作为已有PG/HTTP能力。

## 精确范围与输入

- 源码：[pg-transaction.test.ts](pg-transaction.test.ts)，配置：[pg-vitest.config.mjs](pg-vitest.config.mjs)，固定身份：[pg-input.json](pg-input.json)。数据库 `flow_svc07_72770249ea6c`，marker `cbd4e630-5588-415e-a789-2e628bc6e38c`；subject/admin各自独立固定application_name。
- 仅导入本树 `apps/server/src/database.ts`、现有pg/vitest和Node内建；不导入createServer、workspace contracts、既有flow_c01 fixture，不运行迁移。无新增依赖/供给请求；既有五入口见 [dependency-links](dependency-links.json)。
- 凭据只由Lead已授权配置注入 `FLOW_SVC07_TEST_ADMIN`；不写入input/output，不扫描或输出环境。限制本机PostgreSQL。实际窗口前必须确认目标是当前Lead安排的共享本地PG；探针不启停该服务。

## 行为与资源

2个实际断连用例：借用后无active query、正在执行自己的固定SQL。每例先在事务写自有receipt，控制连接在同一条终止语句中核 `pid + backend_start + datname + application_name + current_user`，只发一次terminate请求；ACK未知不重发。通过client公开end事件观察断连，不另加client error监听替产品兜底。空闲用例确认业务回调未结束前事务未返回/连接未释放；随后同一个Pool产生新连接并成功提交新事务，旧写应不存在。

最多2个同时连接：admin pool max1，subject pool max1。无HTTP listener、Chrome/native/provider、外部服务或共享PG重启。自有临时表仅在该唯一DB。数据库磁盘预留64MiB；运行前fresh free必须至少1,207,959,552B，且减去64MiB仍保留1GiB，不把source只读供给当运行准入。由Lead交接实际共享holder。

整体窗口30s涵盖准入、启动、2例、正常关闭、身份/连接核对及DROP。Vitest单例/钩子各5s，内部查询/连接和观察有界；[本片封套](execute-pg-once.py)以启动时的monotonic时钟计算，27s到期停止捕获并对已确认存在的自有组发TERM，最多等0.5s；仍确认存在且此前未出现权限未知时才发KILL，再等最多0.5s。总wall超过30s也判UNKNOWN。系统拒绝signal/观察时只记unknown，不声称已杀死或保证退出；保留固定身份和有限输出交owner核对，不重跑、不批量终止共享连接、不直接强制DROP。

## 已实现封套、待开窗命令与输出

工作目录：`/Users/citrine/Projects/AgentHarness/Flow-worktrees/server-transaction-disconnect`。实际执行前由owner逐项核固定源/input/config hash、claim v1当前active、既有依赖入口、fresh磁盘、共享holder和所有预定输出尚不存在。环境仅本次子进程清除NODE_PG_FORCE_NATIVE，设置NODE_DISABLE_COMPILE_CACHE=1、NO_COLOR=1、TMPDIR为本scope的 `pg-tmp`。

封套唯一CLI（两个参数由独审固定commit和manifest SHA填入；精确值随固定交接回执给Lead，不动态取当前HEAD冒充已审target）：

```text
/opt/homebrew/opt/python@3.13/bin/python3.13 -B docs/evidence/svc07/execute-pg-once.py --expected-head <reviewed-40hex-head> --manifest-sha256 <reviewed-manifest-sha256>
```

Python 3.13.3仅使用标准库；固定子命令如下，不接收任意测试/数据库/执行命令参数：

```text
/opt/homebrew/opt/node@24/bin/node node_modules/vitest/vitest.mjs run docs/evidence/svc07/pg-transaction.test.ts --config docs/evidence/svc07/pg-vitest.config.mjs --configLoader runner --no-cache --reporter verbose --no-color
```

固定未来输出（现均不存在）：`pg-run-reservation.json`（wx，运行一次门闩）、`pg-result.json`（身份/用例/清理事实）、`pg-output.log`（外部合并stdout/stderr）、`pg-exit.json`（外部exit/wall/input hash/预算事实）、`pg-tmp`（本次TMPDIR）。外部raw上限64KiB，result/reservation合计32KiB；超限保留已有有限原始字节并判UNKNOWN，不把截断当完整结果。输出都以独占方式创建，JSON/raw为0600、tmp为0700，拒绝原有文件/symlink；pg-exit在Popen成功后立即写入PID、PGID和启动UTC并fsync。组观察为present/absent/unknown（含errno），EOF、leader exit与group absence分别存档。退出后仅移除dev/inode一致且空的自有tmp；未知内容保留。manifest、fixed HEAD、clean、五依赖入口hash、fresh claim身份/scope与磁盘均由封套再次校验。实际封套尚未调用，不能从监督测试推断PG连接或清理成功。

## 关闭与失败优先级

每例finally先解除自己回调gate，再等pending事务收束；清理等待失败不替换已有主失败。afterAll只处理本次成功独占reservation的attempt：subject.end → 有界观察专DB连接归零 → 同时核创建/marker已确认且当前marker相符 → 普通DROP → 再确认数据库不存在 → admin.end。任何确认失败保留UNKNOWN，不使用FORCE/DROP CASCADE、不终止未登记PID。pool.end ACK不等于远端零连接，故单独观察；admin.end仅报告API ACK。

CREATE提交未知且DB已存在但marker未确认时必须KEEP；已有同名DB或reservation均拒绝。既往输出不覆盖，cleanup错误不抹去主失败。真实COMMIT丢ACK仍由首片fake限定验证，本窗口不人为截断COMMIT，不声明HTTP/个人服务恢复。

## 交接

下一步先固定这批输入供独立只读审查，再由Lead安排当前holder与精确30s实际窗口。等待窗口期间owner可安全停止本scope写入，claim保留；任何其他feature另建/领取独立worktree与scope。

## 准备检查

2026-10-06 20:18 UTC，当前fixture源码经局部types exit0，实际wall0.576960s；[v2回执](pg-types-v2.json)。早一版types保留，两个检查都未运行任何module/PG。Mika中间只读指出的结果覆盖与finally错误优先级已修：预查result仅ENOENT允许、result写wx/0600；显式caseFailed与secondary事实保留原失败。正式固定target审查与真实窗口仍未执行。


## 封套检查与质量安全点

2026-10-06 20:29 UTC，[最终6例回执](supervisor-tests-v3.json)与[raw](supervisor-tests-v3.log)：selected6/pass6/exit0，wall0.955762s，fresh free1,383,440,384B。只验证私有监督接缝：stdout/stderr完整合并、输出超限、deadline与TERM无响应、leader退出但子孙仍持pipe、注入EPERM观察和signal。最后源码hash与回执一致；旧15个产品fake和PG types未因封套重复运行。

首轮[4例原始失败](supervisor-tests.json)保留：killpg观察EPERM曾被finally异常覆盖，那个首轮孩子未记录PID，生命周期仍UNKNOWN，不扫描补猜。修复后的v2 6/6保留；v3仅因最终保留raw close失败前的process结果、补精确claim task/role与逐例结果记录而重核。v3真实leader/descendant例PGID391最终观察为unknown/errno1，保持DEADLINE、无继续重发；注入EPERM例也明确unknown，不把测试通过或fixture目录删除表述为全部进程退出。没有新增PG输出、fixture目录残留或真实PG尝试。

本段stack为Python标准库/Node24/pg8.23.1。沿已读本地find-skills、codebase-design与固定clean-code方法复核：probe拥有DB身份/SQL清理，封套只拥有自有进程、有限字节与回执，不内置DB修复；公开transaction接口不变。信号观察错误是事实而非自动升级权限；主故障与清理未知分开。没有可直接复用且满足本片约束的既有封套，采用这一固定命令小封套；不扩成通用framework，后续OPS-001-14由Lead协调，当前产品不为此重开。

正式packet独审与实际窗口均待Lead；独审固定后若仅等待窗口，owner在clean/pushed安全点停止本scope写入，claim仍保留。真实PG、HTTP直接消费者及main集成仍NOT_RUN。
