# CHAT04 持久对话等待队列

状态：in-progress；创建：2026-10-06。设计及执行已获 Goal Owner / Execution Lead 正式授权。

## 目标与边界

中心 PostgreSQL 持久保存等待意图，支持 enqueue、分页 list、readItem、cancel。队列 revision 独立于已受理 turn 的 conversation.revision；稳定 itemId 和 FIFO sequence。幂等响应重放保持原响应，单项读取显示最新事实。

空对话可提升首次任务；存在前轮时仅 succeeded 且有效 profile pin、known native session、未占用才自动提升。failed/cancelled/uncertain、失效 pin 或缺 session 冻结且给出原因。pending 可取消；promotion 后只能告知 task 引用，不能假称撤回。follow-up 不得绕过 waiting 项。

promotion 持 conversation 锁，再持前 task 锁，复用 admission 校验；task、pg-boss flow-wake、turn、item 状态同事务，失败全回滚。scan 有界并跨冻结对话公平轮转。无浏览器内存队列、新 broker、模型或云调用。本轮不启用 resume/continue/steer。

## 窄接口与分工

本 owner：公共 DTO 子文件、011 migration、queue 模块/HTTP registration、共同 admission 与指定 conversation 文件。
Execution Lead：公共 exports/client、生产 migration/register/scan 生命周期；Web owner：真实 UI 接线。模块/fixture 通过不代表这些生产入口完成。

## TODO

- [ ] CHAT04-01 固定公共 DTO、HTTP routes、migrate/register/promote/scan Interface，交接可用 commit。
- [ ] CHAT04-02 实现 PG enqueue/cancel/FIFO/原子 promotion、独立 revision 与不插队规则。
- [ ] CHAT04-03 隔离真实 PG/HTTP 验证：幂等/ACK 丢失、双客户端 CAS、竞争/重启/冻结/公平/边界；保留失败与资源清理证据。
- [ ] CHAT04-04 独立审查固定 target、质量和 dashboard 同步；生产集成与 main 事实另核。

## 验证方法

正式授权 seam 是真实 HTTP queue commands/reads 与 bounded promotion Interface；真实 PG、动态端口、唯一临时数据库（先拒绝既存、只清自己资源），0 模型/云。固定 Node24 / pnpm9.15.4 / Vitest4.0.18，显式路径与 noEmit。不得执行原硬编码 flow_c01 suite。SQL 仅用于资源校验和创建受控执行终态 fixture，不以数据库侧信道替代公开行为断言。

## 风险与依赖

扫描与错误回滚必须不饿死其他 ready conversations；取消与提升同锁裁决。公共入口由 Lead 接线，需分别验收。架构影响：新增 PG queue FSM、窄 HTTP 接口和有界扫描生命周期；待实现 target 固定后由 Execution Lead 同步架构基线。
