# Flow 工程进度 dashboard

独立于产品 Web 的本地只读网页。按派工登记，从各 task 唯一 owner worktree 的 `status.md` 生成 JSON 和 UI。没有第二套手填状态，也不调用产品中心或模型。Node 24.20+，无生产依赖。

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
| L01 | `m1-cli` |
| W01 | `m1-web` |
| D01 | `execution-dashboard` |

默认 worktree 路径来自本机交接。其他机器需显式传 `--config /absolute/registry.json` 或 `FLOW_DASHBOARD_CONFIG`，登记包含 `mainWorktree`、`fallbackWorktree`、`frozenCommit`（完整 SHA）、`staleAfterHours`、`tasks`。每项含 `id`、`title`、`role`（`工作线` 或其他分组）、`worktree`（绝对路径）、`branch`、`planDir`（`plans/<name>`）、`evidenceDir`（`docs/evidence/<name>`）以及可选 `appEvidence`（`apps/<name>/EVIDENCE.md`）。配置只登记来源和显示名称，不承载进度。

导出默认登记后按环境调整路径：

```sh
node --input-type=module -e "import {defaultRegistry} from './apps/execution-dashboard/src/registry.mjs'; console.log(JSON.stringify(defaultRegistry(), null, 2))" > /tmp/flow-dashboard-registry.json
node apps/execution-dashboard/src/server.mjs --config /tmp/flow-dashboard-registry.json
```

main 的 HEAD / branch / dirty 单独只读观察。记录的 main SHA 不等于现场 HEAD、现场非 main 或有 dirty 时标待同步，不推断已集成。只读 Git 设置 `GIT_OPTIONAL_LOCKS=0`，不刷新其他 owner index。

## 事实与未知

- 沿用既有 status 表格：`最近更新`（UTC）、`单一 status owner / model`、`Branch`、`工作分支状态`、`已集成 main 状态 / HEAD` 和稳定 ID 的 TODO 表。空格差异以及 `completed（branch）` 兼容。
- 工作分支原文与 TODO 完成数量并列展示；不计算百分比和 ETA。里程碑原样投影 FLOW-003 status，可能比 feature owner 记录旧，页面明确来源。
- 独立检查状态只从可选 `检查状态` 行读取。仅识别行首 `PASSED` / `FAILED` 且同一行有完整目标 SHA，或 `NOT_RUN`。缺少该字段、未绑定 SHA或无法解析时显示“待核对”，不把历史 F00 或任意 `passed` 文本算作当前 feature 通过。详情始终保留 owner 原文和检查目标。检查目标不同于现场 HEAD 或 worktree 有未提交变化时标“历史通过”，不继承为当前提交已通过。
- Review 必须有明确行首 `状态：APPROVED` 和 `Review target commit` 的完整 SHA；只对相同现场 HEAD 显示通过。旧提交显示待复审。空文件或 `NOT_STARTED` 是待审查，缺失 / 未识别结论是未知。代码 dirty 另外显示，approval 只绑定目标提交。
- 缺失 status 时，只可回读当前 D01 仓库冻结基线提交中的同路径记录，标“冻结旧记录 / 当前进度未知”。不会切换到其他 owner 的副本。冻结记录不可用则缺失；资料入口不会假装回读了不存在的实时文件。
- 默认 24 小时未更新、未来时间、标题任务 ID 不符、重复字段 / TODO、未知 TODO 状态、缺少关键表格、Git 不可用或分支冲突均明确警告。解析错误时不生成完成数量；陈旧记录仅显示上次记录值。
- Browser 只渲染不可信文本，无 Markdown HTML 执行。详情的资料按需加载，关闭可取消请求。

## 资料访问限制

资料入口只允许已登记任务的 plan/status/review，以及它们直接链接的本任务计划、证据目录或指定 `EVIDENCE.md`。拒绝绝对路径、越界、未引用证据、非白名单扩展、超过 2 MiB 的文件；对解析后的真实路径重新验证 worktree 与任务范围。仅返回文本或已知图片，HTML 不在白名单。服务器检查 loopback Host、仅接受 GET，并设置 CSP / nosniff；无 CORS 授权。此服务供本机本人查看，不是多用户认证服务。

## 主题与无障碍

浅 / 深 / 跟随系统；选择保存在本地。CSS 命名 tokens 在 `public/styles.css`，新增主题时补全同一 token 集并注册到 `public/app.js` 的主题集合和选择框。没有主题硬编码业务状态。窄屏工作线纵向排列；详情使用原生 dialog 管理 Tab / Escape / 焦点返回；页面有跳转链接和可见 focus。尊重减少动画偏好。

## 验证

无需安装依赖的样本行为测试：

```sh
node --test apps/execution-dashboard/test/*.test.mjs
```

只创建临时 Git 样本，覆盖 owner 选择、更新隔离、空 review、冻结 / 缺失 / 解析错误 / 过期、重复字段、分支与登记切换、main 与 review 分离、路径限制 / symlink / Host / XSS 文本、文件体积限制。真实 worktree 只读 smoke。

浏览器检查使用 workspace 已有 Playwright 开发依赖（或设置 `PLAYWRIGHT_MODULE` 指向现有 Playwright module），不新增生产依赖：

```sh
node apps/execution-dashboard/test/browser-check.mjs
```

可选 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指定已有 Chromium / Chrome；`D01_URL` 指定已启动地址；`D01_EVIDENCE_DIR` 指定截图 / JSON 输出目录（默认本任务 `docs/evidence/d01`）。脚本验证真实页面双主题、390px、键盘、状态文件下钻、首次加载失败恢复、临时样本 HTML / script 转义。实际运行环境、截图和结果见本任务证据与 status。

外部交付由 Execution Lead 集成，不合并 main。生产中心、真实 harness、跨机器 / 多用户部署不属于本任务验证。
