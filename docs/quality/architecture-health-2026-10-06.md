# 架构健康与管理质量台账

Goal Owner委派只读架构review，target `6434fba78bba5097376555a66114462f5432ca25`，开始/结束同SHA且clean。使用本地codebase-design和固定clean-code；未运行测试/模型/安装。结论：无阻断M1项；不是对后续commit自动approval。

保留的结构优点：observer断开只清SSE不停止runner；CLI共用client；SDK/本机身份留在runner；fixture与Claude使adapter接口有两个真实实现；中心独立重算verifier暂时保留。

| ID | 优先级 / 入口 | 风险与定位 | 后续验收 |
| --- | --- | --- | --- |
| AQ-01 | P2，接Pi前 | `apps/server/src/usage.ts:10`把非fixture都按Claude；`packages/contracts/src/tasks.ts:9`与`runner.ts:52`散布harness/usage标识 | 集中标识与允许来源；第三个合成adapter、未知来源拒绝、usage去重/unknown不回退 |
| AQ-02 | P2，S01前 | `apps/runner/src/runtime.ts:36`单claim串行，注册capacity>1不代表实际并发 | 目前明确有效并发1；后续一任务等待时另一任务可完成、取消/outbox隔离、上限/停机 |
| AQ-03 | P2，先LAB02观测 | `apps/server/src/streams.ts:46`每observer250ms读task/timeline，共用8连接pool；128约512读事务/s仅静态推算 | 0模型1/16/128诊断实际读量、heartbeat/control与事件正确性；pool wait未测就未知；不预设需broker |
| MQ-01 | P2，D02之后独立小项 | 实现已review但metadata HEAD不同显示一直待复审 | 分离已审实现target/当前实现范围变化，基于diff证据决定需复审，不给新HEAD无条件全绿 |
| MQ-02 | P2，同上 | main.current精确要求owner记录SHA等于现场main，main每更新就全队待同步 | 区分实现是否已入main和上次观察SHA；当前merge流程可用可核验祖先关系/实现范围对比派生，不把旧观察自动当失效 |
| MQ-03 | P2，同上 | “无/无新增事项”混入决策清单，历史风险/已解除项/容量限制混入当前阻塞 | 空决策显示暂无需决定；高层只显示真实当前阻塞，SHA/原文保留详情与出处 |

M1后先补uncertain受审计核对恢复入口，绝不直接DB改状态重跑未知写。M2先统一跨任务解释/决策入口和成本对照，再扩大并发；当前薄task页不是最终心流体验。所有后续项未实现，不靠机械拆函数或造抽象完成质量指标。
