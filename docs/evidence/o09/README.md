# O09 独立 owner 原生节点执行：作者交付

2026-10-06 08:00 UTC；实现 target **7ddd763a2e2274c040dea7e114dcf6d6da226cf6**，base **84fdecebbb4939e43710fb17e48884cc49d1d030**。唯一owner assignment_review / gpt-6-astra，claim34990d98-4a70-4464-b0e2-a3bf561ab053 v1；尚未独立review/生产挂载/main接收。

新增 owner-only `POST /api/goals/:id/native-executions`，显式固定 `configured-readonly` Claude profile pin。旧 GoalCommand/GoalToolPort 的 execute schema保持fixture；新入口不暴露给planner。节点输入、精确依赖、前次执行状态、K03知识冻结、task/wake/execution/explanation使用同一已有 execute 深模块与同一事务。没有新迁移、scheduler、runner字段或第二agent loop。

原node grant现在只能接受fixture产物，native交付拒绝403，scope/有效attempt授权仍先于receipt。owner新受理以独立命令operation持久幂等，已提交receipt在撤销profile后仍可恢复，它不复活runner/启动新任务；claim继续核固定profile身份。owner原accept-delivery是显式业务接收声明，不是自动语义验证。

## 实际验证

| 原始输出 | 实际范围 | 结果 |
| --- | --- | --- |
| admission-red.txt | 公开owner新入口尚无实现 | 1 red，404而非201 |
| admission-first-green.txt | 同key unread response后center重启恢复 | 1/1 |
| grant-red.txt | 旧node grant缺native接受拒绝 | 1 red，409而非403；4未选 |
| admission-five.txt | 扩展受理与旧grant测试 | 4通过/1失败，失败是测试fixture adapter导入路径错误；并非产品权限失效 |
| grant-green.txt | 修正import后旧grant隔离+fixture执行/接受 | 1/1，4未选 |
| runtime-first.txt | 原Claude adapter注入query三场景 | 3/3 |
| **domain-final.txt** | 最终新domain公开HTTP/PG与实际adapter注入 | **9/9，11.21s** |
| **consumers-final.txt** | 旧O01/O03直接消费者，未修改原测试 | **18/18，24.75s** |
| typecheck-first.txt / typecheck-second.txt | root tsc --noEmit（最终第二次含全部source） | exit0 |

最终是 **27个不同检查，9+18两次执行**，不是单次27/27。前面重复迭代不累计为不同检查。0provider、0真实SDK native query/认证网络；3个runtime测试调用的是注入的ClaudeQuery，覆盖真实runner、durable outbox、HTTP/PG、产物及独立flow.text verifier。旧fixture消费者包含原有独立进程，不冒称本片native实际child进程或provider实测。

新9项覆盖：丢ACK正文不读后重启receipt、同key异内容、并发1受理；owner/runner权限、伪造输入、none/goal/graph模式、错误pin及撤销；当前input/dependency/predecessor不一致，queued前次不得重复，lease失联uncertain重启仍不重派；旧planner不能调用native/接受native，原fixture execute+accept仍通过；指定profile的runner claim、普通purpose无node/graph grant；实际adapter请求model/Read工具与禁止Write/Bash、host material snapshot授权、凭据env隔离；中文emoji精确final→typed message→artifact/机械验证；完成后accepted仍null，owner显式接受后current；K03原冻结知识到实际query prompt，后来source版本更新后仍执行冻结旧input但拒绝业务接受；SDK is_error=true没有可用final/artifact。

## 数据/资源与失败

每个newdomain测试文件独立随机 `flow_o09_*` DB、动态端口、随机owner token、私有tmp。最终admission-cleanup.json/runtime-cleanup.json记录各自DB remaining=[]；所有启动的本测试runRunner均abort并await，native query close断言验证1次。中途错误import在runRunner启动前失败，只留下空的自有 `flow-o09-fixture-T8xI2X`，已明确仅rmdir该空目录，原失败stdout保留。旧O01固定flow_o01通过原advisory+不存在保护后创建，suite清理；O03随机flow_o03_*，原suite负责清理。个人b54服务/用户tabs不操作。

install.txt是Node24使用既有锁 offline frozen/ignore-scripts本地链接；没有改manifest/lock或借global依赖。run命令：`PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run apps/server/src/goal-native-executions/admission.test.ts apps/server/src/goal-native-executions/runtime.test.ts --no-cache --configLoader runner`；必要旧消费者命令将两文件换为 `apps/server/src/goals/goals.test.ts apps/server/src/goal-tool-runs/authorization.test.ts`。类型命令为 `pnpm exec tsc --noEmit`。仅在隔离测试资源与当前claim范围运行；0provider。

## 未覆盖/限制

生产factory挂载/client/export由Lead后继接线，本次测试在真实createServer初始化后通过hasRoute guard注册新module。没有Web/CLI入口、真实模型/语言质量/费用/工程写改授权，也没有planner自动执行children。readonly profile是真实已登记声明与本地guard匹配，不证明provider可用或组织插件完全隔离；现只读材料权限保持原实现。任务失联/外部副作用未知仍走C02，不盲重试。业务语义由owner明确决定，flow.text只检查指定机械规则。完整产品O01/U11后继继续open。

fixed源码/必要未改依赖/raw bytes+sha256见manifest.json；作者质量复核不是独立approval。
