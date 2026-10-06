# Agent 前端开发与测试工具研究 · 2026-10-05

状态：官方资料与本地 skill 审阅结论，工具候选 / 未在 Flow 实测；不是已经安装或接入。Goal Owner 提供研究，Execution Lead 落盘。本备忘录不修改冻结 W01/D01 或 LAB01 的实现范围，关联 [plan](plan.md)、[status](status.md)。

## 建议的最小工具链

- Playwright CLI + 已有 webapp-testing 方法负责真实浏览器操作与证据；Playwright Test 负责可重复回归、截图基线和 axe 检查。
- Chrome DevTools MCP 按需诊断 trace、network、console；其 CLI 仍 experimental，仅作候选试验，不作为稳定底座，不同时维持多套浏览器控制器。
- React Grab 作为用户指认元素、回传组件/源码位置的开发工具候选。Storybook MCP 等组件数量增加后再评估；agent-browser 作为 CLI 备选，不同时堆三套控制器。

以上是工具职责建议，并非所有工具现在都需要安装。先用项目已有 Playwright 与明确 ready 信号完成行为验证，再按缺口增加工具。

## 官方依据和使用限制

[Microsoft Playwright CLI](https://github.com/microsoft/playwright-cli) 支持按需页面输出、独立 session，show 可查看浏览器预览，当前 SKILL 还有 show --annotate。[Playwright MCP README](https://github.com/microsoft/playwright-mcp) 建议 coding agents 考虑 CLI + skills；官方 token 宣传不是 Flow 实测节省。

[Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) 提供 trace、network、screenshot、source-mapped console，并有 CLI。[官方 CLI 文档](https://raw.githubusercontent.com/ChromeDevTools/chrome-devtools-mcp/main/docs/cli.md)明确标记 experimental，支持 `--workspace` 限制文件工具目录；未来只指定当前worktree/evidence路径。后续试验要固定版本与独立浏览器 profile；显式使用 `--no-usage-statistics`、`--no-performance-crux` 关闭相应采集，不将内网 URL 发往 CrUX。

[React Grab](https://github.com/aidenybai/react-grab) 使用 MIT 许可，支持 Vite dev-only import，可将选中元素与组件/源码位置交给 agent。它是开发工具候选，不混入生产包，当前不改外部 W01。

[Agentation](https://www.agentation.com/) 是同类反馈候选；本次站点声明内部使用免费，随产品再分发需要商业许可。当前仅考虑内部工具，不内嵌 Flow 分发；这不是法律结论，实际使用时重新核对适用条款。

[Storybook AI 文档](https://storybook.js.org/docs/ai) 仍标记 preview，涉及组件 manifest、story 生成和测试。先维护小规模组件状态页，再判断引入 Storybook 的收益。

[Playwright 截图基线](https://playwright.dev/docs/test-snapshots) 需要固定 browser/OS/fonts，baseline 必须经过视觉判断；像素一致不等于美观。[axe 可访问性测试](https://playwright.dev/docs/accessibility-testing) 只能发现部分问题，仍需键盘和视觉检查。[Playwright test agents](https://playwright.dev/docs/test-agents) 的 planner/generator/healer 可供方法参考，但 healer 可能 skip 坏功能；跳过测试、删断言或直接接受新截图 baseline 不能记作修复成功。

## 本地方法与四类验收

已存在 `/Users/citrine/.agents/skills/webapp-testing/SKILL.md`，但其中 networkidle 示例不适合 SSE；使用具体 locator 或应用 ready 信号。frontend-design 可指导视觉；design-taste-frontend 开头明确不面向 dashboards，不作为 Flow 操作台的主设计技能。

行为可用、视觉布局、可访问性、性能分别记录。双主题、窄屏、长文本、失败/等待/断线与按需详情都需真实证据。可重复行为测试不替代审美判断；性能测量也不替代功能正确性。

## 与当前工作的关系

LAB01 的两个可丢弃 vanilla toy 可使用现有 Playwright；不拖慢原任务时，可额外做一次官方 CLI 最小 smoke：独立版本/临时目录/session，打开页面、snapshot、实际点击、截图并关闭，不全局安装或改根依赖。只有实际检查后才能写接入结果；没有实测继续保留为候选。外部 W01/D01 的已冻结公共业务契约不因本备忘录改变。
