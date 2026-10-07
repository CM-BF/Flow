# CREATE/Queue 回执恢复补验源码

固定 `67f8fd25a129ef5c8882f07e54de87e20ed24429`，相对55b只有 browser.ts 157+/9-；18其他源与supervisor函数逐字不变。归原RECOVERY01-02/05，完整feature IN_PROGRESS。本段三例均真实browser NOT_RUN；原full7/choice的PASS、五FAIL/全部raw及新段spent24589/rem125411不改。

| 单选journey | 公开前提与精确断言 |
| --- | --- |
| create-ack-loss | New chat真实文本Send；real CREATE ACK body截断、0turn；原journal两key/两body无conversation绑定；下一稿落盘、过期/reload/显式cookie连接不产生业务POST；显式retry才同key/body CREATE replay、同conversation及首次原turn；accepted checkpoint/下一稿保留。 |
| created-turn-ack-loss | CREATE正常checkpoint已persist为submit/绑定conversation后真实turn ACK body丢失；re-auth无自动POST；显式retry只同turn，不再次CREATE，decoded同turn/task/原两body，下一稿保留。 |
| queue-ack-loss | 原project绑定两文件按saved.txt/later.txt有序Use，Queue next公开可用才发送；真实enqueue ACK body丢失后原revision/key/body/ref顺序，re-auth无自动POST；retry同item/sequence/replayed，waiting状态和下一稿保留。 |

每组独立attempt沿原markedDB/fixture/context/cookie连接。公开enqueue仅依赖conversation存在/queue revision/容量/合法材料；native active attempt是promotion的另一道门。本fixture已有automaticQueueScan:false，保持0provider，不强行开启UI。CREATE两例纯文本，不声称材料覆盖；Queue不验证promotion或Steer。沿原real-response headers→同Request requestfailed→strict prefix证明故障，不拿retry成功反推故障已发生。

原全7顺序/行为和choice保持；新组不是full的一部分。Gate/Init/WorkerResult已有同selection约束复用，不能由worker缩required；empty/partial/foreign/setup failure/NOT_SELECTED都不能PASS。精确record id与可见receipt phase共验，不first/nth、不去重删稿。

本地实际：noEmit exit0 5613.436458ms；新增3选择33定向断言 exit0 215.206542ms；合计5828.643000ms/30000，保守5829ms。每条reserve5s、work<=10s，network denied、项目/deps只读、两个owned Node已reap/group ESRCH，0PG/Chrome/HTTP。未运行旧50/119或真实fixture，计量不是硬quota保证。原件见create-queue-local/与index。

## clean-code / 技能

2026-10-07 06:36:20 UTC按本地find-skills方法复用clean-code、codebase-design、webapp-testing及已接受brainstorming设计；无安装。复核范围只本browser增量：通用化已有ACK observer而不复制fault系统；CREATE参数化复用两阶段身份断言；公共contracts/client decoder和既有Queue decoderauthority，不新DTO；exactRecordRow统一有限受控身份，避免重复模糊匹配。错误保fail-fast、边界检查与原cleanup保持。实际未解决项：三例真实浏览器未运行、完整Steer/SSEdelivery/profile/knowledge/二中心仍缺前提或实证；无UI美化/C02接线。
