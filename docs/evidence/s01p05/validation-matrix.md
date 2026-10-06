# P05最小可审验证矩阵（未执行）

固定输入main aeb764e5，Interface不变：`persistEventState`仍由caller事务持有锁；测试通过公开 `reportEvents` / `finalizeSteering` 行为，同时用私有fixture query观察确认目标task写次数。仅新 `event-state.test.ts`，不造通用fixture框架、不复用共享破坏性测试库。当前两metadata scope不允许创建该test；本页是验收设计。

| ID | 入口与场景 | 必须证据 / 不可弱化点 |
| --- | --- | --- |
| V1 | reportEvents正常accepted批：message、session、usage、artifact、verification，随后decision与completed各独立批 | task status/cursor/pending_decision/usage/verification/latest artifact最终值与原规则相等；每个accepted批恰1次task UPDATE，attempt序号/last_event_at仍先写；ACK accepted/lastSequence与连续runner_events一致。decision仍waiting+pending，completed清pending并终结attempt/session。 |
| V2 | usage含null/unknown，随后不带usage的message批；artifact版本替换后验证指定版本 | 不把null变0/unknown变已知，不重算usage；新artifact置pending，只有exact最新artifact验证才更新verification。task八字段组合不可少字段或错位。 |
| V3 | 同批纯重放，包括已完成/租期过期但fence未变的历史事件 | accepted=0，lastSequence不动，task UPDATE数0；updated_at用数据库值前后精确相等，不以sleep推断；details/usage/artifacts/timeline无新行。当前runner凭据和owner fence仍必须通过，不能为重放绕过。 |
| V4 | 旧事件+相邻新事件混合批；event ID/digest冲突；sequence gap/乱序 | 新部分只合并写一次、accepted只数新事件。冲突/间隙失败时整个批次回滚，task/attempt/timeline和所有event side effects与前快照相等；错误code保持。 |
| V5 | reportEvents任务状态写入点注入数据库拒绝；合法前半批后非法verification | 同事务的attempt last_sequence/last_event_at、runner_events、details/artifacts、usage_samples、timeline和task全回滚，无孤儿detail/序号。只在自有专库按该task ID限制故障trigger或使用自有client seam，finally移除/恢复；不改变生产hook或真实immutable trigger。 |
| V6 | finalizeSteering正常final三事件提交/相同proposal重放；任务写失败或精确verifier失败 | task投影、seal、artifact/verification/final、runner_events与命令receipt原子提交；重放不改updated_at；错误时上述全回滚且proposal receipt不存在，仍可用原公开规则重试合法proposal。合法身份/控制revision/coverage仍必需，不以直接persist调用替代消费者。 |
| V7 | stale owner/当前attempt不符/uncertain的新事件；018/021非空input绑定任务 | 错误保持且无task写/副作用。正常状态写保留conversation_input_id/goal_input_id和submission；专库验证immutable input trigger定义仍启用且不同绑定更新失败。新SET列必须精确不含两input列，不通过关trigger满足。 |

这是7类验收，不预报7个已通过tests；实现时按共享fixture的最小独立行为组合确定实际selection，并逐项映射，零tests不是成功。

## 资源及证据

Node24、Vitest4.0.18，显式新test路径；局部strict继承根ES2023/strict/noUnchecked，不修改skipLibCheck或宽化类型。功能fixture优先一个随机专库，最多16功能task/attempt、动态HTTP端口（如果入口测试需HTTP）、0 SDK/provider。功能检查不是128 capacity预演或A/B额度消费。

读取受控本机admin配置不打印。CREATE请求前记录creationRequested；query/连接/close均有界，finally先闭合app/自有pool，再核该唯一db存在/连接数0后普通DROP并核absent；unknown保留并fail，不FORCE、不kill共享进程、不自动重试。工程编译/测试时间和未来capacity窗口分开计，真实功能PG运行须合法source scope后按Mika派工进行。

原语义主要证据来自10项固定readonly输入；state写次数通过实际query调用观察，不以源码里出现一次UPDATE字符串冒充运行证据。数据快照只取本专库自有fixture行，JSON参数/凭据不进日志。保留red、失败、真实exit、选中/未选数、cleanup与最终source/hash；独审只读固定target。
