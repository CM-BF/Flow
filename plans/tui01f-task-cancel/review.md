# TUI01F review 当前绑定

Review target commit: a1f82f36a5e63f859ecdcdbd1da3575724e82101

SOURCE_PRECHECK（非完整 APPROVED）。native_center_owner 独立源码预检绑定 `044ab84db42606fb1757903258078e3dfbab9545`，NO_P1_P2_FOUND，原回执和 38 条 bindings 已归档。执行前复核 9 源/21 inputs/8 evidence 均一致，reviewer 0 tests/provider。

后继作者已实际执行 35+1 分轮 / focused noEmit0，新增一条真实 TurnObservation mock-port 聚焦旧轮次 test-only delta，产品逻辑未改。独立 reviewer 尚未复核这一增量/原始运行证据。真实 HTTP/PG/PTY/App 不因局部通过成为已验证。

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
