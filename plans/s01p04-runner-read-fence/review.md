# S01P04 独立审查

Review target commit: `e1847ce1c66646eb40b7eb4111a31468d4681e1f`

REVIEW_REQUIRED：尚无实现独立批准。准备cd13/目标red2d93已由Mika核验，只是准备和真实失败证据，不代替本固定实现审查。

权威WT `/Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-read-fence`，branch `codex/runner-read-fence`；最初base c450，已审main648经合法scope=[] integration无冲突合入d7e9136f；ENG v3释放后本writer cb7 v2合法追加runners.ts。receipt与48项固定绑定见[manifest](../../docs/evidence/s01p04/implementation-manifest.json)。

只读审查任务：先核实际HEAD/dirty、target source/raw/hash和scope收据。检查仅私有FOR SHARE凭据fence+ownedAttempt首调用，missing/revoked原401、公有lockRunner/ENG claim SQL及所有其他函数逐字=648，runner→task→attempt和同attempt强锁保持，无shared→exclusive升级；maintenance仍只限制新admission，revoke阻断后续读。

原目标red1失败/8未选已冻结；本轮新PG9/9涵盖真实不同attempt并行、同attempt阻塞/seq/幂等、撤销等待与queued-reader复核、drain/hold、容量与未知占用、protocol/goal强锁嵌套及owner/lease保护；ENG直接过滤claim单项1/1、12未选。PG16.13，两个专库实际cleanup成功。局部strict0继承根选项，非根全量检查；只新增测试输出已查询PG版本，无断言删改。

review不默认运行任何测试/PG；对固定target给P1/P2或APPROVED。范围不覆盖吞吐/SLO/>100执行/完整未知claim恢复，main集成和dashboard权威source尚待Lead。修复交唯一owner，writer保留修复期。
