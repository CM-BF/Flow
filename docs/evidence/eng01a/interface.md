# ENG01A Interface — E0/E1 固定候选

固定main f181d84，R05C已审host/settled-unknown/outbox与S01并发可复用。现flow.text只有nonempty/contains，工程结果使用新增有限flow.engineering checker v1合同，不能靠日志非空得到passed。

intent只用于专用fixture，包含targetRunnerId、受信projectId、固定baseCommit和checkerId/version/baselineDigest；不接受repo任意路径、shell命令、args/env或期待答案。center持久在现task submission并在claim前按targetRunner过滤，native/普通fixture不能用文本验收冒充工程通过；target只是路由pin，不是独立能力认证。profile只读语义不放宽。

本机project/checker registry由可信调用者注入。workspace负责固定base、独占project lease、自有worktree/branch与owner记录；Git worktree共享refs/config，不把lock当写锁。不操作个人Git，首片只自有合成仓库。snapshot显式收集tracked/index/working/untracked（含ignored普通文件）、删除和mode；限定常规UTF8文本并拒绝symlink/binary/submodule/越界/过量。外部diff/textconv禁用，只读Git设置GIT_OPTIONAL_LOCKS=0。记录真实base/head，dirty交付version由完整snapshotDigest给出，不冒称HEAD代表未提交修改。

checker只消费workspace snapshot与host外部固定baseline，命令/期望不来自task或fixture；有界时限/输出/子进程关闭。前后snapshot与baseline digest都必须相同。真实exit/result/日志digest/截断与checker version绑定receipt；exit0或非空日志单独不构成工程验证。first fixture是受控写改，不声称隔离恶意同UID代码。unknown不伪装停止或成功，保留workspace/lease与宿主journal用于恢复；restart不重执行副作用。

adapter复用HarnessContext.assertOwnership/emit、现宿主claim/lease/outbox/verifier事件与NativeExecutionError，runtime仍唯一发completed。artifact为有界canonical receipt+diff/log，各digest对应同一内容集；中心验当前attempt/targetRunner/intent/artifact/receipt的关联及结构一致性，不声称重跑远端命令。旧flow.text兼容不变，沿现task/artifact/detail公开读取，无新API壳/第二调度器。

范围：apps/runner/src/engineering、packages/contracts/src/engineering.ts/tasks.ts/runner.ts、apps/server/src/engineering/evidence.ts/runners.ts、本plans/docs。F01保留contracts/index/public exports/必要薄client；实际编译接缝先明确窄路径，不越claim改写。

窄completion hook已获Lead批准并原子amend v2：apps/server/src/events.ts仅engineering intent且outcome succeeded时，在关闭steering/写terminal前调用assertEngineeringCompletion(client,task,attempt)，要求当前attempt/最新artifact完整内容集与可信receipt verification passed；旧flow.text完成规则不变，事务错误回滚完整事件批次。

## E1 Module 与 Interface

| Module | Interface / 所有权 | 依赖和生命周期 |
| --- | --- | --- |
| resources | runCommand(受信固定argv/cwd)，readTextFile(path,max)；子进程close或unknown、非阻塞普通文件读取 | spawn无shell/最小env；最长30s+1s关闭观察、单流有界；不读取凭据 |
| workspace | createSyntheticProject(parent,id,initial)→acquire/snapshot/release/dispose | 只能新建自有合成repo，不接既有路径；每project一份wx lease，最多8个保留worktree；snapshot/diff前后同内容集 |
| checker | createTrustedChecker(parent,id,source,expected)→selection/run/dispose | 外部baseline只由受信宿主创建；固定Node路径、完整expected case IDs；前后baseline与内容digest核对 |
| adapter | createEngineeringFixtureAdapter(配置runnerId,fixtures)→既有HarnessAdapter | map只接受受信project/checker；任务只有选择键；assertOwnership/emit/NativeExecutionError，runtime仍发唯一completed |
| center engineering | assertEngineeringVerification / assertEngineeringCompletion | 仅验证可信host上报的关联/一致性，不执行远端checker；旧artifact/detail读取路径 |

新增受控fixture只创建project/checker并注入一个execute，不修改宿主循环、中心状态机或公共schema。source/expected不来自task；这仍是受信本机setup，不是可任意公开配置的日用工程能力。第一片真实修复calculator.mjs，外部Node baseline导入该文件执行两项固定算术检查。

资源界限：最多128个内容文件、每文件65536B、working总524288B、目录遍历256节点/16层；常规UTF8文本，拒绝二进制、链接、submodule、merge index。完整base/index/working三视图记录删除/模式/ignored untracked；snapshot读完diff再核同内容集，checker后再次核。同project最多8个保留worktree，达到上限由可信调用者dispose自有project并新建，不自动删除unknown。patch累积262144B，checker stdout/stderr各65536B，最终event沿旧1MiB detail/2MiB batch边界。Git只读GIT_OPTIONAL_LOCKS=0、外部diff/textconv禁用，命令无shell/环境白名单，kill/close仅描述受控本机子进程。

边界：Git worktree共享refs/config；wx lease只协调本Module，不是跨进程安全沙箱。受控fixture及checker属于同一受信setup，文件权限/前后hash不隔离恶意同UID进程；本片不允许任意模型生成程序。unknown保留workspace/project lease/checker及现host admission，测试的restart是重新启动runRunner实例，未知fixture注入没有声称实际失控子进程。未提供跨进程project重建或自动解除unknown的产品入口。

丢失artifact ACK遵循现host lost语义：只重放已持久化artifact，验证事件尚未发出就保持pending，不能根据artifact内passed自动伪造verification/completed；不会重新运行writer。未知写入经租约到期公开uncertain，中心reservation与host journal保留。

已知配置限制（Lead明确本片保留）：targetRunnerId仅排除其它runner；若人为误指普通fixture，该runner实际会领取并生成普通产物，但flow.text被工程门禁拒绝，不能工程succeeded。真实PG用例覆盖实际领取→无verification→uncertain；旧普通任务仍succeeded/passed。后继ENG001-04显式工程profile/受信登记闭合能力认证，当前不新增registry/migration或改变E0批准范围。
