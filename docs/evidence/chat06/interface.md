# CHAT06 首合同

Fixed SDK0.3.290；实现尚在进行，0provider。

- Event `assistant-stream`：nativeSessionId/nativeMessageId/blockIndex，parent必须null；immutable revision/fromBytes/text/prefixDigest，流结束/aborted/supersedes是块状态，不是任务完成。
- 读取 `GET /api/tasks/:id/assistant-stream?after=<blockId>&limit=20`（最大100）：AssistantStreamPage仅轻引用，按本task当前attempt；taskUpdatedAt和各block revision为异步水位，不能用conversation CAS revision缓存正文。
- `GET /api/tasks/:taskId/assistant-stream/:id`：有界AssistantStreamBlock含content；owner鉴权继承中心。前一attempt历史可凭已知block ID读取，但不混当前turn。
- timeline Reference新增可选 `stream:{kind:'assistant-stream',streamId,revision}`，旧id/title和activity保持。详情从上述专用route读取，不把id当通用detail。
- 最终typed assistant-final权威不变。页面看到finalMessageId后以原final替换当前草稿显示，不append到草稿，不删除前一native message（如工具前解释）的历史；最终成功仍须task/verification状态。失败/取消/uncertain展示interrupted，不把已出现文字当成功。
- sealed patch≤8KiB，250ms或字节阈值flush、attempt正文总≤1MiB。truncated显式；未flush内存尾段非持久。partial工具参数/thinking/签名/子agent不进入正文。
- Root确认官方顺序：完整AssistantMessage每非空块一帧，可能先于block_stop；native message ID与外层wire uuid分离。aborted/supersedes将局部验收，不用理想化“所有delta后单条完整assistant”。

共享export/client/mount由Lead；conversations聚合和Web由现owner接，不能把此合同提交当真实页面已支持。

## 主正文自动读取（修订首合同）

`GET /api/tasks/:taskId/assistant-stream/patches?attemptId=<id>&after=<runnerSequence>&limit=8` 返回AssistantStreamPatchPage。after默认0、limit默认8且最大8，按attempt稳定sequence升序；每页含至多8个≤8KiB正文patch，附属字段亦受schema限制。UI自动将patch应用到按streamId维护的正文，不要求展开详情。初次/重连从0或已应用cursor分页读取；不轮询增长的完整content，不把丢失未flush片段补成事实。响应总是taskId/attemptId，attempt必须属于路径task；当前task列表返回current attempt，UI切turn时丢弃旧请求结果。单块全文只提供明确task+block绑定的诊断/按需恢复；不能回退通用detail。已观察的source frame ID与持久patch transport ID不是同一个ID。

## 显式 final 展示结算（正式修订）

固定SDK result没有nativeMessageId关联字段，本模块绝不声称provider一一correlation。`settlement`为中心与assistant-final同一事务持久的Flow展示规则：policy=`flow.assistant-draft`、policyVersion=`1`、task/attempt/nativeSession/finalMessageId、replaceStreamIds/retainStreamIds，两集合完整且不交叉，原patch永不删除。Web直接按这份记录结束/替换临时正文，不按文字相同、opaque ID或最后一块推测。

- adapter在实际root tool_use边界前flush已观察文字，再报告有序tool marker；最终中心同时核CHAT05同attempt/session的tool输入证据。最后root工具边界前的完整文字（包括独立native text message）归retain；工具后的临时正文group归replace。无工具时采用attempt-draft规则。superseded历史仍保留其明确状态。
- gap、aborted、缺完整块/工具证据或一个block文字跨工具边界均返回correlation=`unavailable`及unavailableReason；replace为空、retain覆盖全部已保存块，final仍独立可显示。不猜关联，不宣称中断半句完成。
- 完整assistant单块可先于block_stop：mapper在block identity上核对，不按content数组下标猜。source wire uuid、native message id、final result uuid分别记录；supersedes按已观察wire uuid处理，未知目标保守不补造正文。
- `finalMessageId`兼容保留；消费者必须以显式settlement而非这个ID自行推断替换集合。本规则为展示政策，不是原始SDK身份映射。
