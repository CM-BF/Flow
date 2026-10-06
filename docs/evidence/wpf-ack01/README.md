# WPF-ACK01：Web 复用公共会话回执

固定实现 **2fa8d2cb3b6f5cbb39f6d3d5b784551d7b27867d**，base **0cee7556befa1988e60bae94b510240122c34b88**（已含公共实现 dc7f3e186ee7a628187f82734db73f48866b9f6e）。仅三个生产文件与两个局部测试；无UI变化、无新协议、无依赖变更。root 于2026-10-06 10:52:00 UTC独立APPROVED，另行一次150/150检查与五source审计通过（[review](../../../plans/wpf-ack01-shared-consumer/review.md)）。

## 最终职责与取舍

- `ConversationProjection.dispatch` 对create/turn receipt调用 @flow/client 的公共decoder，移除本地POST shape/文本/revision/context验证。即使注入非HTTP typed port也经过同一规则；真实FlowClient已验证，此处再次调用**相同纯函数**以保窄port消费不变量，没有第二实现或新缓存。
- `assertCreationReceiptMatches` / `assertContextReceiptMatches` 保留原Web导出，全部身份/格式规则委托shared matcher；仅保留原有用户诊断消息并用 `Error.cause` 关联原错误。GET/Queue调用方与既有错误反馈不需迁移。冻结selection / freezeKnowledgeRequest未修改。
- Web仍持有请求outbox/原key/body、everUnknown、既有creation/profile/project锁、已知turn/task冲突、cap显示、GET/history验证、read sequence与分页/详情生命周期。公共ACK确认受理，不覆盖更新的GET执行事实；403后既有unknown仍unknown，首次409不会改revision自动重发。
- templateVersion当前仅v1；附加未知字段兼容不等未知版本兼容，v2故意拒绝直到共享decoder受控扩展。未来附件消费者不能在这里另写一套v2规则。

## 实际检查

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| projection/profile/context receipt/queue 4文件 | 137 PASS；10:48:16 UTC，390ms总 | [direct-first.log](direct-first.log) |
| 真实HTTP+publicFlowClient+Webprojection | 13 PASS；10:49:46 UTC，429ms总 | [http-final.log](http-final.log) |
| Web类型检查 | exit0 | [typecheck-final.log](typecheck-final.log) |
| 固定来源/protected/source diff | 5hash与target一致，保护范围0diff，source diffcheck0 | [source-manifest.json](source-manifest.json) |

共150个测试，分两次实际命令，非同一次全套；没有重复跑浏览器/共享全库。先前HTTP12通过后，清码时修正fixture的首次4xx不提交语义并补迟到关闭检查，再跑最终13；[http-first.log](http-first.log)保留原结果。原始日志不清洗。类型首轮/最终均通过，日志区分。

从本worktree根运行：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm --filter @flow/web exec vitest run test/conversation-projection.test.ts test/execution-profiles.test.ts test/conversation-context-receipts.test.ts test/conversation-queue.test.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm --filter @flow/web exec vitest run test/conversation-ack-http.test.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm --filter @flow/web typecheck
```

HTTP检查使用动态loopback端口、内存命令回执、公开fixture身份。单fixture请求64KiB/100次上限，afterEach中dispose投影、关闭连接/server；不用真实中心/产品数据库/SDK/provider。断言来自实际HTTP发出的body/key和publicprojection状态，不以直接调用decoder替代consumer。已有四文件检查覆盖零正文预取、同revision最终内容、历史分页、配置锁/Queue/旧ACK优先级；新增13覆盖坏200JSON/shape/project/text/task/context/version、原key/body恢复、外部mutation不改冻结refs、未知后403、首409、跨关闭连接迟到隔离。新增非HTTPport3case证明revision/tasktimestamp/effectivesource也经过共享规则。

## 界限与交接

这片不提供新的本地页面URL/截图，不改变任何渲染。未新增真实provider/PG/浏览器矩阵；复用已有受审UI。共享输入固定，不升级runtime。完整client decoder规则由原owner维护；Web保持v1历史/queue，附件v2继续单点共享扩展。main尚未接本片，独审已通过、由Lead集成；当前实现五source冻结。

[plan](../../../plans/wpf-ack01-shared-consumer/plan.md) · [status](../../../plans/wpf-ack01-shared-consumer/status.md) · [review](../../../plans/wpf-ack01-shared-consumer/review.md) · [质量记录](quality.md)

主线交付：`e4c82ccb1655612fb175c26fe472dce736f848ed` 已接收固定五源码，owner已核逐字相同，见[主线记录](main-source-observation.json)和[Lead原receipt](main-lead-receipt.json)。本片已交付，源码不重测。
