# LAB02 证据与质量记录

状态：实现中，尚未运行 benchmark。真实模型调用 0；不得增加原始 5/5 query 预算。

## 技能发现与应用

2026-10-06 01:38 UTC，stack 为 Node 24 / TypeScript / Fastify / PostgreSQL / HTTP SSE。

已按 `/Users/citrine/.agents/skills/find-skills/SKILL.md` 先查本地并读取 `codebase-design/SKILL.md` 与 `clean-code/SKILL.md`。前者用于把观测包装、场景和资源生命周期分开，后者检查命名、明确错误路径、资源清理与不必要抽象。clean-code 固定来源 `sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5`，文件 SHA256 `3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317`，未重装。

本地未找到 PostgreSQL benchmark 专用技能，先查 skills.sh，再执行 `npx skills find 'postgres performance benchmark'`（独立 npm 缓存）。候选 `jeffallan/claude-skills/postgres-pro` 实际读取 [上游 SKILL.md](https://github.com/jeffallan/claude-skills/blob/main/skills/postgres-pro/SKILL.md)，metadata 1.1.0 / MIT；内容偏索引、EXPLAIN、复制和调优，并非本次受限 toy 诊断，未安装。采用可审查的直接 query 计数与 HTTP 时间测量，不引入 extension 或生产改动。

## 质量检查

- 01:38 UTC：核对唯一写范围、基线、资源边界，计划先于测量。无产品修改，无新增依赖；未解决项是待实现与待运行。

- 01:41 UTC：脚本完成后按 clean-code 检查命名、单一职责、错误路径、重复和有限复杂度。query 包装单独模块；发现 wx 预留失败后 finally 可能覆写旧结果，增加 reservedOutput guard；增加硬截止、分步清理和观测连接关闭断言。类型检查通过。无产品改动、无新增依赖。benchmark 待执行。

## 运行方式与指标定义

运行工作目录必须为本 worktree 根：`PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx experiments/observer-probes/probe.ts`。脚本拒绝已有 flow_lab02 或 results.json，避免覆盖既有证据。不要为了美化样本重复运行。类型检查：`pnpm exec tsc --noEmit --project experiments/observer-probes/tsconfig.json`。

本次同进程真实 center 与 HTTP 客户端，共享本地 PostgreSQL；protocol-only runner 直接发心跳和固定事件，没有 HarnessAdapter 或模型执行。pg 包装只统计发往 flow_lab02 的 Client.query 提交，readonly BEGIN 是只读事务开始提交数；不统计成功完成量、数据库 CPU、pool 等待或网络级吞吐。窗口包含后台 sweep、scheduler、心跳与取消的提交，单独记录 timeline SELECT。窗口边界可能切过在途事务，所以各 SQL 分类不能当作完整事务配平。

每个数量三轮，两秒稳定窗口；心跳每轮 8 次，共 N=24，使用 nearest-rank p50/p95。取消每轮 1 次，共 N=3，只列原始值和范围。稳定样本不含初始 SSE 追齐，但记录 warmupMs。每组要求所有连接从 cursor=0 完整追齐同一份 64 事件、全窗口保持连接、条目精确相等。最终 snapshot/events 再校验。该诊断不覆盖持续产生事件、断线恢复、模型执行负载或产品容量。
