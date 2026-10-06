# W01 技能与 clean-code 记录

Owner：W01 owner；派发配置 gpt-6-astra / ultra（运行时无独立型号查询接口；本会话为 GPT-6）。2026-10-06 01:11 UTC 核验 worktree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/m1-web`、branch `codex/m1-web`、HEAD/base `eacee76fa7f1b6cc46b06b57ae68458637be4a26`、clean。

## 发现与实际方法

按 `/Users/citrine/.agents/skills/find-skills/SKILL.md` 的 domain/task 方法定位本地技能。React/TypeScript、中心事件投影、UI/浏览器验证均有适用本地技能，不重复联网安装。

| 技能路径（前缀 `/Users/citrine/.agents/skills/`） | 来源/版本 | 实际应用 |
| --- | --- | --- |
| brainstorming/SKILL.md | 已安装版本 | 承接用户批准的 W01 与公共契约；设计为任务侧栏、中心运行记录、按需产物，无再次批准门槛 |
| codebase-design/SKILL.md | 已安装版本 | projection 模块隐藏 snapshot/paging/reconnect/cache；HTTP 为 fixture/真实中心替换 Seam |
| clean-code/SKILL.md | sickn33/agentic-awesome-skills @ bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5 | 名称、单一职责、显式错误、去重、用户行为验证；不重新安装 |
| assistant-ui/SKILL.md | assistant-ui/skills @ 139674dc888ee076982b6726e8e6f5d0fe0b5f67 | ExternalStoreRuntime 与 Thread/Message primitives，仅渲染中心投影 |
| ai-elements/SKILL.md、references/artifact.md | vercel/ai-elements @ 6a9d5b1822ffb10bba4bd97175f01edd7d8651cd | 复用 Artifact 的可组合展示组件，替换 Tailwind 为 Flow tokens，不引入云模型 |
| frontend-design/SKILL.md | 已安装版本 | 蓝色导航、轻层级、清楚的执行/验收双状态；两套语义 tokens；系统字体与适量圆角 |
| vercel-react-best-practices/SKILL.md | metadata v1.0.0 | 外部 store 订阅、独立请求并行、详情按需/去重、避免重复权威消息 |
| webapp-testing/SKILL.md | 已安装版本 | 浏览器交互/截图/console 与网络证据，fixture 与真实中心验证明确区分 |

官方资料于 2026-10-06 核查：https://www.assistant-ui.com/llms.txt 、https://www.assistant-ui.com/docs/runtimes/custom/external-store 、https://elements.ai-sdk.dev/components/artifact 。锁定实际依赖见 apps/web/package.json。

## 设计记录

采用已批准的 Vite 自托管架构。左侧任务导航，主栏记录与决策，右侧轻量任务摘要；窄屏折为单栏。蓝色 `#385bc7`、正文 `#20293a`、画布 `#f3f6fc`、白色表面、警示琥珀与错误红；深色独立语义颜色。系统无衬线与清晰字号层级；产物按用户展开加载。浏览器负责投影、触发和缓存，所有业务状态来自中心。

## Clean-code 工作段

- 2026-10-06 01:11 UTC，开工：检查契约/状态设计。明确 nextCursor 不等于 watermark、断线不是取消、执行与验证分开，防止在 UI 猜测业务状态。实现与测试尚未完成。
- 2026-10-06 01:18 UTC，投影/UI 工作段：检查命名、职责、错误与缓存寿命。协调者早期只读提示与自查共同发现跨任务 detail Promise 被旧 generation 复用、命令成功后选中任务 summary 仍旧、hash 与 skip-link 混用。修复为 generation 隔离/只删除同一 Promise、应用 HTTP 确认的 summary、明确 `#task=` 路由及无hash变更的焦点跳转。7 个公共 HTTP 行为测试与 typecheck 通过；真实中心未验。
- 2026-10-06 01:19 UTC，浏览器工作段：首轮发现 hash-only 导航未触发选择、离线浏览器保留旧 Live 提示；已用 hashchange + online/offline 观察状态处理修复。键盘第二轮重复打开详情的测试自身前提修正为检查当前展开状态；补充严格 TaskSummary 空帧断言 pendingDecision/usage。全仓类型与 11 tests 通过。按 React bundle 方法把 assistant-ui 活动显示模块延迟加载，避免连接/空白首页提前载入它；重跑浏览器中。
- 2026-10-06 01:21 UTC，交付前 clean-code：重新检查组件名称、中心投影单一职责、错误消息、幂等键、页面/请求寿命和未使用复杂度。移除活动模块lazy导入（离线发生于chunk加载中会失败），改用构建分包，两个主要JS chunk均<500 kB且初始模块可可靠加载。投影/表单/主题/展示各司其职，未增加第二套消息或执行存储。所有源码经Prettier3.6.2格式化。最终typecheck、11 tests、build、5 browser tests全部通过；限制为真实中心/模型和独立review待执行。
- 2026-10-06 01:24 UTC，review修复工作段：协调者独立发现W01-R1（离线与选择generation混用）。采用清楚的接口语义：网络状态只暂停/恢复observer，真正的选择/清理才改变generation；详情返回继续结算，selectedId允许上线重取失败快照。两个公共HTTP回归覆盖延迟详情/快照以及失败快照恢复。修复commit866c20e8462f295736f685541e2ecb9ba8639101；13 tests/typecheck/build/5 browser全部通过。未解决：独立复审与真实中心集成。

- 2026-10-06 01:25 UTC，交付复核：协调者对866c20e独立APPROVED，W01-R1关闭。Owner检查命名、observer与选择生命周期、错误可恢复、两套主题与文档事实一致；无剩余实现阻塞。真实中心/模型、多浏览器/屏读继续明确未验；不合并main。
- 2026-10-06 01:27 UTC，metadata检查：Git将嵌套lock patch的单空格上下文行提示为尾空格；这些是合法统一diff内容，`git apply --check`通过。添加仅作用于本证据文件的 `.gitattributes` whitespace例外，保留原patch字节，源码/正文仍执行正常diff检查。
