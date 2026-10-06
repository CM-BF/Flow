# F01 附件 ACK v2 独立只读审查

状态：APPROVED；Reviewer：native_center_owner / gpt-6-astra，独立于作者 Execution Lead。时间：2026-10-06 11:11:45 UTC。无未解 P1/P2。

Review target commit: `df8d077accea7a28536f1f56407a729c41e4639c`

固定 delivery：`8ed0137c855dd2403e9ba62b60d9c0d30bc15ac7`；作者 WT `/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-shared-foundation` 读取前后 clean。

范围仅 3 文件：`packages/client/src/conversation-acknowledgement.ts`、同目录 `conversation-acknowledgement.test.ts`、`packages/contracts/src/index.ts` 的已审 attachment contract 导出。完整阅读增量和现有 matcher、实际 FlowClient 冻结 HTTP 字节及解码调用、既有 receipt parser 与字段约束。相对 target parent 仅这 3 文件变动，未修改作者源。

非空附件显式进入单一 `parseAttachmentContextReceipt`，对实际 HTTP frozen request 的 project 与有序 reference 校验；缺失、错序、错 project、格式错误 digest 或非预期 v2 context 均归一为无原始 cause/data 的 `UnknownConversationAcknowledgementError`。absent/空附件继续原 v1 分支，未复制附件 decoder。原 HTTP 路径发送前同步 JSON 冻结 body，未知回执不会隐式重试或换 key；当前新增真实 HTTP 例证明缺 context 为 unknown，显式重放沿原 key/body 接收确认。能力字段只接纳可选布尔 attachmentContext，不将其当 provider 能力或执行成功。

Manifest SHA256 `66e0de2155c8de4a663f1b14185c6a71cbc0612c247398da942c763b60a07f37`；9 项 source/raw fixed/current bytes/SHA 相同，3 个依赖合同对已审 `8701a6cf547248e70aa5758f05da1d7d314ae9c0` 精确相同。逐项见 [hash 记录](attachment-ack-review-hashes.json)。原始检查已读：新增 HTTP 例 1 failed / 46 未选（缺 context 被错误接受）→ 47 passed / 47（46 旧 + 1 新组合），root noEmit exit 0；没有弱化旧断言。Reviewer 没有重跑测试、PG、模型或 provider。

批准限客户端回执身份确认与薄导出，依赖已经独审的 attachment domain 输入；不重复授予中心域批准，不证明附件 body 内容、真实 provider 执行或前端完整上传流程。clean-code/codebase-design 检查确认复用一个领域 decoder、错误归一及 frozen HTTP 身份边界，未引入新缓存、loop 或依赖。本文件是独立回执，不维护 F01 的第二套状态；由其 owner 转录 canonical。
