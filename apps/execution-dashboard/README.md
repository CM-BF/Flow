# Flow 工程进度 dashboard

独立于产品 Web 的本地只读网页。按派工登记，从各 task 唯一 owner worktree 的 `status.md` 生成 JSON 和 UI。没有第二套手填状态，也不调用产品中心或模型。Node 24.20+，生产依赖 pg 8.23.1；先在仓库根运行 `pnpm install --frozen-lockfile`。领取账本独立于产品中心，专用协调 PostgreSQL 不可用时进度仍可读，领取显示未知。

## 启动

在此 worktree 根目录：

```sh
node apps/execution-dashboard/src/server.mjs
```

本机明确使用 Node 24：

```sh
/opt/homebrew/opt/node@24/bin/node apps/execution-dashboard/src/server.mjs
```

打开 <http://127.0.0.1:4320>。只绑定 `127.0.0.1`；默认端口 4320，与产品 Web / 中心分开。可用 `PORT=4321` 修改端口。网页每 20 秒重新只读聚合，可手动刷新；隐藏标签页停止轮询。读取失败时保留旧快照并显示错误。

JSON：`GET /api/snapshot`。一次性生成 JSON 到标准输出：

```sh
node apps/execution-dashboard/src/server.mjs --json
```

### 唯一来源登记

默认登记在 `src/registry.mjs`，严格按冻结交接选择，绝不搜索其他副本并比较时间：

| Task | 唯一 owner worktree（`Flow-worktrees/` 下） |
| --- | --- |
| FLOW-001 / FLOW-002 / FLOW-003 / OPS-001 | `plan-status-review` |
| C01 | `m1-control-plane` |
| R01 | `m1-runner` |
| R02 | `m1-native-harness` |
| L01 | `m1-cli` |
| W01 | `m1-web` |
| D01 | `execution-dashboard` |
| I01 | `m1-integration` |
| I02 | `m2-integration` |
| LAB01 | `performance-probes` |
| LAB02 | `observer-probes` |
| D02 | `dashboard-progress-sync` |
| C02 | `m2-reconciliation` |
| P01 | `protocol-adapters` |
| M02 | `m2-workspace` |
| D03 | `dashboard-human-view` |
| WPF-001 | `web-platform-management` |

D02按已确认派工补登记R02/I01/LAB01/LAB02及自身。来源文件的未知字段仍保守处理，不因为新增登记变成检查或review通过；真实读取证据见`docs/evidence/d02`。现有4320实例不会自动换代码，部署/重启由协调者另行安排。

默认 worktree 路径来自本机交接。其他机器需显式传 `--config /absolute/registry.json` 或 `FLOW_DASHBOARD_CONFIG`，登记包含 `mainWorktree`、`fallbackWorktree`、`frozenCommit`（完整 SHA）、`staleAfterHours`、`tasks`。每项含 `id`、`title`、`role`（`工作线` 或其他分组）、`worktree`（绝对路径）、`branch`、`planDir`（`plans/<name>`）、`evidenceDir`（`docs/evidence/<name>`）以及可选 `appEvidence`（`apps/<name>/EVIDENCE.md`）。配置只登记来源和显示名称，不承载进度。

导出默认登记后按环境调整路径：

```sh
node --input-type=module -e "import {defaultRegistry} from './apps/execution-dashboard/src/registry.mjs'; console.log(JSON.stringify(defaultRegistry(), null, 2))" > /tmp/flow-dashboard-registry.json
node apps/execution-dashboard/src/server.mjs --config /tmp/flow-dashboard-registry.json
```

main 的 HEAD / branch / dirty 单独只读观察。实现目标是现场 main HEAD 的祖先且声明范围树仍相同、无该范围 dirty 时显示“已合入，范围未变”；后继修改/删除/未提交实现显示“曾合入，当前待核验”；没有祖先关系时，只能用经过核验的声明范围树相同证明“范围与 main 相同”。不要求每次无关 main metadata 更新后重写所有 owner 状态；owner 的历史 main 记录仍在详情保留。只读 Git 设置 `GIT_OPTIONAL_LOCKS=0`，不刷新其他 owner index。

## 事实与未知

- 沿用既有 status 表格：`最近更新`（UTC）、`单一 status owner / model`、`Branch`、`工作分支状态`、`已集成 main 状态 / HEAD` 和稳定 ID 的 TODO 表。空格差异以及 `completed（branch）` 兼容。
- 首屏只读显式人类摘要，最多三项进行中工作，完成历史与摘要待补默认收起；完整原文、TODO、证据、SHA、时钟和来源均在详情。无百分比或 ETA。
- 独立检查状态只从可选 `检查状态` 行读取。仅识别行首 `PASSED` / `FAILED` 且同一行有完整目标 SHA，或 `NOT_RUN`。缺少该字段、未绑定 SHA或无法解析时显示“待核对”，不把历史 F00 或任意 `passed` 文本算作当前 feature 通过。详情始终保留 owner 原文和检查目标。检查目标不同于现场 HEAD 或 worktree 有未提交变化时标“历史通过”，不继承为当前提交已通过。
- Review 必须有明确行首 `状态：APPROVED` 和 `Review target commit` 完整 SHA，并有有效实现目标和 literal 实现范围。检查目标到现场 HEAD、HEAD 到工作树以及所有未跟踪文件（包括新增/删除）；范围内变化显示待复审，范围外非 metadata 变化显示未知。仅 plans/docs 的 Markdown、文本、JSON、patch、图片证据与根 AGENTS.md/README.md 视为范围外 metadata；该目录中的代码扩展也需核对。已审范围未变才继承绑定旧目标的 approval，不宣称整个新 HEAD 获审。范围不存在/目标不存在/未声明范围都保守。证据检查仍保留自身目标，不把 review 当作重新运行测试。
- 缺失 status 时，只可回读当前 D01 仓库冻结基线提交中的同路径记录，标“冻结旧记录 / 当前进度未知”。不会切换到其他 owner 的副本。冻结记录不可用则缺失；资料入口不会假装回读了不存在的实时文件。
- 默认 24 小时未更新、未来时间、标题任务 ID 不符、重复字段 / TODO、未知 TODO 状态、缺少关键表格、Git 不可用或分支冲突均明确警告。解析错误时不生成完成数量；陈旧记录仅显示上次记录值。
- Browser 只渲染不可信文本，无 Markdown HTML 执行。详情的资料按需加载，关闭可取消请求。

## 资料访问限制

资料入口只允许已登记任务的 plan/status/review，以及它们直接链接的本任务计划、证据目录或指定 `EVIDENCE.md`。拒绝绝对路径、越界、未引用证据、非白名单扩展、超过 2 MiB 的文件；对解析后的真实路径重新验证 worktree 与任务范围。仅返回文本或已知图片，HTML 不在白名单。服务器检查 loopback Host、仅接受 GET，并设置 CSP / nosniff；无 CORS 授权。此服务供本机本人查看，不是多用户认证服务。

## 主题与无障碍

浅 / 深 / 跟随系统；选择保存在本地。CSS 命名 tokens 在 `public/styles.css`，新增主题时补全同一 token 集并注册到 `public/app.js` 的主题集合和选择框。没有主题硬编码业务状态。窄屏工作线纵向排列；详情使用原生 dialog 管理 Tab / Escape / 焦点返回；页面有跳转链接和可见 focus。尊重减少动画偏好。

## 验证

安装固定 workspace 依赖后的样本行为测试（协调 PG 用例须配置专用测试连接，否则会明确 skip）：

```sh
node --test apps/execution-dashboard/test/*.test.mjs
```

只创建临时 Git 样本，覆盖 owner 选择、更新隔离、空 review、冻结 / 缺失 / 解析错误 / 过期、重复字段、分支与登记切换、main 与 review 分离、路径限制 / symlink / Host / XSS 文本、文件体积限制。真实 worktree 只读 smoke。D02新增来源可使用 `node apps/execution-dashboard/test/progress-smoke.mjs`，它在独立动态端口读取实际status并核对HTTP返回，写入 `docs/evidence/d02`；普通测试不运行此live检查。

浏览器检查使用 workspace 已有 Playwright 开发依赖（或设置 `PLAYWRIGHT_MODULE` 指向现有 Playwright module），浏览器工具本身不新增生产依赖：

```sh
node apps/execution-dashboard/test/browser-check.mjs
```

可选 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指定已有 Chromium / Chrome；`D03_EVIDENCE_DIR` 指定输出目录（默认 `docs/evidence/d03`）。脚本自行启动独占动态端口，读取实际 20 个登记来源，另创建隔离 Git/HTTP 样本验证语义，不访问 4320，不调用模型。只等待 ready locator / 明确状态，不等待 networkidle。截图、源观察和结果写入证据 JSON；执行后关闭浏览器与 server。

外部交付由 Execution Lead 集成，不合并 main。生产中心、真实 harness、跨机器 / 多用户部署不属于本任务验证。


## D03 人类摘要与实现范围

status 顶部同一 metadata 表中添加以下字段，不另建状态文件：

| 字段 | 格式 |
| --- | --- |
| 阶段 | 简短阶段，例如 M2 |
| 优先级 | 1–9，较小优先 |
| 当前产出 | 一句面向用户的话，最多 240 字符 |
| 下一可用交付 | 一句明确交付，最多 240 字符 |
| 当前阻塞 | NONE 或 ACTIVE: 具体当前阻塞 |
| 需用户决定 | NONE 或 REQUIRED: 明确选择 |
| 实现目标 | 已提交实现的完整 SHA |
| 实现范围 | 逗号分隔 repo 相对 literal 目录或文件；例如 apps/demo/ 或 apps/demo/main.ts |

缺失、UNKNOWN、无效字段显示摘要待补；不会提取“阻塞 / 风险 / 未验证”段落拼成当前阻塞。`无`、`无新增事项`兼容为 NONE；ACTIVE/REQUIRED 后也不能仅写无。某项摘要不完整时，仍能单独展示有效明确的 ACTIVE/REQUIRED，但未知本身不会变成阻塞/决定。来源不新鲜时不采信其当前事项。

实现范围不允许绝对路径、..、.git、反斜杠、glob 或 pathspec magic。每条范围必须存在于实现目标。新增未跟踪代码在范围外也会阻止 metadata-only 推断。范围树证明仅覆盖声明范围；historicalIntegrated 仅表示提交已入历史；current 还要求当前声明范围树相同（含新增/删除）且该范围无未提交变化。后继变化不表示新实现失效，只表示该目标无法证明当前范围。详情保留 proof 方法、完整目标、现场 SHA、范围、变化文件及观察时间。WPF-001 按父计划固定范围登记，不扩展为任意资料读取；既有计划子目录内直接引用资料可下钻。

## 多 Lead 领取

[D04 运行指引](../../docs/evidence/d04/README.md)说明专用PG数据库、环境变量、CLI回执、迁移、scope和交接。网页为只读入口，CLI必须与网页配置同一协调数据库；DB失效不允许根据空列表接手。

产品导航并列个人真实预览61228（首次仍需本人连接认证；空Center URL走已配置同源proxy）与旧模拟49922，不带token、不自动认证/发消息。常驻启动sourceAtStart是启动记录；Web采用Vite dev，当前页面可随已集成源码HMR，不能视为整个会话冻结版本。center/runner是否升级以实际进程重启记录为准。
