# WPF-DPERF02 快照 Git 工作量测量与树查询批处理

状态：completed；创建2026-10-06，更新2026-10-06 10:41:48 UTC。owner d01_owner / gpt-6-astra ultra。
直接所属大task：[D01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/execution-dashboard/plans/d01-execution-dashboard/plan.md)；co-lead Web /root。FLOW/WPF仅追溯，不形成第三执行层。

目标：减少看板证明的重复 Git 子进程，同时保留完整树记录、每个声明范围与现场 dirty/main/review 的未知语义。root已批准四literal与有界实验；附件/实际Web发布优先。

- [x] WPF-DPERF02-01 独立树/固定base/精确take、技能与唯一canonical。
- [x] WPF-DPERF02-02 16/64/128临时注册source Trace2实验，总≤60秒含清理、≤32MiB证据；0真实服务负载。
- [x] WPF-DPERF02-03 依据证据选择最小批量树读取，保留完整mode/type/OID/path、每scope缺失及dirty/main/review语义；局部验证。
- [x] WPF-DPERF02-04 固定实现、独立review、normal push及Lead主线接收后停写/release。

实现固定902c9b5d35e1795d564c077034dc78cf1a36b6a0，base 41315b033deb0b1953484359b686c0b228997367。实际 [结果与限制](../../docs/evidence/wpf-dashboard-proof-batching/validation.md)：合计34.897秒、16,081,552原始trace字节；五scope样本ls-tree减少80%。单次墙时和峰值并发不构成稳定整体提速结论。

[Interface](../../docs/evidence/wpf-dashboard-proof-batching/interface.md)不变：compareImplementation/integrationProof。保留2MiB/5s；仅overflow/E2BIG串行二分，单叶失败unknown；128scope最多255attempts。普通错误/超时不重试，无跨snapshot缓存、TTL、aggregate或全局并发改动。旧10:25发布优先暂停是历史，root恢复授权后已完成本片测量/实现。

写权仅proof.mjs、新proof-tree-batch.test.mjs、本plan目录及本evidence目录。claim 1cb4f0e3 v1，源/验证/独审与main事实分开。

主线受控接收da04127fd0c033135d20657742979845e1b80a63；owner三源精确scope-tree核对，非祖先集成，见[main receipt](../../docs/evidence/wpf-dashboard-proof-batching/main-receipt.json)。全部四scope在本次纯metadata push后停写，由管理fresh release；没有新实验/产品重测。
