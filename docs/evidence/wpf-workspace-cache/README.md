# Workspace cache handoff

固定实现 `4ec291c2381faa0fc212cf598b8126b9feecae71`，base `fd1322f9c0c1d085d5e343e39f6216b20d26c264`。分支 `codex/web-workspace-cache`；root独立review APPROVED（133独立检查、范围/证据审计），main已接收 `017adc276a888a218bed3ef9963bc4dabbc6cec2`（[逐文件观察](main-observation.json)）。只这14源/16领取范围，[manifest](candidate.json)、[验证与原失败](validation.md)、[Interface](interface.md)、[quality](quality.md)。

直接检查：
```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run apps/web/test/workspace-retention.test.ts apps/web/test/plugin-integration.test.ts apps/web/test/conversation-projection.test.ts apps/web/test/conversation-queue.test.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm --filter @flow/web typecheck
```

HTTP fixture入口 `apps/web/test/workspace-retention.fixture.ts` 的 `startRetentionFixture()` 返回动态URL、模拟centers、只读transport记录与close。无常驻新preview，全部实验自有服务已清理；旧服务没有操作。Browser runner `apps/web/test/workspace-retention.browser.ts` 默认完整矩阵，`--capacity-only` / `--presentation-only` / `--settlement-only`用于明确的定向复现。**本作者累计68.689/90秒已停止，不自动重跑**；新独立运行需另记预算和新证据归属。截图入口：[desktop](2026-10-06T11-46-47.041Z-desktop-light.png)、[light390](2026-10-06T11-46-47.041Z-narrow-light.png)、[dark390](2026-10-06T11-46-47.041Z-narrow-dark.png)。

实际UI：工具栏下 Retained chats 列出当前connection内open/closed-protected，并显示保留理由；满32拒绝新身份但可重开。无材料关闭即释放，晚到成功受理后也重核。显式草稿rekey沿原view.key，session.releaseView仅既有binding销毁，无新registry。正文消失可点击Read reply again / Read message again，关闭清读缓存，收据材料保留。

ATTACHI后继交权：App、session、conversation projection、queue projection及两projection tests是六交集，必须manager CAS移交后写。`session.getViewProtection(viewKey)`只观察已有binding；`releaseView(viewKey)`是最终释放。未来附件binding按stable view.key/session.id，普通rekey不dispose；pending capture/submission即使items移除仍保护。当前无附件App绑定，不能把纯policy测试当实际附件保护。不得复制第二attachment registry。

范围限制：32 conversation +reply2/2MiB+queue4/64KiB仅UTF8 body/总records，不代表heap、全history/feed/runtime。命令authority不变，不以dispose删除未dismiss材料。无provider/DB/个人服务验证。架构变化交管理图更新队列，不直接写架构图。

独立审批入口：[review](../../../plans/wpf-workspace-cache/review.md)、[133原日志](root-independent-tests.log)、[原样audit](root-independent-audit.json)。当前全部16scope停止写入，正式main接收已核；由manager fresh CAS释放/六交集转交，原树不恢复写。
