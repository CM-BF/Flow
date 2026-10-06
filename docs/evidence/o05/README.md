# O05 有界目标图提案交付

2026-10-06T05:14:58Z，实现 `1f211995daae06b23cf98400199ef4d3cd3995b0`，base `da8d73a984118e0a5c406bd04dbfbc5d5c9c148f`，canonical `/Users/citrine/Projects/AgentHarness/Flow-worktrees/goal-graph-proposals` / `codex/goal-graph-proposals`。单owner assignment_review/gpt-6-astra。生产模块与测试固定，待独立review，不称main已集成。

已实现owner-only持久候选提案、轻量有界列表、按id正文、同事务应用与不可变回执。请求1..16新增节点/≤128新增边/64KiB，全图继续由G01限制200节点/2000边及无环。server从goal导出project和原始goal digest；不接受HTTP actor/source伪造。source=owner-submission仅表明实际owner提交，文字原始作者未知；apply actor=owner由真实入口决定。没有扩旧grant或新增模型写图工具。

apply按项目锁串行，再核提案digest/baseRevision/goal绑定，复用原G01 callback提取的applyProjectCommand；先加全部新节点，再建立其依赖。原G01 HTTP command/幂等外壳和内部CAS/绑定/无环/写SQL保持。一个提案会产生若干G01历史revision（diamond 1→8），**全部变化与应用回执在同一事务提交**，不宣称单revision。失败全回滚；真实nodeID mapping保存在receipt，重复应用（含不同key）不重新建图；同key异内容拒绝。列表查询不读取input正文，最大50项，详情按需读且不静默截断。

## 实际检查

Node24.20.0 / pnpm9.15.4 / Vitest4.0.18 / 本机真实PG，随机 `flow_o05_<uuid>` 专属DB、动态HTTP端口。公开HTTP是真实createServer鉴权/中心与手动注册本新module；共享生产index尚未挂本module。0模型/云，不启动runner进程、SDK query或认证。

首条缺功能时201期待得到404：[red-proposal.txt](red-proposal.txt)；实现后首条1/1通过：[green-proposal.txt](green-proposal.txt)。最终新模块6项+原G01直接消费者10项，**16/16，8.25s**：[checks-progress.txt](checks-progress.txt)，类型检查通过：[typecheck-progress.txt](typecheck-progress.txt)。progress文件名为保存时名称，其内容是本固定实现最终组合检查，没有隐藏后续失败或重写它。未重跑O04 103项或全库。

- 持久diamond、正文按需读取、关闭并新建server后恢复；同key重放/不同key已应用receipt不重建。
- 重复key、缺失/循环/跨project/过期ref、节点/边/字节上限、actor/source伪造拒绝。
- 3提案分页，每页实际UTF-8响应小于1000B；完整reason仅detail返回。仅该合成payload字节观察，不是性能或token结论。
- 同base两个proposal并发应用仅一个成功；另一个409，不静默rebase。
- 测试自有PG trigger在第2次project更新故障，HTTP500后全部revision回滚到1；去掉该故障后相同key可用。onSend在commit后断开一次本server响应连接，随后重启并同key得到原mapping/receipt；未从socket关闭推断事务停止。
- 旧fixture grant被当前runner claim后，对新增节点的define-input仍403，quota仍0；owner proposal/apply入口拒runner角色。goal原文digest故障注入改变后拒绝，测试还原其自有记录后合法应用。
- 原G01 10项覆盖node/edge总限额、CAS/图循环/owner鉴权/任务绑定/immutable历史等直接消费行为。

原始结果 [results.json](results.json)（SHA256 `f21ad122aa92bb917f5f664d758df08009ee531cb1fc2f7814c67eb7212432ee`）保存实际proposal、mapping、图、响应状态与bytes及专属DB删除确认；无凭据。代码与输出hash见 [manifest](manifest.json)。所有临时DB/pool/boss/HTTP由各测试清理；未操作4320/61228等现有服务。

## 复跑

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm install --frozen-lockfile --offline
FLOW_O05_EVIDENCE_FILE=/tmp/flow-o05-independent-results.json PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run apps/server/src/goal-graph-proposals/proposals.test.ts apps/server/src/projects/projects.test.ts --no-cache --configLoader runner
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm typecheck
```

新module不执行任务、不修改既有节点/GoalInput，不等于自然语言拆图或完整目标交付。后继独立graph权限可以owner一次预授予有界范围，不要求每步人工批准；不能将旧allowedNodeIds解释为图写权。native语义预算“1query/4turns/SDK$.20/90s”仍为待批准提案；需O04+O05固定main独审/config前置，合成goal+专属PG/tmp，失败不补次、不挪封存预算。当前0调用。

2026-10-06T05:18:55Z Mika独立只读APPROVED `1f211995daae06b23cf98400199ef4d3cd3995b0` / clean `ba1a670e452e08a01321a806967fa04db37bd591`；7source/7output及原manifest `63e16bfbd31d677c47f07ff8947fd2bc930cc56d8fdd39dc4ef14cc14bd3a7f7`已核，原10项G01断言未改；作者16/16+tsc与回滚/ACK/CAS/旧grant/清理原证据正确，无blocking，Mika未重跑。源码冻结，本片段stage integration，main挂载/接收另由Lead记录；预算未授权执行边界不变。
