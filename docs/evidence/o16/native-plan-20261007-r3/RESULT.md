# R3：规划失败，结构化认证错误已保存

固定诊断源49d / sourceDigest c6d957，唯一运行 `native-plan-20261007-r3`。2026-10-07T11:13:33.364Z 启动，operator 26170ms、exit1；本次1 SDK入口，累计3次，额度已用完，无第四次。4帧中frame3的 `assistant.error` 明确报告 `authentication_failed`；最终result仍是 `subtype: success` 与 `is_error: true`，api_error_status报告null。来源是SDK结构枚举，不从正文推测账户或Keychain首因，也不追认R1/R2原因。

SDK报告估计费用0、modelUsage{}、numTurns1；本次账户真实费用、前两次与累计账户费用仍UNKNOWN。没有成功proposal/pause；0apply/child续接，未进行确认或语义接受。空reads/hostToolDecisions不当完整中心audit。

私有错误正文按原界限耐久647B、0600、SHA `3689ed7e823ceb1d9b101fa6829b9880e39f0f1d01c3dc0364cb4d2211e31005`，未截断；仅对公开引用精确文件作NOFOLLOW/身份/hash/有界JSON验证，没有公开复制正文或读取凭据/config/stderr。公开首因依据结构字段，具体认证来源/操作未知。

2026-10-07T11:13:59.555Z server/admin/workers关闭持久，errors[]。2026-10-07T11:14:22.783Z driver12043、worker14564、watchdog11982均ESRCH，target连接[]、marker/OID一致、只读observerpool关闭；共享窗口已归还。原 `paused-owned-resources` 仅资源关闭状态，不能当15分钟成功pause。

DB `flow_o16_09a5ecedcbf64b7ea068ad1845c59211`、marker `16b993dc-e94b-47a5-8890-a4f0911854d8`、OID `1295824` 与 `/private/tmp/flow-o16-5YKpcI`（dev 16777234 / ino 124073875）保持KEEP；未DROP/rm，也未读取旧KEEP。原primary Error/code null、supervision driver-nonzero/unknown-retain与STOP不改绿。采样final runtime18225B/24项、measurementFailure null；不是系统零写或原子峰值证明。

原件仅一份：14个run/operator/attempt文件共16958B，见raw-bindings.json；新增分析引用candidate manifest与诊断固定来源，不复制完整不变源码。等待独立限定结果审查，未启动任何后继认证或模型操作。
