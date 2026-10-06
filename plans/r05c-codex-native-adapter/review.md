# R05C 独立审查

状态：NOT_STARTED，不构成通过。

- Base：3418fe682944145494463dca9e09f89c8b9c2295
- Target：27022407f175597d1d9c897f23f59261f24ab49b
- Reviewer：Execution Lead，只读实现，修复交owner。
- C0 scope：apps/runner/src/native-harness/settlement.ts、apps/runner/src/runtime.ts、apps/runner/src/runner.test.ts。
- 验收：普通异常仍failed；明确unknown不得completed/清除journal；取消后unknown优先；其他并发attempt可正常结算；未知后禁止新claim与restart重执行；outbox保留/重放；无provider调用。
- 执行方式：先核实际WT/base/head与固定manifest，读diff和明确测试证据；记录未执行项/严重度/findings。
- C1目录/权限/final/PG纵向另绑定提交，不由C0审查推断支持。

- 固定证据：[C0 manifest](../../docs/evidence/r05c/c0-fixed-manifest.json)，3源码/6验证文件/原进程stdout+exit哈希字节；6文件92不同检查通过，单选补充1通过/32未选；noEmit exit0。
