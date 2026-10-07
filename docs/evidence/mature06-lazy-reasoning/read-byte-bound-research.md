# 选择性流读取的静态字节界限

结论时间：2026-10-07 09:17 UTC。只读源码基线为 main `9b27005f086c97c13b789020f5f8449d1552bb50`；未运行产品、测试、网络、PG 或分析脚本，未修改源码。此结论不是堆内存/网络测量，也不替代 Web 消费者接线。独立只读段的完整外部壁钟未记录，不声称严格完成于五分钟以内。

## 可证明的正文界限

| 读取 | 合法正文的 UTF-8 字节 | 默认 JSON 转义后，单独正文字符串的字节上界 |
| --- | ---: | ---: |
| 默认 text patch 页 | `8 × 8192 = 65536` | `6 × 65536 = 393216`，另加引号、键名、身份、摘要等 |
| 已展开 block 的增量页 | 同上；selection 在 SQL LIMIT 前过滤 | 同上 |
| 单 block 完整 GET | `1048576` | `6 × 1048576 = 6291456`，另加 reference 等 |

依据：`packages/contracts/src/assistant-stream.ts` 的 8192B patch / 1MiB attempt 常量、严格 Unicode/text schema；`apps/server/src/assistant-stream/index.ts` 的 patch 默认及最大 limit=8；`store.ts:36–39` 在写事务内限制 attempt 总正文 1MiB、256 blocks、4096 patches；`queries.ts` 先按 selection 过滤再 LIMIT+1，完整 GET 重算字节与摘要。metadata 默认20、最多100个 reference/页，没有正文；合法 attempt 最多256块。合法 report 路径有以上有限界限；migration 022 的 JSONB 自身没有等价 JSON 长度 CHECK，不能把任意数据库篡改也包含进保证。

六倍来自合法非 NUL 控制字符（例如 U+0001）的 JSON `\u0001` 表示。1MiB 这种内容可由128个8192B patch 组成，仍小于4096 patch 上限，分批 report 可满足 eventBatch 的2MiB限制。因此合法 full GET 可产生约6MiB的 JSON 正文表示，而解码后的正文仍是1MiB。这不是实测典型内容，但确为合同允许的反例。最大 patch 页的正文表示已等于384KiB，加上 envelope 后必然超过 P02 的384KiB material-page限额，不能直接借那个常量。

上述数值是正文分量，不是完整响应精确最大值。完整响应还包括受限 ID（idSchema 最多128 UTF-16单元）、digest、有限枚举、数字、时间戳和 settlement；本段未逐字段导出一个完整 serializer 上界，完整 JSON 响应精确上限记 UNKNOWN。TCP/TLS/压缩后的 wire 字节也为 UNKNOWN。

## 内存与职责

`packages/client/src/index.ts:131–166,745–755` 的流请求沿唯一认证 transport，成功响应先 `response.json()` 再校验；错误响应也读 JSON。当前没有流专用的读取字节门禁，15秒超时不是字节上限。可信合法 center 的正文有限；错误 body、异常代理或不合约 endpoint 的解码输入没有由此客户端证明的字节界限。

`packages/interaction/src/stream/projection.ts:213–219` 的3MiB是 text/已展开 selection 的 content、text 与 canonical final 的 UTF-8逻辑驻留账，不包含 JSON输入缓冲、metadata、收据、临时字符串、hash副本或 GC。每 selection 一个 flight、最多8个 selection 限制并发；它仍不能充当解析前字节门禁。合法6MiB转义输入说明瞬时 JSON 输入可大于3MiB，不能据此声称 projection 越界。JS heap/RSS峰值取决于表示、复制和GC，本段 UNKNOWN。

## 一个最小后继建议

值得将现有 `packages/client/src/native-activity-body.ts:128–152` 的取消感知、计数后再解码的读取部分提为小型内部 `readBoundedJson(response, maxBytes, signal)` Module；把 material 的384KiB规则留在其领域调用者，流调用者采用从实际 envelope 推导的独立上限，并覆盖错误响应。现在已有两个真实领域需要同一机制，职责分离有依据；不新建客户端、transport、调度器或权限层。必须先补完整 envelope 上界，不能把正文分量直接当 cap。

该后继需要 X01 当前 `packages/client/src/index.ts` writer 协调，以及 native-activity-body leaf 的合法写权；LAZY不在本段编辑它们。保留现有 request/auth/FlowApiError/AbortSignal语义，由唯一 projection 继续负责身份、cursor和3MiB驻留。此建议只列队，不阻塞已 ready 的 Web 接线，不宣称性能收益。

质量复核：沿已固定本地 find-skills、codebase-design、clean-code 方法核 Module 职责、Interface资源语义与真实复用；未安装技能、未增加通用框架。发现的是 transport 解码与领域驻留的不同职责，当前合法中心正文并非无界。原实际 FAIL、离线4/4与后续精确TMP清理证据均不改写。
