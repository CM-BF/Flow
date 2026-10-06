# WPF-I01 固定候选验证

时间：2026-10-06 03:27 UTC。Owner：workspace_panels_owner / gpt-6-astra ultra。作者检查，不代表独立 review 或 main 集成。

实现 target：`92a786abb9f7ef16e15482ac00b98ff860ecc47f`。实现 base：`1002f2688c2b4d2e3a5723d94bdbe965a2a88626`；完整输入为 M02 `c526c1c889437ee39155d669921577995195c74e` 与 P01 `2910ebc8e11fbcb00d1c2773face229c84fe47cd`（已批准代码6ce）。作者实现仅13文件，具体 scope 与 receipt 见 [assignment](assignment.md)、[status](../../../plans/wpf-i01-plugin-integration/status.md)。未改 P01、根 manifest/lock 或共享实现；两笔 implementation commit 后仅写本 feature metadata。

## 环境与启动

- Node v24.20.0，pnpm 9.15.4；本树安装既有依赖，0新增依赖。`apps/web/node_modules/@flow/client` 和 `@flow/contracts` 实际指向本树 packages。临时 rootlock 差异原样保存在 [dependency-install.patch](dependency-install.patch)，根锁已恢复，未提交根 manifest/lock。
- 开发：在 `web-plugin-integration` 执行 `PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/workspace-preview.ts --preview`。动态端口，以实际输出为准。当前长期服务 http://127.0.0.1:55049/ ，session 79831，owner 同上，HTTP fixture 模拟，自动公共 fixture token。不是 live 模型对话。
- 用户保留的已审 M02 服务 http://127.0.0.1:49922/ 在 `web-unified-workspace` / HEAD c526，session17885。相同动态启动命令在该树恢复。未停止/重启它、未更改用户 tab。
- 实际连接：常规 `pnpm --filter @flow/web dev`，连接表单输入中心 URL 与 owner token。真实中心必须单独存在；本检查不保存凭据。

## 已执行检查

命令都从本 worktree 执行，PATH 包含 `/opt/homebrew/opt/node@24/bin`。

| 检查 | 命令 / 结果 | 证据和界限 |
| --- | --- | --- |
| 窄 bridge + host 直接依赖 | `pnpm exec vitest run apps/web/test/plugin-integration.test.ts apps/web/test/plugin-host.test.ts --no-cache --reporter=json --outputFile=docs/evidence/wpf-i01/module-results.json`；24/24 PASS（9+15） | [module-results.json](module-results.json)；资源归属/错误传播/旧连接命令与迟到请求/窄订阅。检查后 bridge/host source 未改；最后新增为 React slot/样式与 fixture |
| 产品浏览器 | `pnpm exec tsx apps/web/test/plugin-integration.browser.ts`；9组 PASS；pageErrors=[] | [browser-results.json](browser-results.json)，03:26 最终实现同内容；两隔离 HTTP fixtures，不是真实中心 |
| 有界真实中心 | `FLOW_TEST_ADMIN_URL=<local test administrator URL> pnpm exec tsx apps/web/test/plugin-integration.browser.ts --real`；3旅程组 PASS，任务 succeeded，0 cancel，pageErrors=[] | [real-center-results.json](real-center-results.json)；随机隔离 PostgreSQL DB、真实中心、公开 runner report/heartbeat、1持久任务。03:19执行；随后 unused callback 移除及 workspace.tabs 合法动作/窄屏 chrome 调整由产品 browser 与生产烟测覆盖，未重跑 PG。不是 live 模型 |
| 类型检查 | `pnpm --filter @flow/web typecheck`；PASS | 最后 TypeScript 变更后执行；之后只有 CSS、metadata |
| 生产构建 | `pnpm --filter @flow/web build`；PASS | Vite8.3.2；保留两个 >500kB chunk warning，未掩盖/提高告警阈值 |
| 生产冒烟 | `pnpm exec tsx apps/web/test/plugin-integration.browser.ts --production`；PASS，pageErrors=[] | [production-smoke.json](production-smoke.json)，03:26最终代码 bundle；独立 fixture，官方 Thread、实际 WorkspacePanels、按需 workspace/theme adapter chunks、主题禁用回退、Settings回焦点 |
| 改动边界 | `git diff --exit-code 1002f2688c2b4d2e3a5723d94bdbe965a2a88626 -- apps/web/src/plugins pnpm-lock.yaml package.json`；PASS | 原 P01 来源与共享锁未被作者更改；实现路径全部匹配 D04 v1 scope |
| 文档与 whitespace | 本地 Markdown 链接/稳定 TODO/receipt JSON/type 与 source/docs diffcheck | 原始 patch 的空上下文原样保留，不能把包含该 patch 的全量 diffcheck 写为通过 |

9 browser 组实际覆盖：首屏 detail0；侧栏局部 B 与真实官方 Thread message action；Notes 上原生引用打开/焦点/缓存；Settings Close/Escape 和 sample disable/theme fallback/草稿保存；8 chat一观察者与两split两观察者/决定；light/dark390px与减少动画/键盘/无横溢；两个中心同ID的active/hidden面板状态重置；迟到reference和迟到lazy module隔离；合法workspace.tabs button/menu在tablist外、本地B上下文、键盘菜单及disable清理。

真实中心步骤：提交1任务、协议runner claim；报告持久化进展和人工决定；从插件侧栏进入真实任务，Web批准后 owner.show/runner heartbeat读到决定；runner报告精确hash产物/verification/completed；官方Thread→插件WorkspacePanels显式一读，Notes往返缓存；sample Ocean启用/禁用回Dark，保留已完成产物、390px可见。`finally`仅清理自有浏览器/Web/中心/随机DB。所有长期预览均保留。

## 截图

- 最终 HTTP fixture：[浅色桌面](integration-light.png)、[深色桌面](integration-dark.png)、[浅色390px](integration-light-390.png)、[深色390px](integration-dark-390.png)。已实际打开检查，48px rail/紧凑侧栏、原生活动详情tab、长版本换行可见。
- 局部扩展 contract fixture：[390px tabs与button/menu](workspace-slot-actions.png)，测试入口仅供浏览器检查，未被产品 App import；正式产品不会多出该测试按钮。
- 真实 PostgreSQL/public runner：[浅色](real-center-light.png)、[深色390px](real-center-dark-390.png)。真实指中心持久化与公开协议，不是模型生成内容。
- [browser-failure.png](browser-failure.png)保留开发阶段失败截图，不作为最终通过截图。开发过程的 selector/fixture假设失误与真实产品缺陷在 [quality](quality.md) 区分。

## Clean-code、限制与后续

技能来源、实际应用、03:00/03:04/03:07/03:26安全停点和发现/修复见 [quality](quality.md)。Settings 焦点问题经 root moving-tree CUA复验；最终target仍独立 NOT_STARTED。不得拿输入P01/M02的 APPROVED 代替本次产品App审查。

本轮是 trusted Web host 的连接内挂载，没有 npm安装/持久配置/第三方隔离/跨CLI插件管理；用户明确要求的完整管理由主线X01权威计划承接。`flow.composer.insertText` 明确unsupported并显示错误，不改草稿。Terminal仅任务输出，FileTree仅任务产物/引用；无PTY或任意磁盘API。既有HTTP fixture仍固定模拟流程，用户新增真实持续模型对话由U11承接，不宣称这里已实现。只验证Chrome及上述390px；未覆盖其他浏览器、大型历史性能或完整E2E模型调用。

构建主chunk581.60kB/gzip174.09kB、assistant-ui562.08kB/gzip169.61kB告警保留；workspace/theme adapter chunks按需请求已验，但共享WorkspacePanels代码未声称全部单独延迟。后续性能轮独立scope，不为此次实现作无证据优化结论。原Lead负责main集成；本owner没有merge main。

03:28 UTC [dashboard 实采](dashboard-observation.json)：canonical source/claim v1 matchesSource、人类字段齐全、checks passed/review not_started/main未集成、implementationProof unchanged、issues空。55049与49922 HTTP均200。
