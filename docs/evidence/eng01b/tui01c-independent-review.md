# TUI01C 唯一独立只读review

Reviewer: native_center_owner / gpt-6-astra；时间：2026-10-06 11:05:05 UTC。
Review target commit: `d26dde66d01cd667aab54fcb0e348654f1537fd5`
固定delivery: `b88acfe1aa159702e57321bd26618aa7dd6f7606`；WT `/Users/citrine/Projects/AgentHarness/Flow-worktrees/tui-stream-activity`，读取前后clean。初次结论：CHANGES_REQUESTED，P1=0，P2=1（已由下列增量复审关闭）。此收据不维护TUI任务进度，Lead转录作者canonical review。

## P2：新建会话必须重置旧会话的回合选择

路径 `packages/interaction/src/controller.ts:75`（accepted create切换selection）及`:52`（focused筛选）。`focused`是本次新增的单controller变量，只有`open`路径清零；`new`及其`recover`成功路径都沿`performMutation`切换会话而保留旧值。

具体触发：在A会话已有至少3回合时 `/turn 3`，随后 `/new B` 并向B发送第一条消息。即便B的历史/stream capability正常，`loadedTurns`只有B第1回合，`focused`仍是3，`syncObservation()`找不到回合并dispose观察；后续poll重复此状态，新会话首轮不自动显示逐段正文，`/reply`/`/activity`也因空内部turn失败。用户需要额外`/open B`或手动重新选择才恢复，违反新会话默认观察最新回合的已定行为。

建议在确认ACK确实切换到另一会话时统一重置会话局部选择/观察（包括accepted create的显式recover路径），再读取/展示该会话。不要在未确认ACK前抹除旧请求或改变unknown语义。增加窄回归：旧会话`/turn 3`→accepted new→新第1回合自动被观察；create lost ACK→recover确认新会话同样恢复默认选择。只跑该局部及必要直接消费者，不重跑122。

## 已核范围与证据

- Manifest SHA256 `f4f5c7caf3d9939f417820e68d8187111b3edc20c8c9dcbe8d0ceeb481f264da`，27source/24raw/10readonly全部61条字节和hash一致；source/readonly绑定target，raw绑定delivery。逐项记录见同目录JSON。
- 完整阅读新增shared stream metadata/patch hash/UTF8/replay/partition、projection生命周期/限额、presentation final identity/digest、activity codec、ObservationReads、TurnObservation、分页/commands/controller、实际Ink入口与renderer、HTTP/PTY fixture；读取Web五消费路径及现host/store上下文。迁移的patches/projection对原Web算法逐字相同（仅import改路径）；没有保留另一套协议实现。
- Web经browser-safe子路径直接消费，根Node controller没有被带入；静态imports与实际构建原审计已核。锁只新增Web importer 3行workspace link，无新resolved依赖。Web renderer仍只映射BodySegment，host/store权限/缓存所有者未转移。
- 验证原raw的122不同检查=30基础+10HTTP+1PTY+81Web；重叠轮次不重复计，新增活动1selected/9未选。原始加载红、fixture红、丢括号/identity导出红、错误显式detail被preview掩盖的行为红均保留；末轮root types exit文件0、Web types输出和成功build（既有大chunk警告）已读。
- 2实际并发/4排队、单turn、20活动轻引用/4个64KiB body缓存、1MiB/256block/4096patch及显式正文2,000字符显示分页；redacted不读body，截断不伪称完整。正文按当前task/attempt/session/message/hash与中心settlement分区替换，gap/中断保留已核前缀。
- 真实PTY原stdout为17,217bytes/2,987ms单样本，显示增长/redaction/truncation/OSC转义，Ctrl-C恢复raw mode且fixture任务继续；后续实际headless入口读退出后的final。原lostACK/cleanup直接消费者保留immutable intent与显式恢复，没有新增模型执行或cancel路径。

Reviewer没有执行测试、PG、provider或个人服务操作，没有修改作者文件。共享观察/呈现证据不证明真实provider首token、模型能力或容量。除上述P2未发现其它阻断项，修复后仅增量复审。

技能：按find-skills本地优先应用codebase-design/clean-code（既有sickn33固定来源）；React/Ink renderer只读检查应用本地vercel-react-best-practices v1.0.0的可分析导入、effects清理、读取界限方法，不机械要求Next框架或另加依赖。

## 增量复审：APPROVED，原 P2 CLOSED

Reviewer：同一独立 reviewer native_center_owner / gpt-6-astra；时间 2026-10-06 11:10:33 UTC。

Review target commit: `0fff6790e040ce6d19b8070b61d77709cdaec9be`

固定 delivery：`c8d0190e0bf7d9688bff5a3de438d0d5978eaaf7`。作者 WT 读取前后 clean。完整阅读相对原 target 的两个文件增量：controller 在有效 ACK、durable intent 清理且 epoch 仍有效后，确认 conversation id 已切换才清除 focused/loadedTurns/streamCapability 及局部 observation/turns；同会话不重置，UNKNOWN 与原 key/body 保留。新增两条直接回归覆盖正常创建和 lost create ACK 后显式 recover，先保留旧第 3 回合，再确认新会话首轮被默认观察，活动读取绑定新 task。4 行产品变更与现有暂停/epoch/dispose 生命周期一致，没有远端取消操作。

8 项增量 source/raw 的 fixed/current bytes/SHA 完全一致；原 manifest 除已声明 controller 修复外 60 项保持不变，产品范围只变 controller.ts 与 controller.test.ts。增量 manifest SHA256：`55818ba33396d5cc773cac6ac67d41969bf05b5a1dde2eb5c857e9a9695cff66`；逐项见 [增量核验记录](tui01c-focus-review-hashes.json)。读取原始 2 failed → 2 passed / 13 未选及 root noEmit exit 0，测试失败点正是新首轮 observation 为 null，修复后断言保留。Reviewer 未重跑测试、原 122 项、PG 或 provider。

原 P2 已关闭，无未解 P1/P2。结合上述完整初审，批准固定增量 target 的 TUI01C 交付。批准仍限共享观察/呈现、两个真实 Web/TUI 消费者和本地观测取消边界；不证明真实 provider 首 token、模型能力或执行容量。此文件仅独审收据，由当前 TUI owner 转录其唯一 canonical review/status。
