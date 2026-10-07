# 旧本地受理意图：只读结论与最小恢复提案

**当前不是 schema mismatch，也未证明有活任务。** 唯一获准的单文件观察确认：version 为数字 1，字段仅 version/inFlight/assignments；inFlight 为合法 UUID 字符串（不输出值），assignments 为空数组。600 regular 文件、700 同 uid 目录及读取前后身份均通过，80 B / SHA256 `67cdfdcdbbf1d646cbfa12552b58299ec68b7ddaa70e8453ae7786ab830f590c` 与 2030/2040 保存摘要相同。三次离散观察不证明连续状态、起因或中心当前任务数。详见 [单文件事实](admission-readonly-diagnosis.json) 与 [固定源码绑定](admission-diagnosis-bindings.json)。0 新 DB/进程/服务探针，0 测试；原两个发布窗口都在材料操作前停止。

## 固定源码证明

362 与 af51 的 15 个相关实现/直接测试逐字相同。AdmissionJournal.begin 先持久写 inFlight；只有收到明确 claim 响应后 accept 才清除，runtime 随后才执行 assignment。未知响应时持久保留，重启 recover 只重放 outbox/核 final proposal；complete 只移除已知 assignment，不清 inFlight。故 strictIdle 当前拒绝正确，重启、换 namespace 或放宽 idle 均不是修复。`FlowClient.claim` 发送 `{}`，旧 UUID 未上 wire，没有可据此查询的 claim receipt。

维护 command 和 claim 都先对同一 runner 行 `FOR UPDATE`。drain 提交前持有该锁的 claim 必须先提交或回滚；drain 后取得锁的当前 claim 返回 null。016 的 attempt INSERT trigger 也锁该行并拒绝非 accepting 状态。trusted-host hold 在同锁下要求该 runner **全部 completed_at IS NULL attempt 为零**，包含 uncertain，成功后持久保持维护状态。

这证明准入序列化及禁止新 attempt，**不证明所有尚未取得锁的事务/HTTP 请求已消失、原 ACK 内容或外部执行已停止**。旧连接晚到仍会被拒绝；现有 read-only maintenance view 本身不是该锁屏障。既有 task reconciliation 只处理已知 uncertain attempt，protocol recover 仅 A2A；没有能直接退役此旧本地 UUID 的受管动作。不能伪造 accept(null) 为原响应，也不能给 S01P07 新 receipt 追认这个旧 UUID。

## 候选最小受控操作（未实施、未授权执行）

1. 新窗口先固定源码、身份、文件摘要与保留基线；完整审计声明本次是“旧本地未知 intent 的人工退役”，不是证明原 claim 无效或重放成功。仅以已确认 schema/精确 namespace/非空 inFlight、assignments=[] 进入这一专门路径，不改通常 idle gate。
2. 复用现有维护 drain，再由 exported `commandRunnerMaintenance` 做同 operation/version 的 trusted-host hold。全库未完/uncertain 为零且该 runner hold 成功才继续；任何用户新工作、未知部署/身份、非零计数都停止。不要借现 `refresh` 获取 hold：它随后会停三角色，不是独立屏障入口。
3. 依既有 owned-process 方法确认旧 runner 整组停止及本安装无其他写同 journal 的 runner；不信号 center/Web，不以请求超时或 leader 退出替代停止证据。hold 持续有效。随后一次权威复核全部 attempt、assignment、outbox ACK 与 final-proposal 状态；历史文件允许保留，任何 pending/unknown、遗漏或边界超限停止，不删除或补造 ACK。已知 uncertain 若出现应转既有显式 reconciliation，本提案不自动处理它。
4. **新增的语义边界需单独批准及独审。** 在本机私有位置先持久保留原 journal 完整字节（不进入公开证据）、摘要、dev/ino、hold receipt 与审计原因。仅原 hash/身份/namespace/空 assignments 均仍匹配、runner 已停且 hold 仍成立时，原子退役这一 inFlight；其余字段、历史文件原样。不重放 claim、不创建任务、不重置目录。写入/审计结果 unknown 时保留 maintenance 和所有证据，不自动重试或回滚文件/DB。
5. 重新按完整发布保护条件准入，唯一允许的 journal 差异精确列入审计；其余保留检查不弱化。runner 后续在同 namespace/维护状态启动，最后显式 resume，不能提前接受新任务。退役与恢复并非本报告已发生的事实。

## 最小验证与剩余边界

现直接消费者：admission-journal.test 的跨重启未知与仅明确空响应清除；runtime-capacity.test 的未知 claim 后停止受理；maintenance.test 的两种 claim/drain 锁顺序、uncertain 禁 hold、旧 trigger 回滚。只读复用了这些源码，未重跑。

若批准新 operator，限定增量应覆盖 hold 未成立/有未完、runner 未停、hash/namespace/身份漂移、pending outbox/final、持久备份或审计失败皆拒绝；唯一正例仅退役指定 intent，历史逐字不变，崩溃点保留 unknown。无需重跑原完整产品或网页矩阵。当前尚无这些新执行证据，也无当前全库零未完证明；没有证据定位原网络/中心失败原因。研究至此收束，等待 Lead 对新增操作语义协调授权。
