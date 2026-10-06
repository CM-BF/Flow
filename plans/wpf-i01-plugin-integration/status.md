# WPF-I01 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 03:30 UTC / 03:25 UTC 只读核验本机 main，未集成本 feature |
| Plan | [plan.md](plan.md) |
| 单一status owner / model | workspace_panels_owner / gpt-6-astra ultra |
| 阶段 | M2 |
| 优先级 | 2 |
| 当前产出 | 固定实现 92a786abb9f7ef16e15482ac00b98ff860ecc47f 获 root 独立 APPROVED，两个进行中发现 CLOSED；作者交付完成，实现停止写入 |
| 下一可用交付 | 原 Lead 集成队列；等待正式 scope 转交后再承接 CHAT frontend，不自行开写 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| 实现目标 | 92a786abb9f7ef16e15482ac00b98ff860ecc47f |
| 实现范围 | apps/web/src/App.tsx, apps/web/src/TaskThread.tsx, apps/web/src/components/assistant-ui/elements/thread.aui.tsx, apps/web/src/components/workspace/WorkspacePanels.tsx, apps/web/src/plugin-integration, apps/web/src/themes.ts, apps/web/test/plugin-integration.browser.ts, apps/web/test/plugin-integration.config.ts, apps/web/test/plugin-integration.test.ts |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-integration |
| Branch | codex/web-plugin-integration |
| 工作基线 / HEAD | c526c1c889437ee39155d669921577995195c74e / 实际完整输入 merge 1002f2688c2b4d2e3a5723d94bdbe965a2a88626；实际 metadata HEAD 由 Git 聚合，不作为实现 target |
| 工作树dirty状态 | 实现已冻结；正式 review metadata 提交后 Git 聚合实际 clean 状态，rootlock 已恢复 |
| 工作分支状态 | completed；实现、作者检查和独立 review 均完成，已交原 Lead 集成；main 未集成 |
| 检查状态 | PASSED 92a786abb9f7ef16e15482ac00b98ff860ecc47f; 9 bridge + 15 host direct tests, 9 HTTP fixture browser groups, 3 real PG/public runner journey groups, typecheck, build, production smoke；范围与限定见 validation |
| 已集成main状态 / HEAD | NOT_INTEGRATED；03:25 只读 main 3773db5d014a6d38d09553acd0a5fe8df900b7c4，未 merge main |
| Review | [review.md](review.md)，APPROVED，target 92a786abb9f7ef16e15482ac00b98ff860ecc47f |
| D04 claim | b6666c29-ebc5-47b2-b754-55b62687fd00 / v1 / writer active；requestId wpf-i01-plugin-integration-20261006，committedAt 2026-10-06T02:58:06.016Z |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| WPF-I01-01 | completed | workspace_panels_owner | 两输入已审；D04 v1 active；完整 merge1002，无冲突；三件套唯一 |
| WPF-I01-02 | completed | workspace_panels_owner | [接缝映射](../../docs/evidence/wpf-i01/seams.md)；固定实现 92a786abb9f7ef16e15482ac00b98ff860ecc47f，13文件，未改 P01/shared |
| WPF-I01-03 | completed | workspace_panels_owner | [验证](../../docs/evidence/wpf-i01/validation.md)与[技能/clean-code](../../docs/evidence/wpf-i01/quality.md)；模拟和真实协议旅程分开 |
| WPF-I01-04 | completed | workspace_panels_owner | root 固定 92a786abb9f7ef16e15482ac00b98ff860ecc47f APPROVED；两个发现关闭，已交管理者/原 Lead 集成；main 未集成 |

## 已完成、阻塞与下一步

[领取证据](../../docs/evidence/wpf-i01/assignment.md)记录正式 receipt、现场 active v1 核验及 M02 v2 三路径释放。唯一事实源在本文件；管理准备目录由管理者转 stub。已正式获派发：Node24/pnpm9.15.4 本树独立安装既有依赖；临时 lock patch 保存并还原。完整 no-ff 合入已审 P01 2910，旧 M02 树三路径保持停写。实现已在受领范围提交并冻结；独立 review 已完成，停止 I01 实现写入，等待新 committed receipt 转交范围。

P01 实现6ce已获root整体APPROVED，PH-R1..R4 CLOSED；依赖阻塞解除。无新增用户决定。已有能力与后续风险分开：M02 的批准不覆盖 I01；P01 fixture 的通过不覆盖产品 App 挂载，也不覆盖跨中心 UI 生命周期。

## Dashboard 同步

03:30 UTC 正式review后作者只读 http://127.0.0.1:4320/api/snapshot：本树 canonical source、claim v1 matchesSource=true、human.complete=true、issues=[]、4/4 TODO、checks passed target92a、review approved target92a，implementationProof unchanged。见[批准后聚合](../../docs/evidence/wpf-i01/dashboard-approved.json)；先前3/4状态保留在[交付时实采](../../docs/evidence/wpf-i01/dashboard-observation.json)。管理准备目录已转 stub，未产生第二手填状态；领取、检查、review、main集成分开。

## 开发预览服务

服务 owner：workspace_panels_owner；http://127.0.0.1:55049/ ，HTTP fixture 模拟、当前 moving worktree，非固定交付。长期开发进程 session 79831，启动：`PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/workspace-preview.ts --preview`（动态端口，以输出为准）。保留供独立审查的开发预览，不替换用户已打开入口；行为测试另启自有动态端口，只清理测试进程，不停止此服务。

用户保留入口仍为已审 M02 http://127.0.0.1:49922/ ，服务 owner 同上、session 17885，运行在 web-unified-workspace/codex/web-unified-workspace，HEAD c526c1c889437ee39155d669921577995195c74e；恢复法同上动态 preview 命令（在该树执行）。它也是 HTTP fixture，不是真实持续模型聊天。测试清理不得关闭此进程或改用户 tab。

## 已修进行中反馈与限制

Settings Close/Escape 回入口、Notes 上原生 reference 自动选择 workspace、workspace.tabs button/menu 消费均已修并局部验证；前两项 root CUA 曾独立检查（moving tree 反馈，不当作固定候选 approval）。当前 9 browser 组重跑覆盖全部组合。03:30 root 正式 APPROVED 固定 92a786abb9f7ef16e15482ac00b98ff860ecc47f；独立24tests与有界CUA旅程通过，见review。真实 PG 旅程使用公开 runner 协议与持久化任务、不是 live 模型。两个 >500kB build chunk 告警保留；composer 插入明确 unsupported；持久插件管理归 X01、持续真实对话归 U11，均不算本 feature 已完成。
