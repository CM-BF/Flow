# O06：受限图授权中心片段

创建/更新：2026-10-06；状态：completed（本中心片段已审，待集成）；父产品 O01/U11。Owner assignment_review / gpt-6-astra。

允许 owner 预授予一个 goal/project/base revision 的有界图提案/应用能力，runner 当前 attempt 通过独立 graph grant 调用；旧 node grant 不扩权。本片只 fixture 与真实 HTTP/PG，native/SDK bridge/NL 未完成，候选一次模型预算未获执行授权。

已批准：提取 node/graph 两实际 caller 共用私有 authority 深 module，runner→project→task/attempt→grant 锁序；授权在幂等缓存前，quota/audit/domain 同 TX。017 只前进，复用既有不可变/revoke trigger。图读固定 baseRevision，分页 id/title/version 并明确 currentRevision/stale；修改 CAS，自身 apply 后同 key 仍能恢复成功 receipt。来源由真实授权行与 runner/attempt/fence 派生。

- [x] O06-01 固定合同、领取与小设计。
- [x] O06-02 共用授权、持久 grant/原子命令及真实 actor。
- [x] O06-03 真实 PG/HTTP 场景与 O03/O05/G01 直接消费者。
- [x] O06-04 原始证据/clean-code/独立 review 交付。

范围以 [claim](../../docs/evidence/o06/claim-receipt.json) 的13项为准。共享 exports/client/server index 由 Execution Lead 接线。架构变化待 Lead 固定 target 后同步架构视图。验收含分页底稿、scope/quota/CAS/replay、撤销/取消/fence race、rollback、真实 actor 与旧 grant 403；不重跑无关套件。
