# ENG01G 原生工程writer零query组合

新工程writer与旧ordinary消费者共用一个Codex exchange/receive pump；工程使用独立有限fileChange policy，原ordinary policy/输出/close错误语义保持。真实受信authority尚未实现，缺失即构造拒绝且零transport。旧profile/runtime/中心/fixture v1没有变化。[Interface](interface.md)、[质量](quality.json)、[唯一状态](../../../plans/eng01g-native-writer/status.md)。

## 实際验证和来源

固定Node24.20.0/pnpm9.15.4，own WT offline frozen install exit0，未改lock。Vitest4.0.18，0provider/appserver/auth/个人服务/PG；只启自有Node JSONL peers和合成Git。

105个不同检查分轮通过：最后[final-affected.stdout](final-affected.stdout)96/96=policy27+writer20+exchange1+ordinary adapter44+evidence4；[writer-consumers.stdout](writer-consumers.stdout)中未改的native-harness8/8；[reentry.stdout](reentry.stdout)新增1选1过、20未选。并非单次105/105。8个最终source：6个与final-affected.json记录hash一致，writer2个在新增一次性调用保护后由types-delivery.json/reentry.json记录最终hash；root types-delivery exit0。原ordinary直接消费者44/evidence4在共享类命名提取后按影响范围重验，旧工程/checker/O12矩阵未跑。

保留全部初始问题：local-first 47选37过10失败，测试peer初始化遗漏codexHome，被R06拒绝，尚未走到预期native消息场景；修测试peer后writer-consumers 75选74过1失败，普通临时目录/var与Node cwd返回/private/var不相等。固定config边界正确拒绝，修测试目录先realpath，不放宽产品策略；负例增加请求阶段断言，确保已实际到thread或turn场景而非因错误早退假绿。writer-final 19/19后，共享类命名清晰化和ownership超时新增检查再得96/96。最后新增同assignment实例不得重open的局部1过。

失败诊断仅自有peer固定close字段和合成消息；failure-diagnostic与failure-frames分别1失败/18未选。failure-response原stdout也保留，但shell最后执行head只观察到shell exit0，未单独保存测试进程exit；JSON明确testExitCode:null，不能当通过记录。所有正式验证*.json保存真实command/exit，types的stdout与退出码独立。

## 已验证能力和资源

- 一个真实JSONL消费者；原ordinary final identity/settings actual unknown和全部工具拒绝仍经原44项检查。
- 本片file policy仅允许calculator.mjs update、无move/add/delete/grantRoot；先item/started绑定变更，后审批，再完成/terminal逐项核。未知工具/请求、reroute、错身份、换diff、未完成项一律unknown，不以事件证明未发生工具执行。
- 自有Node peer在同一真实受管Git worktree写calculator，正常关闭后注入authority返回revoked；现executeEngineeringWriter接收stopped，现captureCalculatorWorkspace完整snapshot/checker通过。receipt仍writerSettlement:not-attested，host lease仍被占有；此组合不产生旧v1 artifact/verification/completed，不称native模型写入实证。
- authority open/close错绑定/异常/超时、实际R06 EOF/挂起/隐藏terminal工具、实际线程配置差异、ownership丢失均保unknown。每实例最多execute一次；跨进程不重claim仍由既有journal管理。
- 每个新测试owned peer在afterEach确认直属child confirmed-exited，随后只删除自己的临时script/root；Git test按peer→workspace.release→project.dispose→root次序正常收口。原adapter测试也保留其已有finally child检查。passed raw说明清理未报错，没有独立的OS所有writer停止证明或新生产authority。永不resolve的authority/ownership用例不创建OS资源，超时后没有把迟到promise当成功。
- 资源界限：原256通知/4MiB、64 early/2MiB；本片16file items、单diff16KiB、input64KiB、final16KiB；每次authority操作受wallTimeMs<=60s的执行/撤销窗口约束，另有R06自身有界关闭。无无界重试或轮询。

## 尚未启用

file-only是此片受限策略，不是未来工程任务永久禁终端的规则。可另审有界shell方案。实际启用前需要可信>=Sol身份与禁止fallback、真实强制范围、全writer停止或撤销写权的有限实证；当前ordinary final/直属child exit/两次快照相同不满足。NativeWriteAuthority仅可信host代码扩展点，没有可由task JSON自报的qualification/stopped接口，没有生产实现/默认executable。后继还需显式新purpose/profile、版本化中心receipt及独立actor接受/拒绝。
