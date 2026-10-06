# WPF-MATURE-02 已审片段集成收据

记录2026-10-06 10:20:00 UTC；owner chatui01_owner/gpt-6-astra，co-lead Mika。当前权威状态见[status](../../../plans/wpf-mature-02-harness-capabilities/status.md)，本文件只交付固定审查输入，不复制main进度。fresh ledger确认claim0dd97484-f0ce-4738-8075-505bd5e2541a v2 ACTIVE，HEAD0ddb2a4ffb8e434af7ec2dc1902ee6b413a48ec3 clean后更新metadata。

| 可独立接收片段 | 已审target与证据 | 范围限制 |
| --- | --- | --- |
| R06默认关闭的private stderr sink | `0778847702e595405f6cba0de51c1058b1436504`，Mika/Astra独审APPROVED；[19项零真实child检查](diagnostics/unit-final-result.json)、[原strict](diagnostics/typecheck-final-result.json)、[后继同树C1 strict](diagnostics/c1-typecheck-result.json) | 仅下表五文件。默认时序/report不变；trusted host opt-in、64KiB上限、throw/thenable/重入/首次stop deadline/drain语义覆盖。未重跑31-child suite，不提供真实Codex配置/provider可用证明。 |
| 生产投影的实验薄入口 | `38516be71bf267ab546347a39da2adbe71f79e20`，Mika/Astra 09:47:22 UTC APPROVED；[27项直接消费者/manifest](production-import/README.md) | 同树单一相对re-export，生产projection6313已由4391/main f181输入提供；没有长期算法副本。AssertionError安全归一仍为生产host责任。 |
| 一次诊断结果 | `d35c59682133d77d8581f3c3bce89a4ab3416b26`，Mika/Astra 10:17 UTC APPROVED；[report](diagnostics/run-report.md) | 仅事实可信：2factory/282.794417ms/全部自有资源清理。canary仍FAILED/SIGABRT/0 parent stderr/原因unknown，第三NOT_RUN；不解锁真实catalog/provider，不恢复预算。 |

R06五源在本记录安全点逐字等于077固定Git；字节与SHA如下，未重测：

| 路径 | bytes | SHA256 |
| --- | --- | --- |
| `apps/runner/src/codex/types.ts` | 3203 | `5b79487a410574442183cbb2a63c6dc61ceb415ffbdbb2dd3aa99b8781df5828` |
| `apps/runner/src/codex/options.ts` | 3850 | `b5bc2bfab727426f526430aa1d250f65ccb8e99e0ce31b5ad7fa98cc15e97843` |
| `apps/runner/src/codex/index.ts` | 14128 | `f189cc8c9cd56f707448aa95e4753331afb80019d11929d052007ca9686d8fdc` |
| `apps/runner/src/codex/stderr-capture.ts` | 1770 | `79382143721b968170c8e29297f1ee2640bbd5ea647382f64059c31d3daeba31` |
| `apps/runner/src/codex/stderr-capture.test.ts` | 10273 | `b3dae983e3486ae08c359b7560e01894fc742f64eff5891df6e73f0c9471a575` |

实验final.mjs当前201bytes/SHA256 `ab4a565bb56dd8e6f47e425fad86ed8bb464dd4ab142e7218e3772db766efa05`，逐字等于38516be。共享基线已受控合入 `f181d84b5fb3652d62e2a181acff442d42b3e066`，C1固定7127直接消费者只编译未运行。集成时精确接收已审路径/提交，不把旧driver、未审provider接线或后继目录候选一并视为批准；writer claim保留，需Lead明确停写/部分交回再amend，不能直接抢占。

本次使用既有本地find-skills方法匹配TypeScript合同/SQL reader/接口设计，采用codebase-design的小Interface与单一状态权威、clean-code命名/职责/安全错误检查。clean-code来源固定sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5；无安装、无测试、无新child。能力目录只是后继设计，不是本收据接收范围。

当前main只读参照更新为41315b033deb0b1953484359b686c0b228997367；已比五路径仍与0778847不同，optional privateStderr尚未main。R05D四源集成不覆盖本seam。catalog/启动假设见唯一interface，仅待实施设计。10:22 UTC architecture_read补充APPROVED诊断faithful FAIL evidence，无P1/P2，不改变canary FAILED。


## 原生配置目录独立接收（2026-10-06 10:37:43 UTC）

固定生产target `c9c6e891003af2fc52ca77b0c4527d6d85e20e22`，status_read/gpt-6-astra于10:35:37 UTC独审APPROVED，Mika复核接收，0P1/P2。[目录manifest](native-catalog/manifest.json)42项逐字匹配；33 distinct分次行为证据与strict0，不是一次33/33、review未重跑。精确路径：packages/contracts/src/execution-profiles.ts及.test.ts，apps/server/src/execution-profiles/store.ts、index.ts、native-catalog.test.ts。生产合同/reader/routes可独立接收；client未接线，configured/not-probed不代表真实Codex/普通会话可用。非阻断test-only CREATE ACK清理修复另[delta](native-catalog/ack-cleanup/README.md)，不重写原target证据；Lead将共享接缝收窄为store.ts单路径：已停写并v4 amend移除，见[COMMITTED部分交回回执](catalog-store-partial-handback.json)。其余四目录路径、R06五源和本task证据继续保留，不代写ENG01B publication新文件。


P3 test-only delta a761941fce5b2b6dd12d8c974c6d2c7e51894628于2026-10-06 10:39:53 UTC由status_read/gpt-6-astra独审APPROVED；manifest2968c67361df3679b01b86c6d8b7b3848e11186414e58b8577130881efa0fb0d全部14项匹配、4不变输入=c9，1定向/strict0可信，未重跑原33。生产target仍c9；store.ts交回v4已完成，其余scope仍保留。
