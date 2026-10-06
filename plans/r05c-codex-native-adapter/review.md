# R05C 独立审查

状态：C0 APPROVED；projection APPROVED；C1 NOT_STARTED，不能由C0通过推断C1能力。

- Base：3418fe682944145494463dca9e09f89c8b9c2295
- Review target commit: 7127b5bfda3135670e1595dd4b6e90c4c9ea416c (C1 awaiting independent review)
- Reviewer：Execution Lead，只读实现，修复交owner。
- C0 scope：apps/runner/src/native-harness/settlement.ts、apps/runner/src/runtime.ts、apps/runner/src/runner.test.ts。
- 验收：普通异常仍failed；明确unknown不得completed/清除journal；取消后unknown优先；其他并发attempt可正常结算；未知后禁止新claim与restart重执行；outbox保留/重放；无provider调用。
- 执行方式：先核实际WT/base/head与固定manifest，读diff和明确测试证据；记录未执行项/严重度/findings。
- C1目录/权限/final/PG纵向另绑定提交，不由C0审查推断支持。

- 固定证据：[C0 manifest](../../docs/evidence/r05c/c0-fixed-manifest.json)，3源码/6验证文件/原进程stdout+exit哈希字节；6文件92不同检查通过，单选补充1通过/32未选；noEmit exit0。

## C0 独立结论

Review target commit: 27022407f175597d1d9c897f23f59261f24ab49b

Execution Lead只读APPROVED 27022407f175597d1d9c897f23f59261f24ab49b。已读3源diff及runtime/control/outbox/admission上下文，17 manifest条目固定/working bytes+hash同一；已核92不同检查、受影响并发1选择/32未选与tsc0原证据。review未重复运行测试，0 provider，无P1/P2。仅可信NativeExecutionError unknown保留占用、不伪completed、restart不重claim、其他已在运行slot可结算；普通Error/settled保留旧语义。C0等待main receipt；C1未审范围另固定target。


## Projection 独立结论

Review target commit: 6313c885c5c5524faedba9b8c49e4d3e164028d5

Execution Lead只读APPROVED两文件projection.mjs/d.mts；完整104行pure state与16行声明已读，5179B算法对Mika0d0524原文/current逐字相等，声明与3证据hash已核，固定15项原test source hash一致且真实进程15/15。未重复运行，0provider，无P1/P2。仅普通final evidence，不证明工具权限/宿主settlement/provider；AssertionError可能含raw，C1必须丢弃归一。

## C1 待独立审查

Review target commit: 7127b5bfda3135670e1595dd4b6e90c4c9ea416c

状态 NOT_STARTED；owner已固定13源码，不把owner检查当独立结论。Base/input fa39510aca91e032af7925cd79e81d27873da03c（C0/projection与已审095 client输入）；source scope及逐文件hash见[c1-fixed-manifest.json](../../docs/evidence/r05c/c1-fixed-manifest.json)。Review默认只读，修复交native_center_owner，保持claim。

审查任务：核实际WT/branch/head/dirty，读13源diff与宿主直接上下文，对照[Interface](../../docs/evidence/r05c/interface.md)核责任、两个request/单一receive生命周期、身份/普通final/完整terminal.items、全部server-request deny、settled/unknown及close资源语义。核95个不同检查及tsc0原始输出；首次PG测试查询失败与单选补充透明保留。核unknown无event/无completed、PG reservation/journal/restart与ownership门禁，Claude旧public codec/配置消费者保持；核源和validation/证据manifest字节。未执行真实Codex/app-server/auth/provider，不可由fixture推断生产支持或无工具隔离。

Findings/结论：等待Execution Lead只读review；owner未发现未解问题不是APPROVED。
