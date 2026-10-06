# O16：真实连续目标最小验收候选（只读方案）

父任务仍为 FLOW-001，覆盖 O01-05/O12-05/M02；不是新大任务。本方案尚未 take、创建树、import、测试、PG 或 query。只读基线 0132ac255002eb61272401bfd97b3dbb65302644，22 个实际输入字节绑定见 `/tmp/flow-o16-continuous-native-proposal-inputs.json`。

## 三个精确 scope

- `experiments/continuous-goal-acceptance`
- `plans/o16-continuous-goal-acceptance`
- `docs/evidence/o16`

建议源稀疏 WT `Flow-worktrees/continuous-native-goal-acceptance` / `codex/continuous-native-goal-acceptance`。正式 base 与 fresh O16 ID/ledger 由开工时固定。没有 apps/packages/shared/旧 O08/O10 写权，不增加生产 API、SDK loop、scheduler 或 grant 类型。

## 一条实际链与有限入口

同一个实验入口保留 goalId/entryId，提供 `prepare/rehearse/plan/confirm/inspect/verdict/cleanup` 的有限动作；它是公开产品的验收 driver，不新增领域状态权威，也不冒充已完成的 Web/TUI 同入口体验。

1. **自然语言 intake。** 使用 O13 `createGoalEntry` 的持久 store/key 建立一个合成产品目标：根据唯一固定材料先形成发布说明草稿，再依赖草稿核对事实并交付修订稿；不得增加材料之外的承诺。输入只有用户需求、约束、验收和固定材料版本引用，不预写图标题或两份 GoalInput。
2. **一次真实 planner。** O12 `createGoalSession.command({kind:'graph-plan', ...})`，O07 host bridge + 原 `runRunner/createClaudeAdapter`。owner 显式 grant `inputProposalProtocol:'flow.goal-input-proposal.v1'`，上限 1 proposal / 0 applications / 2 nodes / 1 edge / 空 existing nodes。模型经原两个 graph 工具自行提出两份完整 GoalInput（goal/constraints/acceptance/verification/固定知识引用）。仅 `graph_read/graph_command`；没有自动 apply 或 owner token。proposal 必须由当前 run/task/attempt 的中心审计产生，禁止实验用 owner createProposal 补造 native 成功。
3. **明确 owner 确认。** 结束 planner worker，持久 checkpoint 后关闭本次 app/pool，发布 proposal 原文+digest、版本、材料、两份输入、两执行 profile pin 与候选预算；此时没有 child。独立 owner 读实际内容后提供严格 O15 confirmation JSON 与固定 key。`confirm` 仅调用已审 `FlowClient.confirmGoalPlan`；调用前原样落 key/body，未知仅允许同 key/body 恢复。旧 grant/hash 不变，标题绝不替代输入。无 owner 确认就停；不能把结构断言、模型自述或预先授予总 query 数当成批准实际 proposal。
4. **中心推进两个 children。** 经确认后启动原生产 factory 默认 scan，child worker 仍是原 runner/readonly Claude adapter；两 child 共用受信固定材料 profile、concurrency=1。O14 自动受理第一项，第一产物机械验证通过后只在本 authorization 内提供给第二项。driver 只观察，绝不手动 dispatch 第二项。断开观察客户端/中心正常重启、再次同 key 读取均不得多出任务或 query。每一 query slot 绑定实际 executionIdentity，不从目录或图标题猜身份。
5. **独立语义判定与解释。** 第三个模型输出不会自我批准。独立 reviewer 使用新的 public client/session，先看 plan/state/history，再惰性读明确 artifact binding 的正文，判断事实、依赖利用、约束和完整目标。接受时沿 O11 `accept-delivery`（先依赖项再最终项）写入 owner 命令；拒绝时保留 accepted=null、产物及独立理由。最后原入口用 O12 plan/state/history/explanation 显示真实因果与接受状态，不另起第 4 query。

**必要的真实限制：** O12 目前没有 confirm-inputs command，因此本实验同入口通过现 FlowClient 薄方法组合，不能说该命令已经进入所有 GoalSession/UI。现 GoalCommand 有 accept-delivery，没有独立“拒绝产物”持久命令；拒绝理由先是独立验收证据，中心仅保持未接受，不能伪称中心已存 semantic rejection。O12 explanation 是中心固定事实说明，不是新增模型解释。若要完成这些日用 UI/拒绝理由体验，仍是明确的后继产品范围。

## 真实复用与新增差异

- 单一执行/授权/调度仍是现 `claude.ts`、runtime/profile guard、O07 MCP、O15 confirmation、O14 scan、K03 冻结材料、O11/O12 读取。实验不复制这些算法。
- 直接复用 O08 已导出的 `stopWorker`（已知 detached PGID 的 TERM→有限等待→KILL→ESRCH）和 host hook 观测 helper；读取 O08/O10 已审原结果作对照。直属 child exit 不算组停止；该证明仅已知 PGID，不证明 setsid 逃逸或 OS sandbox。
- O08/O10 guard 各自钉旧 BASE、单 query、固定材料/图与 sealed permit，不能直接运行旧 guard，也不能改变它们迁就新基线。新实验只增加有限三槽 reservation/观察策略，固定新 source digest 和 slot identity；这是本次预算审计，不是可扩权限框架。
- 三个职责模块即可：有限 permit/query-observation；真实 public journey driver（含受管资源与检查点）；证据投影/独立语义输入。worker 只是给原 adapter 注入观察包装后调用原 runner，不实现第二 SDK pump。
- K03 来源和 profile material 文件来自 host 的同一固定合成材料；模型只引用已提供的合法 citation。确认时核实际 citation/version/digest，执行前后核文件 bytes/digest，保留模型工具 Read 请求与匹配结果；host allow 本身不证明原生实际 Read。

## 0-query 首片可独立完成

源码/动态 SQL 与包入口闭包、固定版本和 slots guard；注入 query + 实际 MCP peer/公开 HTTP/随机 PG 的两节点链，覆盖确认前无 child、拒绝无额外执行、ACK未知同 key/body、观察断开后中心继续、已消费 slot 重启不调用、失败/unknown 不生成后继，以及独立接受前 accepted=null。精确有限用例在实现时固定；不得重跑原 O15 13/O08/O10 全套。rehearsal 的固定提案仅证明接线，明确不是模型规划。PG 等 Lead 串行资源窗口；旧 sealed 模型预算不动。

## 新真实预算候选（未授权）

| slot | 请求模型 | SDK entries | maxTurns | SDK estimated USD ceiling request | deadline |
| --- | --- | --- | --- | --- | --- |
| planner | sonnet（沿 O08 已观察路径） | 1 | 4 | 0.20 | 90 s |
| child 1 | sonnet（沿 O10 只读路径） | 1 | 3 | 0.10 | 60 s |
| child 2 | sonnet（同上） | 1 | 3 | 0.10 | 60 s |

总候选最多 3 SDK query 入口 / 10 turns / SDK 声明预算 0.40 USD / 活跃模型 deadline 合计 210 s；不是底层 HTTP 调用上限、账单硬限或 OS 强制预算，旧报告中辅助模型用量仍单独保留。缺 result accounting、init/tool 范围改变或未知即停止，不自动加一次修复 query。可分两次许可：plan 1 次；看实际 proposal 后确认剩余 ≤2 次。没有当前 permit，不启动 native SDK/auth。

reservation 位于自有固定 evidence namespace；许可绑定 source digest、真实 installed SDK/MCP 版本、模型/模式、材料、工作树和期限。每个 slot 在 SDK entry 前 wx+fsync（含父目录）；异常/重启仍视已消费，不换 outputPath 或新 key 复投。实际 SDK 0.3.290 / MCP 1.32.1 与 managed init names 是历史观察，只能在本次固定环境核验，不能说永久资格或插件可信。

## 生命周期 / 资源 / 验收

分阶段关闭 app/runner/peer；owner 查看阶段只保留明确 owned 的随机 DB/目录和私密恢复材料，没有挂着的 SDK/轮询。保留须明确获资源窗口安排，不能无限等待；后续 confirm 验证原 marker/dev-ino/profile/expiry/source，失效或不一致停止，不重建成新任务。owner 拒绝时显式 cleanup；已有未知副作用仍 unknown 保留。

沿本次 F01/O15 修正后的资源纪律：CREATE 前落随机 DB+marker reservation 并同步父目录；受管目录记 dev/ino；报告/checkpoint 在不可恢复清理前落盘；app/runtime 已停止后 pool.end，再 ≤3 s 观察连接 LIMIT33（>32拒绝，零也检 deadline），仅归属/无连接/证据持久全真才正常 DROP/rm。异常不 FORCE、不删除他人资源。candidate fresh reserve ≥1 GiB +128 MiB，PG/WAL另外监测，raw ≤2 MiB、临时 driver/runtime ≤8 MiB 是候选观察门槛，native SDK 实际额外写入峰值当前未知，需在准入前明确预算；不可借此承诺真实阶段可运行。

实际语义仍须 GO/指定独立验收者判断：计划是否真正表达需求；完整输入和引用是否合理；第二项确实利用第一产物；最终文本忠于材料且无未经授权承诺；同入口解释是否足够。结构/schema/机械 passed/账本/模型 final 都不能替代这些判断。真实模型未运行前 O01/M02 完整目标保持 open。
