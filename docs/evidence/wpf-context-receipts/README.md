# 知识引用接收回执交付候选

实现 `5e8213a564bd76e58feddb0c6470faa74bae1d66`，基线 `fc113945ff73d1a43092d0a70b51e901aa4be1e2`；分支 codex/web-context-receipts。范围为三个生产文件及三个测试；[六源 hash 与来源](source-manifest.json)。root 于 2026-10-06 08:19:33 UTC 独立 APPROVED 此 target；main 未集成。

改变：outbox 和 QueueCommand 将引用解析后深冻结；Queue 的受理成功必须匹配完整有序来源与合法 metadata。失败保留 unknown / 原 key / 原请求；下次编辑不改旧引用。Send 仅有可复用 guard，实际 projection 未接。

## 验证

| 检查 | 实际结果/出处 |
| --- | --- |
| 实施前红测 | 原 outbox/queue 加回归后 10 failed / 28 passed，293ms；[原始日志](red-tests.log) |
| 初次绿测 | 46/46，323ms；清码/transport testcase 前中间结果 [日志](module-tests.log) |
| 最终局部与直接依赖 | 142/142，569ms：receipt8/outbox14/queue25/selection18/projection77；[日志](direct-tests.log) |
| Web TypeScript | 最终 exit0；[日志](typecheck-final.log) |
| 依赖 | 本树 frozen-lockfile / ignore-scripts，3.3s；client/contracts 链回本树 packages；[日志](install.log) |
| root 独立审查 | 124/124（4 files，758ms）+ selection 18/18（413ms）；完整差异/6 hash/保护范围通过，无 blocking；[review](../../../plans/wpf-context-receipts/review.md) |
| 源码差异检查 | 固定六源 diff --check exit0，App/Thread/projections/plugins/packages/manifest/lock 零差异 |

最终检查在提交前运行；随后六源 bytes 与固定 target/manifest 全相同。142 并非全库测试；没有 browser/build/截图（本片不改变 UI）、真实中心、模型或数据库。transport case 使用真实 FlowClient 配合内存 fetch Response，验证 JSON 及 Idempotency-Key，不是实际 HTTP 服务器联调。新服务/本地 URL：无。

最小重现：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm --filter @flow/web exec vitest run test/conversation-context-receipts.test.ts test/conversation-outbox.test.ts test/conversation-queue.test.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm --filter @flow/web typecheck
```

[接口与未实施事项](interface.md) / [技能与 clean-code](quality.md) / [status](../../../plans/wpf-context-receipts/status.md) / [review](../../../plans/wpf-context-receipts/review.md)。原始工具日志保持不清洗；完整 evidence diff 中的日志空白不冒称为六源检查结果。

完整 metadata diffcheck 的原始日志例外：red-tests.log 六处尾空格（50/53/69/72/88/91），direct-tests/module-tests/typecheck-final/typecheck 四处 EOF 空行；六源检查仍 exit0。原日志不清洗。
