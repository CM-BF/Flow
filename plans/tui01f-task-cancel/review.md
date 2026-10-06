# 当前 TUI01F-03 源码预检

Review target commit: da673b81c4390c2e811d1582d68a9899180d55d2

NOT_STARTED。3文件fixture/journey/PTY driver，仅源码准备；独立预检不替代HTTP/PG/PTY运行。请核中心受理后丢ACK、原key恢复/第二client身份、组停止/未知保留、checkpoint先于不可恢复清理与后继callback取消。固定manifest见[绑定](../../docs/evidence/tui01f/journey-source-manifest.json)，运行状态全部NOT_RUN。原9源已审已main，以下历史批准不扩大到本次新文件。

# TUI01F review 当前绑定

Historical approved target: a1f82f36a5e63f859ecdcdbd1da3575724e82101

APPROVED（限定 controller+Ink静态接线片），target `a1f82f36a5e63f859ecdcdbd1da3575724e82101`。reviewer native_center_owner，完整TUI验收不在范围。

[正式回执](../../docs/evidence/tui01f/independent-incremental-review.json) / [bindings](../../docs/evidence/tui01f/independent-incremental-bindings.json) / [main与边界](../../docs/evidence/tui01f/approval.md)。

以下为批准前历史过程：SOURCE_PRECHECK（当时非完整 APPROVED）。native_center_owner 独立源码预检绑定 `044ab84db42606fb1757903258078e3dfbab9545`，NO_P1_P2_FOUND，原回执和 38 条 bindings 已归档。执行前复核 9 源/21 inputs/8 evidence 均一致，reviewer 0 tests/provider。

后继作者已实际执行 35+1 分轮 / focused noEmit0，新增一条真实 TurnObservation mock-port 聚焦旧轮次 test-only delta，产品逻辑未改。该段形成时独立 reviewer 尚未复核增量；现已完成上述限定批准。真实 HTTP/PG/PTY/App 不因局部通过成为已验证。

- [原始预检](../../docs/evidence/tui01f/independent-source-precheck.json)
- [原始 bindings](../../docs/evidence/tui01f/independent-source-bindings.json)
- [本轮固定 manifest](../../docs/evidence/tui01f/validation-manifest.json)
- [分轮/资源/范围](../../docs/evidence/tui01f/validation.md)

历史首次未审模板/候选记录：

# TUI01F 独立 review

NOT_STARTED。候选 target 044ab84db42606fb1757903258078e3dfbab9545；base a89f42ab57acb53657af6a2d1b745dabd4d50aa5。scope 以 status / claim 为准。

Historical source-only candidate: 044ab84db42606fb1757903258078e3dfbab9545

[固定源 manifest](../../docs/evidence/tui01f/source-manifest.json)：9 source / 21 direct inputs / 8 evidence；所有运行与类型检查 NOT_RUN，未取得独立批准。

审查者先核 owner、worktree/head/dirty、固定输入和技能，再只读检查 task ID 来自可见观察、单 intent 的原 body/key、ACK 校验、未知/拒绝/资源释放、旧 create/send/queue journal 兼容和 Ctrl-C 不取消。当前无执行许可时只给源码结论，不能把用例存在当通过。实际 PG/PTY/App 和 provider 边界分别记录；新问题交原 owner 修复。

Findings 未评估；结论未审查。0 本片运行检查，NOT_RUN。
