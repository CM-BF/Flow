# ATTACH01 phase1 handoff

固定合同实现 `6bc2918cf35a652e241e6378c3b6297cac179adb`，base `f181d84b5fb3652d62e2a181acff442d42b3e066`，branch `codex/attachment-resources`。独审状态见[review](../../../plans/wpf-attach01-resources/review.md)，phase1已获root独审APPROVED，main接收未发生。

入口：[Interface](interface.md)、[验证](validation.md)、[质量](quality.md)、[final hashes](resource-checks.json)、[claim](take-receipt.json)。本片无UI预览/截图，因为只交typed合同和pure校验。

复验（本worktree，Node24 PATH）：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run packages/contracts/src/attachments.test.ts apps/web/test/conversation-context-receipts.test.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsc --noEmit
```

旧请求无attachments或[]只生成v1；仅非空attachments生成v2。新→旧plain请求省略字段。旧Web能看正文但不能展示附件。schema/digest helper不授权限/ready；运行域需独立exact amend。F01只协调index/client/mount；026已预留、conversations.ts移出但本claim未拥有，均未修改。0真实中心/PG/provider；旧所有服务保留。
