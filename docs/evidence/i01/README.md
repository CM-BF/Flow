# I01 当前集成证据

2026-10-06 01:15 UTC，Execution Lead / gpt-6-astra，在独立 `codex/m1-integration` worktree 检查。机器记录见 [checks.json](checks.json)，[测试](../../../tests/integration/center-runner-cli.test.ts) 使用公开真实HTTP、独立runner/CLI进程及隔离PostgreSQL。第一次检查发现测试默认poll期限短于有意慢任务，改为显式5s观察上限后通过；没有把超时当产品修复。根测试相对引用workspace源码，未新增依赖。

技能方法复用已固定 Node/TypeScript/PostgreSQL 发现记录，实际应用 tdd 的公开Interface测试与 codebase-design 的模块seam；clean-code工作段复核检查子进程清理、动态端口、隔离数据库/临时目录、状态断言与证据界限。C01关键实现独立只读review完成，R01/L01 blocking/已接受问题由原owner修复并通过另一个agent复审。最终全检54/54及typecheck通过。

这是确定性fixture的真实系统集成，不是模型证据。Web、双主题浏览器旅程、R02真实harness与最终main集成尚未完成。测试数据库清理只针对硬编码独立 `flow_i01`，C01原测试只操作 `flow_c01`；不读取其他用户数据库。
