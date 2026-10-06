# S01P02 main.ts 部分交回

2026-10-06 09:56:14 UTC：更新前HEAD `4585a12561d2bfae307a5c952560eb6fdad194e5` clean。architecture_read已先向Mika明确停止`apps/runner/src/main.ts`写入，随后当前v1原子amend只移除此literal；[COMMITTED receipt](main-partial-handback-receipt.json)为claim `d2c55153-7116-403d-a7db-44b10e943241` v2 ACTIVE，提交时间2026-10-06T09:56:07.746Z。其余3个source文件与plans/evidence共5scope保留；未release整claim，不会恢复main.ts写权。

已审target `c77fbc4e12b0ffc0ee40f597bd99c82d9b37edc7`，Mika / gpt-6-astra于09:50:43 UTC APPROVED，无P1/P2。[唯一integration-ready receipt](integration-ready.json)保持原样记录批准时事实；原64/64（42 parser+22 main）和root严格局部noEmit0有效，本次0源码变更/0工程重测。4源码target Git=当前WT=原manifest：

| 源码 | SHA256 |
| --- | --- |
| apps/runner/src/main.ts | `b6461ea0edebe5ca7fb52ebbc0c62b678aeea891b00cf69b78a1636900c95ba8` |
| apps/runner/src/concurrency-configuration.ts | `9fb5a2d2550c286fdc3231105436f109e26546bca260b86717622a5a5158e4b3` |
| apps/runner/src/concurrency-configuration.test.ts | `157b85699274472e083b801ccf273ed7acde4512b04bcf4712b642b2ae798e97` |
| apps/runner/src/main-concurrency.test.ts | `196b18ea53527862ad6a7865c89ea18d821143b237f5e21eee529731695b2d6e` |

main观察仍为`187d97648dd2d4edf45641720f8ba771ea9f25fa` clean；交回不是集成，也不是部署/真实并发验证。新R05D native_center_owner必须take成功，且取得Lead明确包含双方已审改动的base后才开写；Lead集成须保留并发参数语义，不覆旧main blob。本owner只在剩余scope维护[唯一status](../../../plans/s01-concurrency-entry/status.md)。04仍独立WT与v3，未受本路径转交影响。
