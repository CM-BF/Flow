# S01 独立审查

状态：APPROVED
Review target commit：9da9de1b6778afec5219e55f39b53b365c8cf900

批准范围：`experiments/runner-capacity` 的8任务协议超领门禁和16任务四进程测量入口，**仅运行准备**。运行必须有Goal Owner/Execution Lead协调的窗口；未批准容量结果、ACK故障或浏览器后继。生产基线115b0dbdfa02db5483f9e9699852682ce699633c，apps/packages零diff。唯一owner Mika / gpt-6-astra，worktree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-capacity-probe`，branch `codex/runner-capacity-probe`。

独立reviewer `/root/b01_bounded_reads` / gpt-6-astra，于2026-10-06T07:00:33Z只读核查；现场metadata8c5edbfae84d8ca1063cf52e46183a049a775f05 clean。15源码/配置与target/工作树逐项同hash，2raw日志同hash；6纯统计/预算unit tests通过、noEmit0。review者没有运行测试、数据库任务或服务。参见[固定准备证据](../../docs/evidence/s01/window-readiness-manifest.json)、[独审回执](../../docs/evidence/s01/window-independent-review.json)。

## 验收与修复

已核：128空会话完整分页/DB零turn；16任务预受理后四进程共同放行；96 runner events、80 timeline、96 workspace独立游标/内容对账；工具/adapter/人工等待独立计量；首次claim租期推导的时间区间及量化边界；四端点single-flight轻读、真实PG版本/连接分类；20秒工作+10秒清理；同scenario禁重跑、累计64 tasks/attempts及180秒含清理预算；旧run缺完成receipt时拒后继，formal必须先有成功gate。

c32d4d1 formal与6c5568a gate初审的两个P2：末次terminal后读取混入load；gate遗漏完整证据存储字节。9da修复已复核：立即break并保留四端点n=0/active与queue-only分类；完整DB+既有evidence+run-start/owned-process+最终JSON核算。PG版本P3也已补。无未解决P1/P2。

非阻断后继事项：ACK故障阶段若领取但尚未emit，不能仅用report-start计attempt；实施该后继前改claim-grant或保守reservation并测试未知ACK计数。当前两份已审smoke历史均完整计8tasks/8attempts/7154.493916ms，gate失败阻止formal，当前窗口最多累计32tasks，不受该后继事项影响。

## 历史已批准片段与证据边界

- 合同target a553f3f由Execution Lead/Goal Owner独立核对，要求single-flight及总时限含清理，允许首4任务功能smoke。
- bfe49a4首轮smoke整体FAILED：动态SQL引用不存在的attempt.created_at；4任务/24事件/清理局部通过不能抵消失败。[原始结果](../../docs/evidence/s01/smoke-first/result.json)保留。
- Goal Owner批准从可选declared-capacity4对照扣4，使该组16→12，允许一次额外4任务修复复核，总64不变。[分配记录](../../docs/evidence/s01/budget-reallocation.json)。
- 执行53c8713、review target65d7a57的smoke-repair于2026-10-06T06:42:10.555→06:42:13.377通过。独立worker于06:43:50Z APPROVED该功能片段：4任务/24事件/4工具，3进程exit0、DB及outbox清空，12source前后同hash；原失败不改写。见[smoke证据](../../docs/evidence/s01/smoke-manifest.json)及[历史独审](../../docs/evidence/s01/independent-review.json)。smoke8额度已用尽，入口已封闭。

所有上述批准均不表示main已集成或个人服务已刷新；纯unit检查、协议claim容量、真实fixture执行、实际provider能力分开陈述。正式窗口尚未运行，没有容量或SLO结论。

## 可复制复审步骤

先核权威worktree/branch/head/dirty和原子claim，按find-skills本地优先方法复用clean-code/codebase-design。读取固定target9da的实验目录、window-readiness-manifest、status及原始logs；对照115b实际公开HTTP/schema与runtime，不依赖README想象字段。核先gate后formal、精确预算及同scenario不可重跑、初次lease时间来源、三个event游标空间、IPC时钟边界和finally自有资源回收。review只读，具体修复交唯一owner；不启动服务/负载，未取得协调窗口不得运行正式入口。新增源码或窗口结果需要新的限定审查，不沿用本准备批准。
