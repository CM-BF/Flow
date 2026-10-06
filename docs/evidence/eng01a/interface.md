# ENG01A Interface — 初始合同

固定main f181d84，R05C已审host/settled-unknown/outbox与S01并发可复用。现flow.text只有nonempty/contains，工程结果使用新增有限flow.engineering checker v1合同，不能靠日志非空得到passed。

intent只用于专用fixture，包含targetRunnerId、受信projectId、固定baseCommit和checkerId/version/baselineDigest；不接受repo任意路径、shell命令、args/env或期待答案。center持久在现task submission并在claim前按targetRunner过滤，native/普通fixture不能用文本验收冒充工程通过。profile只读语义不放宽。

本机project/checker registry由可信调用者注入。workspace负责固定base、独占project lease、自有worktree/branch与owner记录；Git worktree共享refs/config，不把lock当写锁。不操作个人Git，首片只自有合成仓库。snapshot显式收集tracked/index/working/untracked（含ignored普通文件）、删除和mode；限定常规UTF8文本并拒绝symlink/binary/submodule/越界/过量。外部diff/textconv禁用，只读Git设置GIT_OPTIONAL_LOCKS=0。记录真实base/head，dirty交付version由完整snapshotDigest给出，不冒称HEAD代表未提交修改。

checker只消费workspace snapshot与host外部固定baseline，命令/期望不来自task或fixture；有界时限/输出/子进程关闭。前后snapshot与baseline digest都必须相同。真实exit/result/日志digest/截断与checker version绑定receipt；exit0或非空日志单独不构成工程验证。first fixture是受控写改，不声称隔离恶意同UID代码。unknown不伪装停止或成功，保留workspace/lease与宿主journal用于恢复；restart不重执行副作用。

adapter复用HarnessContext.assertOwnership/emit、现宿主claim/lease/outbox/verifier事件与NativeExecutionError，runtime仍唯一发completed。artifact为有界canonical receipt+diff/log，各digest对应同一内容集；中心验当前attempt/targetRunner/intent/artifact/receipt的关联及结构一致性，不声称重跑远端命令。旧flow.text兼容不变，沿现task/artifact/detail公开读取，无新API壳/第二调度器。

范围：apps/runner/src/engineering、packages/contracts/src/engineering.ts/tasks.ts/runner.ts、apps/server/src/engineering/evidence.ts/runners.ts、本plans/docs。F01保留contracts/index/public exports/必要薄client；实际编译接缝先明确窄路径，不越claim改写。
