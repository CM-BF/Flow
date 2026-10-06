# W01 + D01 外部执行分队交接

状态：两任务已由用户外部分队完成并接收。W01交付b04df958，D01交付6783562；原始冻结基线eacee76保持可用，以下保留派工边界记录。协调者 + 两个 feature owners 最多 3 个活跃 agents，所有写入至少 Sol。不得在内部重复派发，也不自行 merge main。

## 冻结基线与工作目录

交接基线为包含本文件、D01 计划与 dashboard 规则的提交；完整 SHA 由 Execution Lead 在用户派工消息中提供。远程分支 `origin/codex/plan-status-review` 已可推送；不要自行追逐它后续 HEAD。开始前核验本地 base/head、branch、dirty 状态和实际工作目录，不覆盖已有变化。

| Task | 独立 branch | 唯一 owner worktree | 计划 |
| --- | --- | --- | --- |
| W01 | `codex/m1-web` | `/Users/citrine/Projects/AgentHarness/Flow-worktrees/m1-web` | [plan](../../plans/w01-web/plan.md) / [status](../../plans/w01-web/status.md) / [review](../../plans/w01-web/review.md) |
| D01 | `codex/execution-dashboard` | `/Users/citrine/Projects/AgentHarness/Flow-worktrees/execution-dashboard` | [plan](../../plans/d01-execution-dashboard/plan.md) / [status](../../plans/d01-execution-dashboard/status.md) / [review](../../plans/d01-execution-dashboard/review.md) |

若两个目录已由 Execution Lead 创建，直接使用，不再建立第二套 owner。协调者只读调度；两个 owner 分别更新自己 status，不改对方目录。基线变化由 Execution Lead 通知具体 SHA/影响；依赖共享修改先提出清单。

## W01 输入与边界

只写 `apps/web/**`、`plans/w01-web/**`、`docs/evidence/w01/**`。`packages/contracts/src/{tasks,runner,fixtures,index}.ts`、`packages/client/src/index.ts`、[公共契约](../architecture/m1-contract.md) 为只读输入。现成 `taskFixtures` 提供六种任务提交配置；公共 FlowClient 提供 submit/list/show/events/watch/detail/decide/cancel。测试可在自己的目录实现符合这些 Interface 的 HTTP fixture；真实中心尚待集成，不能把 mock 证据当完整 M1。

Web 采用前后端分离；提交持久受理、断开浏览器不取消、SSE 以已送达 cursor 重连、人工决策/显式取消、正文与仅 id/title 引用、展开详情、产物版本/验证/usage 分类。浏览器业务状态来自中心。两套完整浅深主题 + 可扩展 tokens/注册机制，验证等待/运行/失败/断线/完成/验证失败、大详情按需加载、键盘/窄屏/减少动画。

实际使用 assistant-ui 的 ExternalStoreRuntime 适配中心投影；合理使用 AI Elements 的工具/产物展示组件，避免重复权威运行/消息状态。不得新增浏览器直接模型调用。Node 24、pnpm workspace；新依赖在 `apps/web/package.json` 固定版本。为能独立安装/验证，特许 W01 owner 仅在自己的隔离 worktree 由 pnpm 临时生成根 `pnpm-lock.yaml`，不得改根 manifest，不提交根 lock。交付前把锁差异保存到 `docs/evidence/w01/dependency-lock.patch`，记录 Node/pnpm/精确包版本及实际安装检查，然后恢复本分支根 lock；Execution Lead 依据 manifest/patch 在 integration 分支统一生成并提交 lock。禁止改其他 worktree 的锁文件。该例外无需等待逐包批准。

## D01 输入与边界

只写 `apps/execution-dashboard/**`、`plans/d01-execution-dashboard/**`、`docs/evidence/d01/**`。详细要求见 D01 plan。最小方案 Node 内置 HTTP + HTML/CSS/JS，无新增生产依赖，不接产品运行时或修改 `apps/web`。

唯一手填事实源是各任务 status.md；聚合器/JSON 是派生输出。以下登记用于只读选择来源，路径前缀 `/Users/citrine/Projects/AgentHarness/Flow-worktrees/`：

| 任务 | 权威 worktree 子目录 | branch | status 相对路径 |
| --- | --- | --- | --- |
| FLOW-001/002/003、OPS-001 | plan-status-review | codex/plan-status-review | 对应 plans/flow-* 或 plans/ops-001-status-review/status.md |
| C01 | m1-control-plane | codex/m1-control-plane | plans/c01-control-plane/status.md |
| R01 | m1-runner | codex/m1-runner | plans/r01-runner/status.md |
| L01 | m1-cli | codex/m1-cli | plans/l01-cli/status.md |
| W01 | m1-web | codex/m1-web | plans/w01-web/status.md |
| D01 | execution-dashboard | codex/execution-dashboard | plans/d01-execution-dashboard/status.md |

main 只读路径 `/Users/citrine/Projects/AgentHarness/Flow`，当前 main 尚无应用集成。不要读取每个 worktree 的所有 status 再按更新时间竞选，也不修改别人的状态。记录 source/head/dirty/同步时间，解析错误与缺失显示未知；main 事实单独核对，禁止自动从 branch 完成推断 main。

## 技能与检查

先用 `/Users/citrine/.agents/skills/find-skills/SKILL.md` 方法定位相关技能，优先本地，读后实际应用。共同：`codebase-design`、`clean-code`；前端相关：`frontend-design`、`vercel-react-best-practices`（React 时）、`webapp-testing`，均在 `/Users/citrine/.agents/skills/<name>/SKILL.md`。每段、约30分钟安全停点、交付前 clean-code 记录范围/发现/修复/限制。

W01 必读且已按用户要求安装：
- `/Users/citrine/.agents/skills/assistant-ui/SKILL.md`；来源 `https://github.com/assistant-ui/skills`，固定 `139674dc888ee076982b6726e8e6f5d0fe0b5f67`。
- `/Users/citrine/.agents/skills/ai-elements/SKILL.md`；来源 `https://github.com/vercel/ai-elements`，固定 `6a9d5b1822ffb10bba4bd97175f01edd7d8651cd`。
- clean-code 来源 `https://github.com/sickn33/agentic-awesome-skills`，固定 `bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5`；无需重复安装。

完整发现记录见 [技能基线](../quality/skills.md)。查官方当前 API 并锁定实际依赖版本；skill 的示例栈不能覆盖 Flow 的自托管、权限或模型门槛。

## 回传

启动即确认 owner/model/base/head/worktree/独占范围并更新自己的 status。交付回传完整 head SHA、分支/dirty 状态、启动命令/本地 URL、检查命令和真实结果、两主题证据、技能/clean-code 记录、未验证/阻塞、自己的 plan/status/review 路径及具体 review target。所有完成都同步 status 事实源；dashboard 未实现时注明等待展示，完成后验证聚合。独立 review 默认只读，修复由 owner 执行，工程集成由原 Execution Lead 负责。


## 冻结后的新增状态源（不改变外部实现基线）

W01/D01继续使用冻结 `eacee76fa7f1b6cc46b06b57ae68458637be4a26`；以下只是dashboard只读任务登记补充，owner开始时核验实际路径/branch/head：I01→`m1-integration` / `codex/m1-integration` / `plans/i01-integration/status.md`；R02→`m1-native-harness` / `codex/m1-native-harness` / `plans/r02-native-harness/status.md`；LAB01→`performance-probes` / `codex/performance-probes` / `plans/lab01-performance/status.md`。根前缀仍为上表相同Flow-worktrees。研究/汇总仍由plan-status-review worktree的Execution Lead维护；其他worktrees的副本不覆盖各task owner状态。

交付后新增登记：D02→`dashboard-progress-sync` / `codex/dashboard-progress-sync` / `plans/d02-progress-sync/status.md`；LAB02→`observer-probes` / `codex/observer-probes` / `plans/lab02-observer-probes/status.md`。D02实现只追加来源，用户4320预览需由Lead核对归属后重启到新代码；临时smoke不表示旧预览已更新。
