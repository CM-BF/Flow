# B01 执行记录

- 2026-10-06：初次 `Node24 tsc -p experiments/bounded-reads/tsconfig.json --noEmit` exit 2，6 个同类错误：randomUUID 默认参数推导为 UUID template literal，真实 runner token 为 string。仅修复测量 request 的 token 参数显式 string；未修改产品代码。此失败保留，不记通过。

- 2026-10-06T03:35Z：修后局部 TypeScript 检查 exit0。初轮 `PATH=/opt/homebrew/opt/node@24/bin:$PATH node --import tsx experiments/bounded-reads/probe.ts ../../docs/evidence/b01/initial-results.json` 实际额外带不存在的可选 env-file，Node提示后继续，未加载任何env；测量15.395秒/exit0/23命名检查/47,496,585响应字节，全临时资源清理。`initial-results.json` 为原始结果不覆盖。无Vitest选择，本轮是23个执行过的HTTP/SQL断言组，不把它们称为Vitest通过数。

- 2026-10-06T03:40Z：补充测试类型检查首次exit2，pg.query重载的ReturnType取到void；改为明确Promise<QueryResult<{cursor:number}>>。一次只读module路径诊断错误地使用import.meta.resolve的未启用parent参数，exit1；改用createRequire(本WT server入口).resolve，确认返回本WT contracts源文件。均非产品运行失败，不删除记录。

- 同一局部检查第二次exit2：noUncheckedIndexedAccess要求处理rows[0]缺失。断言改用可选读取后expect cursor=1，缺行仍失败；未删除断言。

- 2026-10-06T03:41:34.867Z–03:41:52.313Z：8项真实PG功能回归初跑exit1，7通过/1新测试失败。原始[失败报告](workspace-tests-failed.json)/[命令](workspace-test-command-failed.json)留存（原输出名workspace-tests.json已归档）。新测试让第二writer持有task FOR UPDATE并同步等待workspace插入；现有FK key-share须等待该事务，最终10秒SQL timeout，HTTP500被测试误作page读取。修正测试事务时间线：证明第二writer等锁并读到cursor1后释放读锁，观察第一提交，再重新锁定写入/提交cursor2；保留原全部行为断言，不改产品锁语义。旧late-commit/201task/并发投影/450事件前缀均已通过。该轮有共享主机背景负载，不记性能证据。

- 2026-10-06T03:42:24.054Z–03:42:29.801Z：修后同8项真实PG回归exit0，8通过/0失败/0跳过，5.747秒；schema清理仅发生于当前运行新建专用库。类型检查随后通过。性能正式修后复测待Web窗口完成。

- 2026-10-06T03:44:52Z：mika独立Node24/Vitest4.0.18复跑8/8通过，5.98秒，target70af7b4；原始stdout复制SHA-256 `3677d88c1461fb9d48f7742eee7f25d30fc4074a79d74b3bf2a5b89111d5413e`。实现与方法APPROVED，性能after证据尚待执行/复核。

- 2026-10-06T03:46:01.332Z–03:46:10.218Z：Web正式窗口释放后，已审70af7b4的metadata HEAD748df2d运行after probe。exit0/23检查/47,496,555响应bytes/8.887秒；五库drop、HTTP/pool全关闭。运行前git diff --exit-code验证产品/测试/测量与70af7b4一致；没有再次跑已8/8通过的同套测试。after JSON保留UTC、PID派生DB名、动态端口、源码hash、原始样本和EXPLAIN。
