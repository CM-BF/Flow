# LAB02 证据与质量记录

状态：单次 benchmark 通过；独立 review 尚未开始。真实模型调用 0，既有 5/5 query 预算未增加。

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

## 实测结果

[原始 JSON](results.json) 对应实际执行源 `2fad2bc5cb6d1f720631fd56e557f193c44ebf7f`（基线 `6434fba78bba5097376555a66114462f5432ca25`）。2026-10-06 01:41–01:42 UTC，Node 24.20.0，PostgreSQL 16.13，Darwin 25.6.0。同进程 center/观测客户端与本地主机 PostgreSQL，运行开始 load average 为 4.30/6.89/10.49；不能将主机负载归因于本实验。

九个约 2 秒稳定窗口，含 setup、追齐与 cleanup 总用时 **30.024 秒**。各数量三轮，原始顺序 `[1,16,128,128,16,1,16,1,128]`。结果只描述这一次本地样本。

| 观察者数 | 每 2 秒只读事务 BEGIN 提交，三次 | 每 2 秒全部 SQL 提交，三次 | Heartbeat N / p50 / p95（ms） | queued cancel 原始值（ms），N=3 |
| --- | --- | --- | --- | --- |
| 1 | 8 / 8 / 8 | 136 / 140 / 136 | 24 / 20.90 / 25.12 | 24.93 / 28.02 / 19.79 |
| 16 | 128 / 128 / 128 | 620 / 616 / 616 | 24 / 16.32 / 21.80 | 17.55 / 21.01 / 17.63 |
| 128 | 1024 / 1024 / 1024 | 4200 / 4204 / 4201 | 24 / 8.46 / 12.32 | 13.08 / 9.28 / 15.45 |

每窗 timeline SELECT 提交数与只读 BEGIN 相同。这个直接计数符合当前 SSE 每观察者 250ms 查询一次的实现；静态数据也会继续查询。没有把全部 SQL 提交率称为数据库吞吐，未观测 query 成功/失败计数或 pool 等待。heartbeat 响应均为 continue，9 次取消均确认 cancelled。128 组延迟较低只是一组小样本事实，可能受热身、调度与共享主机噪声影响，不能据此判断增加连接改善延迟，也无 SLO 或容量结论。

所有 **435 个连接**完整追齐同一任务 64 事件，严格验证连续 cursor、无重复/缺失、条目精确相等，并在稳定窗口保持连接。最终 snapshot 和 events 与初始数据精确相等，watermark=64，digest=`50f214b357d5085119569be3adf61d59b42f04a8c61a26c99c734edd4ee85724`。任务刻意保持 running，未把这种静态一致性检查写成执行完成/产物验证。

SSE 解码内容及固定 frame 开销 **5,024,685 B**，测得全数据库 **9,069,071 B**，合计 **14,093,756 B（13.44 MiB）**，低于 64 MiB。它不是 HTTP/TCP 字节量或进程 RAM。数据库仅本次新建；cleanup errors 为空，DROP 成功。01:42 UTC 独立只读复核 `flow_lab02` 不存在，实验动态端口已不响应。其他数据库、4320 dashboard 未改。

原始 JSON SHA256：`cb57495f88340050d595aa30bacd1e520b44bc2a19b6e25dca0816852c91b5b3`。另做已有证据防覆写检查：再进入脚本立即由 wx 拒绝，payload=0、约 21ms，无数据库创建/测量；前后 JSON hash 不变。这不是第二轮 benchmark。

## 交付检查与限制

- 01:42 UTC clean-code 交付复核：命名区分提交/完成，query 包装恢复，观察组严格比对，错误不输出 driver 凭据，清理各步骤有时限；原始结果与当前源码无差异。未发现需扩展产品实现的问题。
- 专用 TypeScript 检查通过；diff whitespace 与计划链接检查通过。未运行全库测试，避免无关测试清理 flow_i01/flow_c01；实验自身以真实 HTTP/PG 断言验证。
- Pool 等待、SQL 执行时间、CPU/内存、持续事件生成、断线重连、不同任务、独立客户端主机、长时间运行均未测。该拓扑是单任务的观察连接，**不是 128 个执行 agent，更不是 128 个模型**。
- 没有重试、美化统计或调优；仅保存一次有界结果。独立 review 需绑定交付 commit，不能把本作者检查当 approval。main 未集成。
