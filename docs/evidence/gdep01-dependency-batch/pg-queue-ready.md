# GDEP01 专库候选：READY_CLOSED

本入口只指向已固定候选，不另维护运行状态；唯一事实源为[status](../../../plans/gdep01-dependency-batch/status.md)。2026-10-07T22:38:30Z 独立准备审查已批准，0 P1/P2；原件见[审结](pg-preparation-review.json)。PG 当前 **CLOSED / NOT_RUN**，无namespace/新许可/待launch。

- 已审 source：`bcbce5cca9dbe4b8d504e0b06deed40f0039f765`；原准备packet：`98f3ed267102c25d98bb735a46a58306ee70ed64`。
- 唯一固定输入：[pg-runtime-inputs.json](pg-runtime-inputs.json)，SHA `1dc843902fe2f3b1e5727104828180618e1c1b785161314a017b7f4d3bdd2e54`。512输入/20alias原样，不为本次归档改hash。范围限制保留：已知external入口/package，非完整transitive JS/native dylib证明。
- [pg-closed-permit.json](pg-closed-permit.json)保持原CLOSED/expired原件；其旧head不是未来执行head。未来真正外置许可必须绑定 `<FUTURE_GRANTED_EXACT_PACKET_40SHA>`、随机32hex、相邻admission、真实fresh≤60s ledger/head/clean/完整resource terms/free/window/bindings。最终本次metadata40SHA由交付消息给出，避免自引用重提交。
- 实际admin1+aux2=**3 configured PG连接**；无HTTP/listener/boss/runner。未来一次受授权外部admin headroom≥**19=3+16共享余量**，其pool明确关闭后才进入actual；预检的单独预算/实际时钟由新grant明确，不能拿它延长140秒主体。
- 140秒同origin=70work+40cleanup+10子结果+10OPS14 stop+10父回执。完整8目标、原query/oracle/EXPLAIN/锁断言不减，名称/完整argv见[原候选](pg-preparation.md)。0provider，不按预计时长提前释放。
- **DB128MiB与WAL128MiB分别规划**，再加local8MiB（其中raw≤2MiB、TMP≤4MiB、回执reserve256KiB已包含），候选自身规划总量264MiB=`276824064B`。不是一次128MiB合包。共享安全reserve只由manager完整公式计一次，本候选不另叠第二reserve。DB≤128MiB是有限安全点采样/拒绝门槛，WAL128MiB是规划，均不声称硬peak上界。
- private配置仅既有固定Git fixture的合法本地测试admin来源，私下映射 `FLOW_GDEP01_TEST_ADMIN`；不读/输出真实值，不用协调DB。仅loopback/postgres，拒query/fragment覆盖。
- 未知CREATE ACK/identity/owner settlement/连接/关闭/捕获/预算均KEEP/FAIL；无FORCE、terminate、重试或自动重复PG。只有完整known关闭+fresh同identity+0conn+普通DROP ACK/absence，及同TMP identity根检查/ENOENT，才可归还相应资源；业务FAIL和资源CLOSED独立。

这次仅metadata收口，不修改source/原raw/运行输入。原16pure与本8收集0执行保持分列；真实SQL/EXPLAIN/锁等待、end-to-end execute/native/progression/最终JSON组合仍开放，不能据READY_CLOSED宣称整个父验收完成。
