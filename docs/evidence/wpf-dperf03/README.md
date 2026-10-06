# WPF-DPERF03 交付入口

固定实现 `5609ea719ec400a803bb6036429312b7a212c90f`，base `eb95fba43b0305db0dd40dfe85ccc0d58eb9a6ea`；5实现/专测，13只读依赖与base相同。独审NOT_STARTED，main未接。

- [Interface](interface.md) / [验证与原失败](validation.md) / [质量](quality.md)
- [来源manifest](candidate.json) / [真实执行checks](checks.json)
- [take](take-receipt.json) / [amend](amend-receipt.json) / [live v2](live-amend.json)
- [唯一status](../../../plans/wpf-dperf03/status.md) / [review](../../../plans/wpf-dperf03/review.md)

独立检查：Node24 PATH下运行 checks.json 中四个显式路径，stdout定向到reviewer自有/tmp文件；不设置FLOW_DPERF_EXPERIMENT即不会重跑实验。若另获有界复现预算，设置 FLOW_DPERF_EXPERIMENT=1、FLOW_DPERF_EVIDENCE_DIR=/tmp/<new-own-directory>，并加 --test-name-pattern='bounded temporary Git experiment'。必须unset FLOW_COORDINATION_DATABASE_URL/FLOW_COORDINATION_REPO，不能写作者报告。实验只临时Git/noHTTP/PG/provider；无新预览服务。
