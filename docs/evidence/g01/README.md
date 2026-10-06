# G01 证据

2026-10-06 02:32 UTC：gpt-6-astra owner 核验独立 worktree codex/project-graph / base 8c57f2f97345167207fa0d2590e9ad6310c922d4 clean。只实现首个项目计划图片段，不宣称调度或完整 O01。

技能：按 find-skills 先检查 Node/TypeScript/PostgreSQL 并发命令工作对应的本地方法，实际读取 /Users/citrine/.agents/skills/{find-skills,brainstorming,codebase-design,tdd,clean-code}/SKILL.md；本地设计/公开 Interface 测试方法足够，无安装。clean-code 继续固定 sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5。应用：先固定小 Interface，公开 register/migrate seam 的真实 HTTP/PG red→green；单项目原子 CAS 隐藏事务/图验证；每段检查命名/重复/错误处理/范围，不逐字段镜像写测试。Lead 已接受具体 seam，技能默认审批不覆盖用户已授权实现。

## Clean-code / 范围记录

- 02:32 UTC：读取当前 server 鉴权、事务/命令框架及 FLOW-001 §7–8。选择持久 personal workspace 与任务状态 live 查询，避免再建执行状态。未绑定节点允许先规划后绑定；全局 task 唯一关联与子树/依赖循环分别校验。检查未运行。

- 02:43 UTC：create/node/dependencies/tree/binding/list 逐个公开 HTTP red→green，6 项行为已通过。核心并发用外部 PG 行锁制造两条真实等待事务，pg_stat_activity 确认至少两条 lock waiter，再释放；不同项目期间可成功提交，非串行伪并发。现有 task 状态不复制，绑定后取消 task 时 graph revision 不变、查询读到 cancelled；中心实例重建后历史仍在。后续边界检查进行中。

- 02:48 UTC：交付前 clean-code 复核 source 6394afad2480da369adb7e6156403bfc45097dfa。命令事务、图验证、只读投影、HTTP/迁移入口各有清晰职责；CAS 先于变更，约束冲突回滚，不把 PG 唯一冲突变成 500。图验证有界；查询只读必要 task 摘要，避免复制 prompt/执行状态。当前没有发现待修复的阻塞项。项目/节点版本、父子与依赖两个图的不同语义以及幂等返回历史结果均有行为检查，未为每个内部函数镜像写测试。源码冻结后仅记录证据/metadata。

## 固定目标与实际验证

实现目标：**6394afad2480da369adb7e6156403bfc45097dfa**。合同提交：3b4832f99b11295c6e84cee3dc80b2b956d4b3ae。执行 Node 24，专用 flow_g01 数据库、动态 HTTP 端口，公开 `createServer` + `migrateProjects` + `registerProjectRoutes` seam；没有 injected fake DB。测试创建专用 DB 前取得互斥锁，若同名 DB 已存在则保留并拒绝覆盖；成功结束关闭服务器/pool并删除该次创建的 flow_g01。

保存的终端输出仅统一了末尾空行，检查结果与耗时未改写；首次 metadata diffcheck 指出这些空行，规范后复查通过。

- `pnpm exec vitest run apps/server/src/projects/projects.test.ts`：**10/10 passed**，4.23 秒；[原始输出](green-boundaries.txt)。验证发生于提交前，提交的源码与已测字节一致。
- `pnpm typecheck`：全库通过；[原始输出](typecheck.txt)。未运行其他 feature 的 DB 测试，不声称整库 tests 通过。
- `git diff --cached --check`：源码提交前通过，无输出；无根 lock / 公共 index/client / server 主入口改动。
- 纵向 red→green 原始输出：create、node、dependencies、tree、binding、list 的 `red-*.txt` / `green-*.txt`。边界四项为补充回归，未伪称它们曾 red。

| 已测行为 | 直接证据 |
| --- | --- |
| 持久 personal Workspace / Project，不执行任务 | HTTP 创建/GET，初始 task 列表为空 |
| 幂等同 key 重报 / 异输入拒绝 | 原结果带 replayed=true；冲突409 |
| 项目并发 revision CAS / 不用全局图锁 | 两条相反依赖 HTTP 请求被同项目行锁阻塞，PG 确认两个 waiter；期间另一项目命令成功；释放后200/409，刷新后环仍409 |
| 项目、节点、父和依赖引用版本 | 分别 stale_*409；失败不推进 revision |
| 子树/依赖分别无环、禁止跨图、显式删除引用 | 自环/环/跨项目/重复边拒绝；有子节点或被依赖节点拒绝删除 |
| 当前 task 全局唯一绑定 | 不同项目同时争同一 task，PG 确认两个 waiter，释放后仅一方200；另一图保持原样 |
| task 状态唯一来源 | 外部 task cancel 后 graph revision 不变，GET 反映 cancelled；删除叶节点后 task 仍 queued，可重新显式绑定 |
| 历史与迁移 | 中心关闭重建后历史仍在；UPDATE/DELETE/TRUNCATE revision 在 SQL 边界拒绝；重复 migrate 无重复 version4 |
| 身份 / 有界读取 | owner401、runner403；项目游标分页2；非法 limit/revision400 |
| 有界图 | 第201节点拒绝；2000边可接受，第2001边拒绝，revision不变 |

## 边界 / 交付

0 模型 / 0 云调用，R02/I01 总预算仍5/5已用完。没有触碰用户4320或其他测试数据库。此模块不提供新 workspace 创建/多租户隔离，不自动提交任务/调度，依赖 gate、运行中计划失效决策和取消传播仍 open。历史 graph 返回关联 task 的**当前**状态；幂等 replay 保留命令原接受结果，最新状态另做 GET。

生产集成须在中心既有 owner 鉴权钩子下注册 routes（作者测试沿用真正中心钩子）；共享 export/client/CLI/主入口由 Lead 接线。独立 review 当前 NOT_STARTED；Goal Owner 将按 Lead 指定范围只读检查源码/合同/已保存证据，作者输出不代替独立 review。
