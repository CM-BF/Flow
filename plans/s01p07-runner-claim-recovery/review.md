# S01P07 独立审查

**原产品 SOURCE_REVIEW APPROVED；R2原8组PG 8/8 RESULT_FIDELITY_REVIEW_APPROVED。原4capacity准备独审通过/真实PG仍NOT_RUN，NOT_INTEGRATED。R1失败与旧未知资源保持。**

- Review target commit：83a0799293057f7472f0329c61e566708b2a2381（8 产品源限定）。
- Base：22a0806bc2465e11096949618113833f31766b19。
- chatui01_owner / gpt-6-astra，2026-10-06 20:48:19 UTC，0 P1/P2；只读，无测试或 PG。见[原回执](../../docs/evidence/s01p07/source-review-83a.json)。
- 核对 v1/v2 同 allocation/transaction/runner→task→attempt 锁序；compact receipt 原子性；unknown key 保留；journal assignment+nextkey 先于 adapter 与首次 heartbeat；正常 stop 迟到分配、expired、v1 unknown、restart 保守规则；严格 codec。
- 85 不同 non-PG 行为分批通过，focused strict 修后 0；三类历史失败保留。另3个纯 fake 检查只验证外层进程 EPERM/单次信号规则，不是 PG 业务检查。
- 原PG fixture/监督准备已获Mika 2026-10-06 20:53:17 UTC限定批准；R1实际在case结果前中止，中心8组仍无行为结果，main NOT_INTEGRATED。不得把源审范围外推为完整产品通过。

## Findings / 回应

进行中预核的当前 lease 整数兼容、旧 peer UUID 和私有资源所有权/primary 错误保留已修正并分别记源与检查。真实 PG 结果尚无，整体 review 仍待其证据；修复与复审按固定提交，不覆盖原 raw。

architecture_read / gpt-6-astra 于2026-10-07 02:56:25 UTC对R1固定结果 `16a938a465e49dfaf8a0b1ed1d4356bcc5eaa4b8` 给出 RESULT_FIDELITY_APPROVED / 0 P1/P2，仅批准忠实失败与资源边界，未批准PG行为。首错多因合并而无法归因；[诊断修复及回执范围](../../docs/evidence/s01p07/inventory-diagnostic-fix.md)只补有限首错事实，新4项定向fake已单次通过，原3项未重跑，待独审，不继承原wrapper测试通过结论。

chatui01_owner / gpt-6-astra 于2026-10-07T03:07:01Z对 `e3b9a3d5b354b75baaabac9da12a691bb5d54514` 给出 SOURCE/DIAGNOSTIC_RESULT_REVIEW_APPROVED / 0 P1/P2，关闭上段诊断待审。5 bindings/25660B核符，4/4原raw及262.528ms/空TMP同身份清理成立；首错setdefault/原异常与STOP/KEEP门槛保留。审者0import/检查/PG/写/旧根访问；R1原因仍UNKNOWN，不批准新PG。随后仅[有限输入绑定增量](../../docs/evidence/s01p07/pg-diagnostic-window-request.md)待其只读复审，无新行为检查或产品改动。

db_transaction_owner / gpt-6-astra，2026-10-07T03:12:57.210730Z，绑定 `0a753088f477932140b10b288e907243cb265c27`：SOURCE_INPUT_BINDING_REVIEW_APPROVED / 0 P1/P2。Mika在本次R2派工中转达原结论：63旧绑定、30SQL、24依赖、有限两名selector/实际inputSHA及原预算均符；关闭输入增量待审，不重审、不当PG通过。原manifest原字节不变。

R2 execution `44594beb1564732c00fb66721db2fd51b60b87e9`，2026-10-07T03:21:23Z–03:21:27Z：8selected/8pass/0skip，10task/80HTTP，专库零连接/同OID-marker普通DROP absent，worker/group/EOF/自有TMP全结束，无signals/retained/errors。原件见[固定结果清单](../../docs/evidence/s01p07/pg-run-r2-manifest.json)，11项12184B。这是owner事实记录，RESULT_REVIEW_PENDING；不会把8组代替原4capacity消费者或复算成旧85重跑，也不反推R1原因。当前仅封存，无新窗口/测试。

architecture_read / gpt-6-astra，2026-10-07T03:23:39Z，绑定结果cf762765cc04cf90244cfb0ac3ba9ee2da2ed585：RESULT_FIDELITY_REVIEW_APPROVED /0 P1/P2。11raw12184B+2inputs逐Git/WT/hash符；8/8、10task80HTTP、OID-marker/0连接DROP/workergroupEOF/两rootabsent核实；时间及sampled峰值与Web通知后置如实，0审者运行/PG/旧根访问/写。不归因R1、不替代4capacity。后继只改自有test/fixture适配与有限运行输入，真实4PG仍未跑，另独审。

2026-10-07T03:34:57.772871+00:00 四capacity后继：保持原4case body逐字相同；安全fixture复用/固定main数据库同module id donor/有限第三input分支已固定待独审。局部strict首轮2、窄类型修后0；collect4不是4pass，真实PG仍NOT_RUN。新source与检查绑定见pg-capacity-prepared-manifest.json，未扩大原产品SOURCE_REVIEW或R2结果批准。

## 原4capacity准备审查接收

- 审者：architecture_read / gpt-6-astra；实际独审时间2026-10-07T03:36:55Z，由Mika于本次恢复任务转达，原直达消息受thread limit阻止。
- SOURCE_AND_PREPARATION_REVIEW_APPROVED，0P1/P2。绑定source `68815dce87cc0a9498802de89448693215d028d6` / packet `1de74274791d55d9808056456379b038b430aa5f`；manifest SHA `d0b026a5e2545e20567b97aeee4875f232fb9383d54a642b50befba04e29a6ef`，22bindings113299B。
- 核原4case正文4633B逐字、main15847 donor同字节；runtime先settle再各库身份清理，aggregate/30outputs/有限selector；strict原2→修后0与collect4/0执行准确。
- 仅准备批准；4组真实PG仍NOT_RUN/NOT_OPEN，产品未集成main。原85/8PG、R1/unknown资源、fixed manifests不重跑/不改。
- 2026-10-07T03:41:52.772958+00:00 owner安全点沿既有clean-code方法核状态/target/链接及许可边界；仅2份metadata更新，无产品修改或工程检查。
