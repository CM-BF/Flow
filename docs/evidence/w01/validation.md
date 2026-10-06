# W01 验证证据

实现目标：`866c20e8462f295736f685541e2ecb9ba8639101`，branch `codex/m1-web`；冻结基线 `eacee76fa7f1b6cc46b06b57ae68458637be4a26`。2026-10-06 01:24 UTC 修复后最终实现检查。本文记录 owner 验证，不是独立 review approval。

## 环境与命令

Node 24.20.0 (`/opt/homebrew/opt/node@24/bin/node`)、pnpm 9.15.4、Playwright 1.63.0、本机 Google Chrome headless。新生产依赖全部精确固定：React/React DOM 19.3.0、assistant-ui 0.15.23、lucide-react 1.52.0；Vite 8.3.2、plugin-react 6.1.2 与 React types 19.3.0。Prettier 3.6.2 临时 CLI 仅格式化 W01 文件，未新增工程依赖。

| 检查 | 结果 |
| --- | --- |
| `pnpm typecheck` | PASSED，全仓 TypeScript |
| `pnpm test` | PASSED，3 files / 13 tests：W01 9、client 2、contracts 2 |
| `pnpm --filter @flow/web build` | PASSED；CSS 12.50 kB / gzip 3.23 kB；main JS 329.14 / gzip 100.65 kB；assistant-ui chunk 284.85 / gzip 83.60 kB；无 >500 kB chunk warning |
| `pnpm --filter @flow/web test:browser` | PASSED，5/5，10.6 s；每场景 pageerror 将使测试失败；[完整结果](browser-results.json) |
| 生产构建 Chrome 冒烟 | PASSED，5176 临时 preview 的真实连接表单可见、fixture banner 为0、pageErrors为空；没有连接真实中心 |
| `git diff --cached --check` | 实现提交前 PASSED |
| 根 lock 恢复 | `git diff -- pnpm-lock.yaml` 无差异；[依赖 lock patch](dependency-lock.patch) 交原 Execution Lead 集成 |

## 公开行为覆盖

公共 HTTP fixture + 真实 FlowClient：丢失受理响应后原幂等键重试仅创建一个任务；改变输入产生新key；浏览器观察断开不发取消并可重开已完成任务；SSE 从实际 nextCursor（不是更大 watermark）重连；严格 TaskSummary 的空事件页更新状态、pendingDecision 与 usage；reset重取快照；snapshot最新100条与更早历史分页分开；详情仅展开获取、并发去重、切换A/B/A的延迟响应不污染新generation；取消请求与停止确认分开；approve显式发中心命令。

浏览器：主要状态在浅/深两主题；选择任务/浏览器hash路由；人类批准；新任务提交后离开并返回；明确取消确认；真实浏览器offline/online恢复且没有cancel请求；134条记录加载、262 KiB以上内容按需读取；390px窄屏无横向body溢出；原生button键盘Enter展开；首次Tab命中可见skip-link、Enter到main且保留task路由；减少动画媒体设置；损坏hash安全落到欢迎页。

## 截图

- 等待决策：[浅色](light-waiting.png) / [深色](dark-waiting.png)
- 运行：[浅色](light-running.png) / [深色](dark-running.png)
- 执行失败：[浅色](light-failed.png) / [深色](dark-failed.png)
- 完成且验证失败：[浅色](light-verification-failed.png) / [深色](dark-verification-failed.png)
- 已完成：[浅色](light-completed.png) / [深色](dark-completed.png)
- 队列中：[浅色](light-queued.png) / [深色](dark-queued.png)
- 等待协调：[浅色](light-uncertain.png) / [深色](dark-uncertain.png)
- 浏览器断线：[浅色](light-disconnected.png) / [深色](dark-disconnected.png)
- 390px窄屏、键盘焦点和减少动画：[浅色](light-narrow.png) / [深色](dark-narrow.png)
- [按需产物和版本](dark-artifact.png) / [长记录大详情](light-large-detail.png)

Owner目视浅/深等待、深色验证失败、窄屏截图后修正skip-link截图溢出；最终使用clip-path隐藏保持真实Tab可达，窄屏保留Change connection入口。

## 范围限制

上述均为符合公共契约的 HTTP fixture 或生产静态加载检查。fixture是独立Node进程内存状态，不证明PostgreSQL事务持久受理、中心或runner进程重启、真实模型、真实产物verifier、真实usage账单或跨机恢复。真实中心联调由原 Execution Lead 后续集成验证。没有浏览器端模型调用或真实凭据持久保存。长记录验证为134条/约270KB详情，不声称无上限容量。

## 启动与交接

参见 [Web README](../../../apps/web/README.md)。当前可看 `http://127.0.0.1:5174/#task=demo-decision`；HTTP fixture4317。浏览器测试专用5175/4318；初始4310发生EADDRINUSE，未终止他人进程，改用4317。

根manifest/contracts/client均未改；共享变更请求仅 apps/web/package.json 对应的 workspace lock 集成。双主题拓展点在 `src/themes.ts`，没有第二套手填业务事实。

## 独立review修复

原实现 `de5f6a7e85e248e5a56f8fa619c063f4beec6ef1` 经协调者只读审查发现P2 W01-R1：离线时误使详情/快照generation失效，可能永久loading或丢失选择。修复 `866c20e8462f295736f685541e2ecb9ba8639101` 将网络暂停只作用于观察；保留请求生命周期、selectedId及上线重新读取。新增2个HTTP回归，所有最终检查已重跑通过；独立复审结论记录于review.md。
