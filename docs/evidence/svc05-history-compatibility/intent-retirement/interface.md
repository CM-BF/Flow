# 精确旧 intent 退役 Interface（实施准备）

GO 经 Lead 于本工作段明确批准 a7d 提案 1–5 的这一次语义：不是原 claim ACK，不重放 claim、不换 key/namespace。实际个人操作仍须固定源码独审、完整输入与 Lead 串行窗口；当前仅实现和临时目录检查。

Module 只负责在确认屏障内将精确 v1 journal 的 `inFlight` 变为 null。维护、DB 权威与 owned process 身份继续由既有模块持有。普通 `runnerFiles`/idle 判断不改。

`retireIntent(request, ports)`：request 绑定 source af51、root/runner/namespace/journal 的身份、原 SHA、runnerId、维护 operationId/version、一次 retirementId。唯一 confirmation port `withFence(request, use)` 在私有操作锁与同 runner DB 行锁内调用 use；每次 `confirm()` 从固定源码/完整 DB 零未完与 uncertain、旧 runner 整组已停止/本安装唯一 writer、pending outbox/final 未决数量重新得出事实。测试 Adapter 只注入这些确认与故障；不称它们为真实 PG 证明。

| 步骤 | 成功后的持久状态 | 失败行为 |
| --- | --- | --- |
| 参数/源/屏障/身份/schema 核对 | journal 原样 | 拒绝，无退役 |
| 独占私有操作目录 | 0600 原件备份，file fsync + parent dirsync | unknown，保留现场 |
| 写持久意图 | 含旧/固定新 hash、operation/guard 摘要；不含原 UUID/正文的公开输出 | unknown，不写 journal |
| 写固定新字节并 sync，再次确认屏障和原文件身份/hash | 原件和候选都可核 | unknown，不自动清 stage |
| 同目录 atomic rename + dirsync | 只此 journal 从非空 inFlight 变 null，assignments 仍 [] | unknown，不 rollback |
| 写最终审计并同步 | retired | 审计未知仍 unknown；只读比较当前字节=原/固定新/other 可定位，不据此自动重写或称 ACK |

重复 retirementId 因独占目录已存在而拒绝，不自动重执行。历史文件、namespace 与全部原 raw 不改；新私有目录是明确允许的审计增量。外层沿既有 supervise 截止，drain 起 15 分钟仍约束实际窗口；核心不声称 fsync 可硬中止。

局部验证：新临时根、合成 UUID/确认端口；≤10s、tmp/raw 合计保守≤1MiB、fresh≥1GiB+8MiB，0PG/服务/PTY/provider。覆盖成功保历史、备份/意图/最后审计故障、源/hold/stop/pending 拒绝、hash/namespace/inode 漂移、重复不写、读后判定不修改。真实 Adapter 的 PG/进程端口本轮仅源码核验；原锁序 tests 不重跑也不冒充本次证据。

`host-fence.mjs` 只接受固定安装/root/runner/af51；复用 withPreviewLock、assertPreviewMarker、inspectOwnedProcess。它只核已有 hold，不自行 drain/stop/resume：这些步骤仍走既有维护/进程入口并保存独立意图。持有 runner 行锁期间两次确认全部未完/uncertain/非终态任务为零，完整 runner 树只准已保存的四个历史 result hash 与精确 journal，其余 pending/unknown 一律拒绝。ps 只核固定部署方式的已知 runner 入口、输出不落盘，不宣称可发现恶意隐藏进程。实际操作 request 只能取固定模板的原身份/hash和四历史；新现场只校验，不能重基准；operationId只取新definite hold回执，当前没有可执行个人 request/permit。

`operator.mjs --retire-once <0600 request> <sha256> <existing evidence dir>` 是未来唯一入口，先 exclusive durable reservation，再调用上述 Module；外层沿 center-recovery/supervise.py。此文件的准备不会运行它。scope 没有扩大到产品工具、普通 idle gate 或新恢复产品。

选用本地 find-skills / codebase-design / clean-code；无新增依赖或通用恢复框架。将不可逆写限制在小 Module，确认端口与文件提交分离，生命周期和 unknown 显式返回。既有明确设计和 GO 边界作为 brainstorming 输入，不再重复设计审批。

固定执行输入见 [steps](steps.md)/[execution-inputs](execution-inputs.json)。只读文件绑定与mutation hold字段校验已分开；`boundIntent`不借虚构维护身份，`retireIntent`仍在调用任何确认port前拒绝missing hold。`observeHost`只是私有采样seam；原入口仍严格idle。逐phase比较保留原raw和ordinaryNativeChecks，唯一例外精确journal与单独审计。`window.py`复用原已审supervisor，每步都扣同一个持久drain时标；Python纯例验证过期不spawn和剩余8+2秒传递，无服务调用。
