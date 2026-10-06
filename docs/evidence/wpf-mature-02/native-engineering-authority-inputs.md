# ENG01G：受信host可消费的最小资格/撤销输入

固定main `557397e9f756bfd9500107d7c1d1ce0ae65f7906`，实读`docs/evidence/eng01g/interface.md`、`apps/runner/src/engineering/native-writer.ts`与`native-policy.ts`。它们复用唯一Codex exchange/R06 pump，允许受限calculator.mjs update的事件/审批组合；尚无生产NativeWriteAuthority，不能把注入authority或C成功当其实现。此前[d111固定边界](native-engineering-boundaries.md)保留历史，以下为新接线输入，不运行实验/账户/模型。

现接口已固定：`open(binding,signal)`返回同binding、policy=`calculator-file-only-v1`、modelAssurance=`locked-no-fallback`和受信factory；`close(binding,signal)`返回同binding与revoked/unknown。binding精确含冻结executionIdentity(task/attempt/runner/ownerVersion)、leaseId、绝对directory、baseCommit、model。open/ownership和close分别有wallTimeMs上限（默认30秒、最高60秒），再有R06关闭；不能写成单一30秒总时钟。实例只执行一次，跨重启由已有journal/admission防重。

| host在open前必须固定的输入 | 现有事实与pending |
| --- | --- |
| 资源/身份 | assignment身份、lease、规范cwd及目录inode、baseCommit与固定workspace授权一致；本authority generation绑定这些值并保存在host私有状态。禁止用户JSON携带可用factory或任意executable。现binding字段存在，生产host资格检查/生命周期记录待提供。 |
| 模型资格 | 仅明确`gpt-5.6-sol`或`gpt-6-astra`映射；需要可信实际执行身份与禁止fallback的证明在授写前成立。目录/requested/ThreadStart配置不是actual；reroute/mismatch/unknown即拒native写改。当前未有该真实资格证明，不以label字符串或C/Node通过回填。 |
| file-only强制 | 固定calculator.mjs update范围、无add/delete/rename、禁exec/network/提权，实际enforcer版本/策略hash及所有工具/自动允许通道覆盖必须可验证。ENG有限item/approval校验是观测与host许可条件；workspace-write/untrusted声明不等于OS强制。现真实强制机制仍未证。 |
| 撤销与停止 | authority独占所有获授写入的主体/代际，可在有界close撤销全部权限并给同binding证据；部分open失败也持有收尾义务。直属child close/EOF/turn final、进程组消失或重复snapshot不等于全writer停止。现R06 CloseReport remoteEffects=unknown；真实revocation实现pending。 |

最小host私有证据应只保留：固定authority/policy版本、绑定摘要、资格证据ref与时间界限、真实enforcer配置digest、受托写入者代际/覆盖范围、撤销结果ref。引用应有长度/数量上限（候选最多16主体、每ref128字符、总16KiB），不给产品raw路径/账号/token/日志；这些是待owner确认的内部候选约束，不增公共合同或伪造证明。撤销/资格未知保留lease与unknown，禁止promotion/checker-after-native；trusted fixture/checker/snapshot仍沿自己的零模型权限继续。

资格分层：rootliteral4757只获忠实C bootstrap measurement PASS；未来Node若通过，也仅覆盖固定Node、七项own probe与R06 synthetic transport。实际Codex模型资格、所有tool通道强制控制及跨进程全部writer撤销仍pending，生产authority当前不可签发。host收据可引用对应固定recipe/source/input/结果manifest hash、同binding摘要、观察时点和close来源；不得将C或Node实验receipt提升为真实Codex权限凭证。

路由：ENG/ExecutionLead负责versioned purpose/profile、trusted authority实现和center receipt；R06只提供本地stdio/child证据，已交回源码02不改；02提供固定schema和实验事实。未来host资格预检可消费本页固定需求，缺任一项则unsupported/未探测，不要求先运行新实验以完成当前零模型生产接线。Node新候选仍设计/NOT_OPEN。

方法沿本地find-skills、codebase-design与clean-code sickn33@bdacd76，检查单一pump、闭包冻结identity、unknown传播、声明/强制/观测分层；0代码改动/测试/目标/SDK/provider。
