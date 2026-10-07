# GDEP01 真实SQL验证候选（CLOSED）

本片准备验证有序依赖批读的真实数据库结果、返回正文量与事务边界，不执行PG，也不将局部类型/静态收集当作通过。产品仍e1b0277，固定基线69a71e3；所有原16pure和首红保留。

唯一入口 `pg-entry.py --permit <绝对树外许可路径>`，使用固定 `/opt/homebrew/bin/python3.13 -I -B`；许可相邻同stem `-admission.json`。未来完整argv：

```text
/usr/bin/env -i PATH=/opt/homebrew/opt/node@24/bin:/opt/homebrew/bin:/usr/bin:/bin FLOW_GDEP01_TEST_ADMIN=<private supplied, never logged> /opt/homebrew/bin/python3.13 -I -B /Users/citrine/Projects/AgentHarness/Flow-worktrees/goal-dependency-batch/docs/evidence/gdep01-dependency-batch/pg-entry.py --permit <FUTURE_EXTERNAL_ABSOLUTE_PERMIT>
```

private来源只允许已审Q01 fixture的本地测试admin配置供给；记录其commit/path在pg-provenance，不读取真实值，不以协调账本DB替代。URL须loopback/postgres且无query/fragment覆盖。后继manager先给唯一OPEN、fresh≤60s exact claim f244…v2 / 6 scopes / 最终packet40SHA / clean / 完整resource terms与free；许可绑定pg-runtime-inputs SHA、随机32hex window、唯一不存在的pg-run-window目录；先单admin真实headroom≥3+16且关闭，再启动。当前closed文件不是运行权，不创建namespace或actualpermit。

## 候选资源与生命周期

140秒共同origin：70work（包含测试模块加载、CREATE、迁移与八例）、40cleanup、10子结果、10OPS14 TERM3/KILL7、10父回执。fixture中admin max1 + aux max2 = **3 configured connections**；无center、runner、boss、HTTP或listener，所以0HTTP输出。不是17或24连接。两并发borrower仅用于原project锁测试；既有database.transaction负责callback checkout/error listener/rollback/release，不替换其实现。

复用Q01已审markedDB fixture和OPS14入口，只移除不存在的server/boss/HTTP owner并缩小pool。durable CREATE intent→ACK→OID/owner→marker→identity receipt后才允许已知normalDROP。背景首错停止新work，finish仍收束所有pending/aux/admin；资源已闭合但断言/背景失败仍FAIL。创建ACK/身份/settlement/关闭/观测未知均KEEP，不能靠名字认领、FORCE或terminate。DB在created/work-completed/before-drop有限样本≤128MiB，**不是峰值硬cap**；WAL128MiB仅规划储备、非WAL实测。至少零连接、同identity复核、普通DROP ACK+absence，再admin关闭，才记录CLOSED。whole140秒不是OS保证，未知不能自动释放预算。

未来local 8MiB（含raw2MiB、TMP4MiB、receipt reserve256KiB）；≤64 fixture阶段receipt、每份16KiB；Vitest JSON≤256KiB、OPS stdout≤128KiB。父caller在删前有限entry/bytes/deadline采样，再同root dev/ino/non-symlink/canonical门禁清理；是有限观测而非硬配额或峰值证明。父输入绑定已有物化483file及实际新源、SQL、外部package/入口/native；外部完整JS/native dylib闭包并未由package metadata证明，未来actual准备review要核明此边界，不以manifest数量冒充全依赖完整性。

## 八个固定用例

1. `reads 199 ordered short dependencies once and records the actual SQL plan`：真实product query一次，旧顺序SELECT逐项独立oracle（199次），精确正文与顺序、decoded content UTF8 bytes；捕获实际product SQL/params再EXPLAIN ANALYZE BUFFERS FORMAT JSON TIMING OFF一次。不用新实现相同SQL作oracle，不将cost/elapsed作速度收益。
2. `keeps zero-query empty input and exact duplicate ordinals`：0依赖零查询，重复同tuple按ordinal原样返回。
3. `includes the 48000-byte boundary and its complete crossing row`：48000/空正文/首跨界1B，实际只返回3行48001B。
4. `bounds returned legal content by 48000 plus one complete 1MiB artifact`：完整跨界行返回，48000+1048576B解码量，不把任意损坏超大DB行纳硬界。
5. `preserves UTF16 sizing without normalizing Unicode or line endings`：emoji/组合字符/CRLF/反斜杠原bytes。
6. `requires each of the four binding identities`：task/artifact/version/detail每键错配都等旧错误。
7. `preserves missing hash and length first-error order`：前大后缺、前缺后大、前坏hash后大、前大后坏；错误status/code/message与旧路径一致。
8. `rolls back caller writes and retains the existing project lock boundary`：真实transaction错误回滚、原loadProject FOR UPDATE排他，第二borrower100ms锁超时后释放，第一事务结束后可重新取锁。

所有seed是受控直接SQL，保task/runner/attempt/detail/artifact外键，**不证明公共runner写入**。使用生产migrate(001 inline+002)和migrateProjects(004)，这些动态SQL在已有固定供给与本manifest内；不使用不必要的全server migrations。

最终executeGoalNode JSON prompt.length16000、owner-native与progression共用seam、权限/CAS/项目写锁上下文产品逐字未改，第一段commands类型覆盖有效；本八例只验证内容helper和实际project锁原语，**不冒端到端execute/native/progression API回归**。这部分后继consumer组合仍需Lead在实际验收点选取，PG与EXPLAIN/锁等待结果当前全NOT_RUN。
