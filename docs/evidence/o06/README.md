# O06：受限图授权中心交付

实现/review target：`f6ba02e8898ed1539786de381c41402d342e59a8`；base `eb14991a170b72d7d974428b2e440e1faada2c1e`。独立 worktree `goal-graph-runs` / branch `codex/goal-graph-runs`，claim5553ab55-2c0d-4e00-a3f5-54509e90a847 v1。作者 gpt-6-astra。0 模型/SDK query/云调用。

已实现：owner 可持久预授予 fixture graph scope；runner 仅当前 task/attempt/fence 可读固定图底稿、保存有界提案并同事务应用 G01 变更。复用 O03 私有事务授权与单调撤销规则，O05/G01 mutation 同 TX，旧 node grant 不扩权。审计、quota、幂等缓存与图变化整体提交；actor/source 从实际授权身份派生。原项目 owner 流程输出保持兼容，017 不改既有历史。

[接口](interface.md)列具体 routes/shape/错误/字节与分页界限，[设计/clean-code](design.md)记范围及方法，[manifest](manifest.json)固定源码与原始证据hash。

实际最终选择5文件，**34/34**（29.74s）通过：O06运行8 + 真实014→017升级1 + O03授权9 + O05提案6 + G01项目10。最终 tsc --noEmit 通过。原有25消费者测试源码未改。本轮没有将重复红绿/进展运行叠加成更多不同测试。

- [checks-final.txt](checks-final.txt)：完整34条选择/通过数；[typecheck-delivery.txt](typecheck-delivery.txt)：交付类型检查。
- [results-final.json](results-final.json)：运行场景与真实actor/receipt/审计/base分页UTF-8字节/DB清理。三个 limit=1 页面均小于1000 B；该实测不是上限50页的性能测试，也不是token量。
- [upgrade-final.json](upgrade-final.json)：真实1..14状态的旧node grant/call、owner proposal/application/revision，迁移017后逐字段不变、重复迁移时间记录不变，旧HTTP命令cache仍可恢复；两专属随机DB均确认删除。
- 保留 [red-grant.txt](red-grant.txt) 缺路由404首次红；[green-grant.txt](green-grant.txt) 首个1/1；[checks-progress.txt](checks-progress.txt)/[results-progress.json](results-progress.json) 先行8/8。扩展测试最初类型推断过窄（existing ref与空数组）导致 [typecheck-expanded.txt](typecheck-expanded.txt) 失败；明确领域类型后 [typecheck-final.txt](typecheck-final.txt) 与交付检查通过，没有删断言。

关键证据：真实commit后在测试owned onSend销毁socket产生ACK丢失，重启中心实例同key恢复receipt，尽管其自身apply已把图1→8；授权已撤销/取消时不能重放缓存。项目锁控制的真实PG竞争证明授权在当前状态下重验；故障trigger在中间revision失败，全图/history/quota/audit回滚，删除故障后原key成功。并发两grant同base只有一次apply成功。旧node grant对graph403、graph对node403；owner角色仍限制owner routes；native明确409。

复跑（固定Node24/pnpm9.15.4/Vitest4.0.18，现有本地PG55432）：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm install --frozen-lockfile --offline
FLOW_O06_EVIDENCE_FILE=/tmp/o06-run-results.json FLOW_O06_UPGRADE_EVIDENCE=/tmp/o06-upgrade-results.json PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run apps/server/src/goal-graph-runs/runs.test.ts apps/server/src/goal-graph-runs/migration.test.ts apps/server/src/goal-tool-runs/authorization.test.ts apps/server/src/goal-graph-proposals/proposals.test.ts apps/server/src/projects/projects.test.ts --no-cache --configLoader runner
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm typecheck
```

限制：模块自行注册到真实createServer/auth，**共享生产017挂载/client不在本交付**；尚无native graph profile/claim/SDK桥接/NL/真实runner子进程。fixture只验证中心授权和事务，不证明自然语言规划。授权读取整个base graph；allowedExistingNodes只限制写引用。当前共用authority仍通过既有loadState载入当前goal状态，响应轻分页不代表数据库内部读取已全面分页或性能优化。owner可独立应用proposal，此时receipt如实owner，不伪造graph actor。撤销不回滚先前已受理变化，也不等于runner已停止。幂等成功恢复仍受当前权限约束；owner可读持久事实。候选1query预算未执行。
