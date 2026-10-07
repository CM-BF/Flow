# CORE mixed queue claim eligibility

本轮13:05:32–13:25:32 UTC，source-only，2MiB源码metadata；0工程child/types/collect/PG/HTTP服务/SDK/provider/browser/install。13:07:25 fresh free21,695,791,104B高于6,914,834,432B；没有用这个只读样本取得执行准入。

## Module / Interface

现有server allocateClaim拥有runner锁、capacity、任务选择和attempt事务；v1/v2/v3共用。published profile是不可变配置权威，task.executionProfile/messageSettings是受理时冻结值。新增一个SQL谓词只作用于Claude任务且当前runner profile包含turnSettings：executionProfile必须等于现profile id/runner/digest，snapshot协议和profile必须匹配，然后才ORDER/LIMIT。完整choice/purpose/session/revocation后置校验仍由assertTaskExecutionProfile执行。普通fixture任务、无turnSettings的runner、既有机会回执读取与锁序不变。不增加新registry/DTO/DDL/runner/授权事实源。

## Prepared behavior (NOT_RUN)

3个test.each展开用例分别通过公共v1/v2/v3领取；先排无pin旧任务与有pin无snapshot历史种子、验证empty/missing，再加入合法opt-in任务并用原key领取；旧runner仍领旧任务。v2/v3重放保持attempt/owner/lease字节，stale owner events409且无写。另1例公共session事件→后续resume仍原runner，新runner取更晚合法工作；另1例多harness runner普通fixture保持原路径。总5例、10注册runner、13task、10attempt；历史缺snapshot仅一个/协议的明确synthetic SQL种子，其它注册/profile/task/claim/events均计划真实HTTP。ready位只控制scheduler readiness，不伪造claim资格。0模型执行，配置别名仅测试值，不称账号可用。

## Resource preparation / errors

复用已审REMOVAL helper1424（fixture-source.json绑定），只改输入protocol一个literal；继续其已有FLOW_X01_PG环境界面，不造第二监督器。未来独立180s=110work+60cleanup+10final，1随机markedDB、1port0、pool4+server8+boss3+admin1=16连接（保守17）、160HTTP/128KiB每响应/4MiB每suite；32MiBTMP/4096entries、1MiBraw、DBWAL128MiB+1GiB不可支出reserve。实际input/caller/动态35SQL与外部依赖完整绑定、准入/operator/唯一namespace仍后续准备，当前没有actual recipe/OPEN。owner close、同OID/owner/marker、有限count0等待、普通DROP/absence与进程EOF/TMPidentity沿现helper；unknown KEEP，不terminate或FORCE。

性能只说明资格过滤在LIMIT前，不声称EXPLAIN/索引/时延已测。pending旧task可能留在队列，必须由旧runner或明确维护决定，不能借新runner强接旧native session。

## Skills / clean-code

已按本地find-skills方法选择而未联网安装：/Users/citrine/.agents/skills/find-skills/SKILL.md；brainstorming/SKILL.md；codebase-design/SKILL.md；clean-code/SKILL.md（用户既有固定sickn33@bdacd76来源基线）。实际应用：先锁状态所有者/profile immutable与当前真实consumer，共用一个allocation边界，保持后置错误语义，SQL小delta而不复制选择器；测试复用已审资源helper。source-only无行为通过宣称。交付前复核命名、职责、错误/取消、DRY和生命周期，未消除未知副作用窗口。


## Static closure snapshot

source-closure.json记录fixed7524与当前3个自有TS入口的静态依赖（含33 SQL），逻辑1,023,900B，external为已声明模块名，unresolved=[]。这是只读Git字节发现，不代表物化、模块成功import、外部依赖字节已绑定或动态运行闭包已通过；下一准备段需精确供给+types/list，实际PG仍需完整外部/符号链接/caller输入与唯一窗口。没有复制旧29项检查为本轮证据。
