# WPF-DPERF05 evidence

[唯一状态](../../../plans/wpf-dperf05-status-timestamps/status.md)。当前 source-only，产品检查与独审均未运行。take receipt 与 approved-design 原样保存；claim-observation 仅合法协调账本窄结果，不含连接凭据。

固定两源与只读依赖见 [candidate](candidate.json)，语义见 [interface](interface.md)，实际静态检查见 [当前修复静态检查](repair-source-checks.json)（原56见 [source-only-checks](source-only-checks.json)）。产品 test 与独立review均 NOT_RUN/NOT_STARTED，运行计划不等于 gate。

676b 首次源审有 R1/P2；原 [candidate](candidate-676b.json) 保留，当前 candidate.json 指向修复待复审。任何静态计数均非测试通过。

当前实际结果：[validation](validation.md) 与 [direct-first](direct-first/archive-manifest.json)：c8d/7311唯一62/62 PASS，root源审已限定通过，direct证据独审/main/部署另记。前述NOT_RUN是原source-only历史，不能用本次结果倒填旧676。

最终本片 source+62 runtime [root限定批准](root-62-runtime-review.json)，0blocking；等待 main 受控接收，聚合消费端与部署仍待 Lead。
