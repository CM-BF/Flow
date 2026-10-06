# CHAT10：可信启动配置与任务准入查询

固定领域/测试：`a3296e0f6ffc37c746cf1d59a7105aeb2131579b`；合同祖先 `3b157a3e21166eb06473c1deb6b9f0eded1169e3`；基线 `32c371d389a913f8dd71c3bd8b98dd0697411256`。独立 review 未开始，未集成 main。

[Interface](interface.md) 定义 owner 的 task-bound GET 与纯启动配置 parser。GET 使用 repeatable-read/read-only 事务，不加行锁、不创建 control/command/audit/receipt。默认关闭时不访问 024 表；启用而安装缺失返回明确原因。完整 current task/attempt fence、lease、runner、decision、session、profile 与 final/seal/pending/unknown/quota 状态决定结果。POST 在原锁序和现时 profile 检查之后重用同一小型新命令 policy；幂等重放仍绕过仅新命令的 pending/CAS 条件。旧 `attemptAvailable` 含义和公共 steering capability 不变。

## 实际检查

- [46/46](behavior-final.txt)：15 新 readiness HTTP、2 配置、原 16 命令与 13 conditional-final 直接消费者。
- [新增 2/2](startup-boundary-final.txt)，15 未选择：真实 factory 默认关闭，HTTP header 不能启用；本专库临时隐藏一张表后明确 not-installed、恢复后 ready。
- 合计 **48 distinct**；没有重跑或重新背书旧 106/89 全范围。
- [最终类型检查](typecheck-final.txt) exit 0；[只读清理核对](cleanup-final.json) 3 个测试前缀剩余随机数据库 0。
- [原始 red](admission-red.txt) 是真实 HTTP 路由 404；[配置加载失败](configuration-red.txt) 是缺模块，不能作为行为 red。[首次组合](admission-first.txt) 16 通过/1 失败：最终消息 fixture 错用 UUID，按既有合同改为 SHA256 后通过；保留失败原文。
- [命令与计数](checks.json)、[源码/原始证据清单](manifest.json)、[质量记录](quality.md)。全程 0 provider/query，没有读取实际 provider 凭据，没有操作个人服务。

旧 schema 验证使用独立随机数据库，仅执行基础 `migrate`，明确 024 不存在再调用模块 HTTP。该旧 schema 组合只验证模块存储安全，不宣称旧中心已生产挂载新路由。生产 owner/runner 角色验证走真实 `createServer`。不完整安装通过本专库临时表 rename + finally 恢复注入，不是首次 migration 证据。锁竞争检查持有真实未提交 seal 行锁：GET 读取已提交快照而不等待它；seal 提交后，使用先前 ready/CAS 的 POST 被拒绝。

## 限制与交接

这是中心的瞬时可发送判断，不是预留，不证明 SDK 在线、实际 streaming-input 支持或模型遵从。`received`、`observed-consumed` 不因此改义。客户端可能在 GET 与 POST 之间失去 readiness，必须处理 POST 冲突并刷新；unknown 不自动重发。运行中的任务可见性仍由既有租约与 fencing 决定。

F01 单 owner 负责 `main.ts` 读取 `FLOW_ACTIVE_STEERING` → parser → 现有 `createServer.activeSteering`、公共 client/exports；当前本片未修改这些共享路径。默认 off/非法 fail-closed parser 已可消费，未声称生产 CLI 已启用。普通 conversation capability 仍 false；用户 UI、真实 native query、个人 identity/profile 与部署均后继单独验收。无 migration、无新 scheduler/loop。
