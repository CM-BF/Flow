# REQ15 PG source packet

状态：SOURCE_PREPARED / REVIEW_PENDING / TYPES_COLLECT_PG_NOT_RUN。两份SQL供给已解除；没有实际窗口、启动回执或结果文件。SVC07首次真实HTTP仍优先。旧26/26 fake与strict-v2 exit0保持原范围，不代表这份新fixture已通过类型、导入或数据库检查。

原设计与driver接缝已获静态接受，本次实现新增3个TS文件：`pg-fixture-data.ts`只负责有界seed与独立期望；`pg-read-observer.ts`只负责专属subject的观察和查询屏障；`pg-turn-page.test.ts`负责两个case、公开接口与专库生命周期。`execute-pg-once.py`是本片一次性调用方，使用固定SVC07纯监督函数，不复制监督循环、不调用其main、不修改旧入口。产品8路径与d209固定source相同；database.ts是本树base版本，不冒称已集成SVC07。

## 输入与执行前置

[pg-prepared-manifest.json](pg-prepared-manifest.json)固定静态import可达源、4份SQL、配置和本片支持文件。所有产品与同树`@flow/contracts`来自既有供给；未新增依赖或跨树产品import。外部9个入口按`dependency-request.json`核realpath/package hash；pg8.23.1/pg-protocol1.16.1观察源码另按`pg-driver-inputs.json`8个文件核hash。唯一跨树执行依赖是已审supervisor SHA `982c2e5a7a1acc98256413ceaf84c9b207a7ec481bbeb0c0462bc41892b51dc0`，仅在本进程注入ROOT；OPS14迁移未授权。

独立review绑定完整commit后，由review交接给出该40hex HEAD与manifest SHA作为命令参数。manifest不自包含；window文档不填自引用commit。输入或HEAD变化须重新绑定，不因同分支推断仍获批准。

未来唯一PG命令如下，当前禁止执行；`REVIEWED_REQ15_HEAD`与`REVIEWED_REQ15_MANIFEST`须来自本packet独审回执，不能现场取未知HEAD代替：

```sh
source /tmp/flow-coordination.env
export FLOW_REQ15_TEST_ADMIN="$FLOW_COORDINATION_DATABASE_URL"
/opt/homebrew/opt/python@3.13/bin/python3.13 -B docs/evidence/req15-turn-page-batch/execute-pg-once.py --expected-head "$REVIEWED_REQ15_HEAD" --manifest-sha256 "$REVIEWED_REQ15_MANIFEST"
```

cwd固定 `/Users/citrine/Projects/AgentHarness/Flow-worktrees/conversation-turn-page-batch`。wrapper重新核branch/head/clean、claim09b83400 v1全身份10scope、input/deps/driver/supervisor、6项输出absent、admin已配置和PG free≥1207959552B，预留64MiB后≥1GiB。失败HOLD/不spawn fixture/不消耗一次性文件，不循环重试；ledger读取可能使用现有协调连接，与fixture三个连接分时。

## 两case与口径

PG1插入53个task（主conversation51、foreign1、snapshot1）；session重复由同task/attempt两个detail表示，session PK保持唯一。legacy歧义用不同artifact_id/version；corrupt先写正常body及full digest，再仅改suffix，且保留有效legacy artifact，证明typed invalid不会fallback。前50投影输入精确排除第51坏项；后一页独立读出invalid。断言配对unnest、JSONB session evidence、每task LATERAL LIMIT2、owner/runner/harness/current-attempt、typed/no-final/legacy、顺序/empty/404、UTF16边界与full UTF8 digest。期望来自seed的显式状态/文本；不调用新turnView充当唯一oracle。

PG2的屏障在真实task SELECT完成后、返回给产品之前触发；writer在另一连接同事务改task title与final body/digest，得到COMMIT ACK后才继续subject。旧页面须旧title+旧reply，下一事务须新pair。无sleep、无伪造行、无重执回调。

observer在建库/seed完成后安装，因为Pool.query内部使用callback-form；测量阶段只有public transaction的Promise-form查询。只对专属subject的Connection增加rowDescription/dataRow/readyForQuery listeners，保持driver原监听顺序，不监听error/generic message、不改fields、队列或结果。SQL调用与ReadyForQuery必须相等，字段格式必须text，subject预核UTF8。统计DataRow字段UTF8载荷，`prefix`、legacy `content`和其它字段分列；另算page JSON UTF8字节。没有协议头/长度/TCP/TLS，不称完整wire bytes；legacy仍全文传输，typed仍在PG全文hash，不声称消除TOAST/hash。记录当前实际值，无历史252SQL或旧fake214基线混用。

部分canonical schema只覆盖读取：migrate inline1+002，另加载007/009/025。无context input行，不代表完整迁移、context写路径或HTTP通过；冻结settings/observed读取有真实断言，context已有fake仍待集成消费者验证。完整HTTP旅程按原设计留Lead集成点。

## 预算、输出与清理

最多admin/subject/writer各1连接；固定独立application_name。20s工作、27s清理截止，监督child截止为wrapper起点+27s，最多另1s自有组终止观察，总30s预算覆盖准入与后处理。每query statement2s/query2.5s/connect1.5s；无后台worker/server/provider。原supervisor立即fsync PID/PGID，三态group和早期unknown保持；阻塞checkpoint方法本轮不迁移，宿主文件I/O不是实时隔离，whole wall超30s必须UNKNOWN，不能仅以supervisor elapsed宣称全程达标。

所有实际输出均本目录、wx/0600：`pg-run-reservation.json`、`pg-database.json`、`pg-result.json`、`pg-output.log`、`pg-exit.json`；临时目录`pg-tmp`0700。raw合并stdout/stderr≤64KiB，三份fixture JSON合计≤32KiB，正文总seed+corruption参数≤4MiB/单正文≤64KiB。TMP只做前后采样≤32MiB，非实时硬隔离；预期空，identity相同才rmdir，任何未知内容保留，不递归删。

setup/case原Promise被保留跟踪；deadline只结束观察，不能提前release/reuse仍运行的client。cleanup先等原Promise结算，再等subject/writer.end ACK；admin核精确OID+marker+owner、连接0、再次核身份，才普通DROP并确认absence，最后admin.end。CREATE/DROP/close unknown保留身份，不terminate/FORCE/猜库重试；所有cleanup异常只记secondary，不盖原始失败含非Error。未知后仅允许先只读核对固定库/OID/marker/application/backend与own组事实，后续清理另交接。

raw完整性、业务exit与生命周期分别记录；非零业务exit不是capture不完整，早期EPERM不能因末次absent被抹掉。selected/pass取Vitest实际summary，并要求两个case回执与exit0一致才算行为通过；source里的两个it不算2 selected。

## 未执行的局部检查入口

下面只是精确payload，不授权直接裸跑。收到专属轻窗口后，必须由既有30s/64KiB监督、fresh light floor1107296256B与独立TMP封套执行，清除PG_OPEN/admin变量；collect与types各一份新raw，不覆盖旧26/strict：

```text
/opt/homebrew/opt/node@24/bin/node node_modules/typescript/bin/tsc --noEmit -p docs/evidence/req15-turn-page-batch/tsconfig.pg.json
/opt/homebrew/opt/node@24/bin/node node_modules/vitest/vitest.mjs list docs/evidence/req15-turn-page-batch/pg-turn-page.test.ts --config docs/evidence/req15-turn-page-batch/pg-vitest.config.mjs --configLoader runner --no-cache --no-color
```

list只collect，不运行beforeAll；config无setup/globalSetup，顶层仅读固定JSON/构造本地数据/注册用例，Pool实例与DB启动在guard之后。预期collect2必须由实际输出证实，不能当pass。当前0import/types/collect/tests/PG/HTTP。
