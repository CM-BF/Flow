# S01P04 独立审查

Review target commit: `94b3cfae4be4c7c99b6dc2a224c7e37f63c91d88`

Production target commit: `e1847ce1c66646eb40b7eb4111a31468d4681e1f`

当前结论：APPROVED；chatui01_owner / gpt-6-astra，2026-10-06 11:29:47 UTC，绑定上述94b修复target，原e184唯一P2关闭，无剩余P1/P2。

历史初审：CHANGES_REQUESTED；chatui01_owner / gpt-6-astra，2026-10-06 11:24:47 UTC，1 P2 / 0 P1。准备cd13/目标red2d93已由Mika核验，只是准备和真实失败证据，不代替本固定实现审查。

权威WT `/Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-read-fence`，branch `codex/runner-read-fence`；最初base c450，已审main648经合法scope=[] integration无冲突合入d7e9136f；ENG v3释放后本writer cb7 v2合法追加runners.ts。receipt与48项固定绑定见[manifest](../../docs/evidence/s01p04/implementation-manifest.json)。

只读审查任务：先核实际HEAD/dirty、target source/raw/hash和scope收据。检查仅私有FOR SHARE凭据fence+ownedAttempt首调用，missing/revoked原401、公有lockRunner/ENG claim SQL及所有其他函数逐字=648，runner→task→attempt和同attempt强锁保持，无shared→exclusive升级；maintenance仍只限制新admission，revoke阻断后续读。

原目标red1失败/8未选已冻结；本轮新PG9/9涵盖真实不同attempt并行、同attempt阻塞/seq/幂等、撤销等待与queued-reader复核、drain/hold、容量与未知占用、protocol/goal强锁嵌套及owner/lease保护；ENG直接过滤claim单项1/1、12未选。PG16.13，两个专库实际cleanup成功。局部strict0继承根选项，非根全量检查；只新增测试输出已查询PG版本，无断言删改。

review不默认运行任何测试/PG；对固定target给P1/P2或APPROVED。范围不覆盖吞吐/SLO/>100执行/完整未知claim恢复，main集成和dashboard权威source尚待Lead。修复交唯一owner，writer保留修复期。

## P2 direct-consumer 锁交错断言

`apps/server/src/active-steering/steering.test.ts:193–208` 的等待谓词在第200行限定flow.runners FOR UPDATE。新ownedAttempt SHARE允许两方获得runner锁；acceptSteering实际在loadTask的flow.tasks FOR UPDATE等待。保留真实阻塞和seal/final同事务竞争断言，绑定确切holder PID与pg_blocking_pids，等待task锁。Mika授权原claim追加该单路径；v3已COMMITTED，修复后固定独立target交原reviewer，不改变生产fence。

## 修复独审通过

APPROVED：消费者test-only修复已固定，task锁精确holder/blocker、pending finally收束、409与最终sealed/no-command断言保留。1定向通过/15未选、consumer局部strict0，初次0tests与strict2保留；原9PG+ENG证据未重跑、48固定绑定不变。34项[fix manifest](../../docs/evidence/s01p04/consumer-manifest.json)绑定当前源码/原始证据。原reviewer只读复核此delta与证据，不默认重跑PG；原e184 P2结论作为历史记录保留。

原reviewer只读复核精确task SQL、实际holder∈pg_blocking_pids、final同事务commit后409/sealed/no commands、pending finally收束及专库0连接/absent。34项current与原48项binding逐项Git=WT/hash/bytes；fresh225f4f4b clean/cb7 v3 ACTIVE。实际1通过/15未选、strict0，初次0test/strict失败保留；原10未重跑，累计11不是单次11。review过程0测试/PG/child/provider，Mika已接收，可交Lead受控集成。

收尾metadata仅status/review与Interface页首；Interface旧固定Git支持文档仍可复现，当前新增集成说明已明确声明。没有新source/raw变更或验证，main集成仍待Lead，writer占用保留。

## 2026-10-06 11:59:37 UTC Main接收闭环

已审组合进入main/origin 2f4a5789ee13937914fa2c25161c8d5ed1071550。owner只读核Lead canonical receipt与31 source/raw bytes/SHA全同、3产品/测试源逐字匹配；Lead root strict0，原11 distinct复用，owner0重测。见[main核验](../../docs/evidence/s01p04/main-acceptance.json)。固定APPROVED target仍94b3cfae4be4c7c99b6dc2a224c7e37f63c91d88，生产e1847ce1c66646eb40b7eb4111a31468d4681e1f；历史待集成文字保留，仅本节更新当前事实。提交后停止写入并按v3 release，实际回执项目外保存。
