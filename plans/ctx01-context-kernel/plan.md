# CTX01 固定上下文core实验

编号CTX01；状态in-progress；创建/更新2026-10-06 04:42:05 UTC。Owner runner_owner / gpt-6-astra，唯一树context-kernel-probe，branch codex/context-kernel-probe，base75a33dec228e17bbbd0d3be9fd01bc9ac18a0133。

## 目标与接口

固定官方npm acp-kernel0.0.101及给定integrity，纯公开core API：createCore/processTurn/applyCompression/storeCoveredOriginals/retrieveByRef。手写summary，验证压缩后精确原文ref、完整state+contentStore序列化后独立进程恢复、host fork深拷贝隔离。state/contentStore必须成对保存，唯一compression owner仍是host职责。未知schema/旧revision拒绝是实验host门禁，不声称生产PG CAS或core自带版本检查。

1/10/100 sessions各20有效短重复；统计每步批次wall time/CPU/RSS、p50/p95与N，输入/渲染/持久输出bytes及原文hash。整个run原文累计<=20MiB，单child<=10秒、整体<=180秒，失败保留不重试追漂亮数。默认语言中文emoji混合合成文本；summary固定手写不衡量语义质量，不调用模型/云、真实凭据或安装脚本。100sessions不是100运行agents，字节减少不是账单节省。

## TODO

- [x] CTX01-01：原子claim、固定npm/完整性/许可/实际API与方法。
- [x] CTX01-02：最小host封套、公开core行为与真实子进程restart/fork。
- [x] CTX01-03：1/10/100各20次有界原始测量、失败/限制与可重跑说明。
- [ ] CTX01-04：固定实现/证据交付独立review（NOT_STARTED），后续生产接入不在此片段。

独立scope仅experiments/context-kernel、plans/ctx01-context-kernel、docs/evidence/ctx01。Pi/proxy/self-update、产品deps/入口/PG/实际模型均不改。候选已定位不是用户身份确认；本core toy已授权可推进。采用本地find-skills/codebase-design/clean-code/tdd；公开core和host封套是已授权验收seam。方法/证据见[证据](../../docs/evidence/ctx01/README.md)。

2026-10-06 04:45:12 UTC 3公开行为及60批次测量通过；原文总8,265,090 bytes/7.878秒，未运行模型。03有界报告已完成，04待独立review。
