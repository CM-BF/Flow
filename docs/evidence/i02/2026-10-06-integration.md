# G01 / P02 / WPF-M02 实际集成

2026-10-06 03:15 UTC，Execution Lead / Astra Ultra。集成实现HEAD `1eb4196f1beecb13b7f845e680480babf1110d52`；后续仅记录与固定registry新增。skills沿用本地find-skills/codebase-design/clean-code，按实际影响局部验证，不为metadata重跑全库。

## 已审输入与范围

| 片段 | 已审实现 / reviewer | 范围 |
| --- | --- | --- |
| G01 | 6394afad2480da369adb7e6156403bfc45097dfa / Goal Owner只读 | 项目revision/CAS/graph、10项PG行为；不包含自动调度 |
| P02 | f942e5a5cbf138993dd7521792dd071a172c17e1 / Goal Owner只读 | Task-based A2A持久意图/binding/恢复/不盲重发；两初始化P2已关闭 |
| F01 | 36aeaff12000d77ebd025859f999c69612fce653 / Goal Owner只读 | 生产入口、共享contracts/client/CLI接线；不代替各模块approval |
| WPF-M02 | d47c602f3bab1fe97a9be70fd37780c2918bcfbc / 外部root | 连续工作入口与有限observer；SSE六连接饥饿P2已关闭 |
| D04 | ea8d44f7d9738cb98a1dfafd1636e2bbd7c17427 / Goal Owner、assignment_review | 已审领取与展示；后续O01/PERF两固定registry条目已核唯一status |

## 已执行的整合检查

以下是工具实际执行记录整理，不冒充新重跑或原始stdout。F01组合source8c27fed：

- `pnpm exec vitest run apps/cli/src/projects.test.ts apps/server/src/protocol-dispatch/dispatch.test.ts packages/contracts/src/harnesses.test.ts packages/client/src/client.test.ts`：10/10，4.26秒；真实PG与动态端口。
- `pnpm exec vitest run apps/runner/src/protocol-dispatch/runtime.test.ts --test-name-pattern='production server, runner and CLI'`：实际选择1项通过，14项未选择，3.09秒。使用真实生产server/runner/CLI、官方SDK peer、持久产物与独立验证；0模型。
- root typecheck通过；P02模块路径对f942源码diff为空，未重跑其已审15项全部矩阵。
- 集成WPF-M02到36d8d92后，锁冻结离线安装成功；Web投影显式20/20（1.39秒），Web typecheck、生产build通过（约0.28秒）。Web manifest未新增依赖；不重新应用历史锁patch覆盖已统一SDK依赖。
- 原WPF作者10task真PG/HTTP4组、独立root20投影/真实CUA7/8chat、Approve/artifact、split/merge、窄屏tab可见性证据保留于 docs/evidence/wpf-m02；本轮只做必要差异整合。

## clean-code / 限制

共享schema与模块实现保持唯一，client薄传输/命令稳定key、PG迁移4→5顺序和身份hook核对通过；受控合并冲突只选原owner完整文档与已审共享文件，未借integration新写领域实现。C02/M02摘要由其唯一owner交付记录接收。未增加层、broker或付费调用。

不声称自然语言goal编排、MCP持久input-required、多runner并行、真实PTY/fs、npm插件隔离或100agents容量完成。M1已封存的5次真实模型预算未新增。统一Web完成的是确定性多任务交互场景，语义解释与目标到计划仍由O01/E01继续。
