# Flow 工程执行 dashboard

| 字段 | 内容 |
| --- | --- |
| 计划编号 | D01 |
| 状态 | `completed` |
| 创建日期 / 最近更新 | 2026-10-05 / 2026-10-06 |
| 父计划 | [FLOW-003](../flow-003-m1-execution/plan.md) |
| Owner / model | d01_owner / gpt-6-astra ultra |
| Worktree / branch | `/Users/citrine/Projects/AgentHarness/Flow-worktrees/execution-dashboard` / `codex/execution-dashboard` |
| 基线 | 以 [外部交接](../../docs/handoffs/external-web-dashboard.md) 的冻结提交为准 |

目标：提供可本地打开的 Flow 工程执行高层进度网页，产品 Web 由 W01 单独负责。展示里程碑、工作线 owner、实际状态、下一交付、阻塞/用户决定、检查/review/main 集成区别、最近更新时间；可下钻 plan/status/review 和证据。浅色、深色完整支持，可扩展主题 tokens；不展示虚构百分比/ETA，也不让原始日志成为首页。

## 写入范围和数据源

独占 `apps/execution-dashboard/**`、`plans/d01-execution-dashboard/**`、`docs/evidence/d01/**`。默认 Node 24 内置 HTTP/文件读取与 HTML/CSS/JS，最小可维护实现，无新生产依赖；可以采用现有测试依赖。不得修改 `apps/web`、根 manifest/lock、公共 contracts/client、数据库迁移或其他任务 status。必要共享变更提给 Execution Lead。

每任务 `status.md` 是唯一手填事实源。通过配置的 task→owner worktree 登记只读聚合；优先对应 owner 的工作目录，不扫描后择“最新副本”。默认登记见交接，其他环境可显式配置；验证 worktree/branch，显示当前 head/dirty/更新时间及来源。非本地目录不可用时退回冻结记录并明显标明陈旧/未同步。只有 Lead 可核实并更新 main 集成事实，不能从 TODO 或分支通过推断 main 已具备。

解析/投影错误显示未知与原因，不悄悄编造状态。未开始的 review 显示待审查；检查证据绑定具体 commit。生成的 JSON/cache 仅派生，不手填。页面和文件浏览只绑定 loopback、允许登记仓库/任务内的资料；不可任意读取用户文件，Markdown/标题/日志按不可信文本处理。

## TODO

- [x] **D01-01** 读取应用相关本地技能，核验 task→worktree 登记和单一事实源规则
- [x] **D01-02** 实现只读聚合、来源/时间/分支/main 区分与未知/冲突状态
- [x] **D01-03** 实现高层网页、下钻资料、完整浅深主题和本地启动说明
- [x] **D01-04** 验证工作树切换/状态更新/缺失资料/空 review/两主题/窄屏/键盘行为，提交证据

## 验证和交付

使用临时状态样本验证，不改 C01/R01 等 owner 的真实资料；额外读取真实 worktrees 做只读 smoke。测试一份任务 status 改变后页面同步且不更改另一个任务、分支通过不等于 main、空 review 不等于通过；验证文本转义和路径限制。浏览器验证双主题与窄屏，记录具体截图/结果和未执行项。维护 [status](status.md)，独立审查目标见 [review](review.md)。外部 task 仅交 feature 提交与证据，不合并 main。

派工状态：`completed`（工作分支）；d01_owner 交付实现 `9c236c5f86b197c3e262a6b197f21ba2371ab9b0`，启动冻结基线 `eacee76fa7f1b6cc46b06b57ae68458637be4a26`。与 W01 无依赖；main 未集成。协调者独立 review 已通过该实现 target，后续 metadata 不自动继承全量 approval。

实现设计：Node 24 内置 HTTP 与文件/Git 读取；聚合、资料访问与浏览器展示分离。只读源由固定登记选取，缺失时展示本分支冻结基线记录及明确警告。首页使用工作线表格和来自 FLOW-003 status 的里程碑，不从计划正文制造进度。字段兼容中文空格及已有 status 表格，无法识别的检查结论保持未知。主题使用命名 CSS tokens，浅深完整映射，可新增 theme 配置。

交付记录：2026-10-06 01:25 UTC，Node24 10/10 行为测试、6组浏览器检查、双主题桌面与390px截图通过。证据见 [验证记录](../../docs/evidence/d01/validation.md) 与 [技能/clean-code](../../docs/evidence/d01/quality.md)。`plans/README.md`跨任务索引由原 Execution Lead 更新，owner 未越界修改。
