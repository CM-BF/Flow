# WPF-WORKSPACEPERF01 交付入口

固定真实 App 的有界生命周期基线，**结果 partial，不是性能达标或优化交付**。实现 `1711e2b0933ec28b8bbd9af11cba4243b644e0d7`，基线 `c450c2da7e6185b88db9f46e0299ee504ee6f3e8`；只有两个新增测试脚本，生产代码与协议没有改变。

- [结果与限制](validation.md)：8 项行为检查有证据，末尾截图/theme 步骤未完成。
- [实际原始报告](2026-10-06T11-02-23.650Z-report.json)、[预算](2026-10-06T11-02-23.650Z-budget.json)、[逐段 checkpoint](2026-10-06T11-02-23.650Z-checkpoint.json)、[固定源码与 180 只读依赖绑定](checks.json)。
- [下一回收边界建议](interface.md)、[技能/清码/失败历史](quality.md)、[正式 status](../../../plans/wpf-workspace-lifecycle-baseline/status.md)。

两个源：[HTTP 观测 fixture](../../../apps/web/test/workspace-lifecycle.fixture.ts)、[实际 App 浏览器 runner](../../../apps/web/test/workspace-lifecycle.browser.ts)。复用现有动态 HTTP/Vite fixture，不常驻预览；本实验 own browser/server 已清理，其他服务保持。

复现入口（需要单独分配新实验预算，不属于本次已执行证据）：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH FLOW_LIFECYCLE_BUDGET_MS=45000 pnpm exec tsx apps/web/test/workspace-lifecycle.browser.ts
```

脚本保留已知末尾 locator 限制：从 Work overview 点 Chats 会同时收起已开的侧栏，最后 `open(3)` 因导航不可见超时。未删失败断言，也没有为绿色结果追加第三轮；复跑前应另在有预算的任务内修正该测试导航步骤。现目标只能作为有明确未覆盖项的基线审查，不能称全绿 runner。

类型验证只覆盖两个新入口及直接依赖；全 Web 原有 release fixture 两处 `string | undefined` 错误仍在。没有 browser screenshots、native page-hidden、可靠交互延迟或 heap 结论；没有模型、真实中心、数据库或个人服务操作。

Root已于2026-10-06 11:07:36 UTC限定批准固定1711 partial基线；[独立审查](../../../plans/wpf-workspace-lifecycle-baseline/review.md)。作者browser仍partial，审查不使截图/未测项目完成，主线已于固定362af3bac77541e5a60979326bcf4d4b8c947915受控接收，见[来源观察](main-observation.json)；原partial结论不变。
