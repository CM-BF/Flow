# REQ15 定向验证

实现产品6源与静态独审target3cd7a6e867bd84ca877e07ea4e6e97f70d685e32一致；新验证/fixture target `d209eb7275777d50f214fd73f66d6b3c1520c459` 只将测试替身一处可空row改为显式guard，没有改产品或断言。完整[source manifest](validation-source-manifest.json)与[输出manifest](validation-output-manifest.json)绑定精确字节。当前结果/一行fixture修复待独立复核，main未集成。

| 检查 | 实际范围/结果 | wall与raw |
| --- | --- | --- |
| 首红 | 两路径26selected，17fail/9pass，exit1；旧接口/查询上界 | 0.824651s /10455B，历史原件保留 |
| green | 两路径26selected/26pass，exit0；source3cd7a6e8与原test版本 | 0.853281s /3765B，SHA f785394cb4a0c8b69a5a71c322633e2884422c33dab5d9b51470540c08dcf55e |
| strict首次 | focused tsconfig，exit2；测试替身第72行TS18048 | 1.444400s /108B，首错保留 |
| strict-v2 | 同focused tsconfig，显式row guard后exit0 | 1.602574s /0B |

绿测后仅修测试旧detail查询分支的 `row?.detail_id === values[0] && row.attempt_id ...` 为 `row && row.detail_id ...`，让编译器排除缺失对象；没有删断言/跳失败，未重复26已绿组。六个产品文件与3cd固定字节一致。`strict-v2`来源hash区分修后测试，未将绿测冒称在新fixture字节上重跑。

每次Node24固定显式入口、Vitest4.0.18/no-cache、30s监督/raw64KiB；三次fresh free分别1150427136/1149239296/1148248064B，均过1107296256B原门槛。PID/PGID84938、90820、14230均记录absent、EOF完整、0signals/secondary，TMP前后空0B、同inode删除。32MiB为前后采样预算，非实时隔离。0PG/HTTP/provider/native；轻机会已交回，0待launch。

覆盖mixed50同序/≤9调用、limit+1/crossconversation/空页、conversation/task404、current attempt/owner/session、typed invalid与缺失/legacy/歧义/pending、冻结settings/observed/context、全文digest字段及UTF16/surrogate边界、未知错误传播。查询预算是fake调用证据，原214并非实际PG测量。mock部分expected复用新单轮路径，不替代真实SQL。

仍待REQ15-04真实PG：相同prefix但suffix损坏的全文UTF8 hash、每task LIMIT2混合、错attempt-owner-session、RR并发snapshot及真实roundtrip/UTF8字节测量；HTTP直接消费者/main集成另在实际集成点验证。legacy仍传全body做JS hash，不能宣称全部传输有界或消除TOAST/hash。

2026-10-06 21:44:23 UTC clean-code安全复核：只修测试可空对象访问，保持既有Interface、error身份与断言；保留红/strict首错，结果与静态source approval分开。无新依赖、无scope扩张。

## 真实PG结果（当前）

2026-10-07T03:07:00.012295Z至03:07:01.041357Z在独立专库一次执行，target `b00a181f38c261d33651368d82a040db3ab0bb18`，[原始输出manifest](pg-output-manifest.json)固定5原件10612B。2selected/2passed/exit0，wrapper wall1.150494s（解释器启动/末次持久化不含），stdout584B完整，监督group absent/EOF与fixture清理CONFIRMED分别记录。此前“仍待真实PG”为历史；现真实配对、每task LIMIT2、错attempt-owner-session、同prefix坏suffix全文digest、Unicode、51st不提前投影与RR并发均有用例通过。HTTP直接消费者/main仍未验。

| 当前样本 | queryCalls / ReadyForQuery | UTF8 DataRow字段 | 页面JSON UTF8 |
| --- | --- | --- | --- |
| mixed-first-50 | 8 / 8（含BEGIN/COMMIT） | 115722B：typed prefix68123 / legacy full133 /其他47466 | 96098B |
| last-poisoned-turn | 7 / 7 | 5424B | 1036B |
| empty-page | 4 / 4 | 152B | 277B |
| foreign-conversation | 7 / 7 | 1356B | 1808B |
| snapshot-before-writer | 7 / 7 | 1358B | 1810B |
| snapshot-after-writer | 7 / 7 | 1378B | 1830B |

这是一个固定fixture、专属subject串行await的测量，正常query与ReadyForQuery对应；不是整个协议、TLS或socket传输字节，也没有旧实现同期性能基线，不声称吞吐增益。typed全文UTF8 hash仍在PG执行，legacy仍传完整body。实际writer COMMIT ACK在subject读屏障后已确认，原RR保持旧pair，新事务读新pair。清理为三池关闭ACK、精确OID/marker/owner核对、零连接普通DROP及absence；独审不会再连DB。

2026-10-07T03:08:27Z chatui01_owner固定b00a181f结果独审APPROVED/0 P1/P2，限上述两例真实PG/已观察资源与测量忠实性；未重跑检查，HTTP/main仍开放。

## 公开HTTP直接消费者实际结果

2026-10-07 04:02:17 UTC，target `6725dd4b06f4a7aa2d16a28e567bfa7e2dddb8f6`。一次原入口，1selected/1passed/exit0；25HTTP，原Unicode/惰性owned详情/404/分页空与超界/不可变user断言及page401/403通过。raw427B完整，PID/PGID27708 exit0/组absent/合并EOF/无signal或secondary；fixture专库与port/池收尾CONFIRMED，精确TMP absent。7原件6745B与完整hash见[http-output-manifest](http-output-manifest.json)，[外部时间记录](http-outer.json)分列wrapper3.012804s、time3.05s和秒级UTC；并发local预算0。仅fixed-main7b6组合单例，不冒称最新main全集/部署；旧26/PG2/11及local types/collect未重跑。结果独审PENDING。
