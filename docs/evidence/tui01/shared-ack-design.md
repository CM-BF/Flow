# TUI001-09 / 共享会话发送回执后继

设计观察：2026-10-06 09:49 UTC，main253035e11ab18ba33095c018949f856442021d49。这是TUI-001内的待实施子项；本文件唯一记录该后继边界，F01/Web只引用，不各建第二套协议规则。TUI01A两P2先由现owner修复并独审，首片不等待抽取。0provider；当前未修改产品。

## 已核问题与职责

FlowClient createConversation / submitConversationTurn 当前透传JSON；Web conversations/projection.ts在写入回执后自行检查结构、请求及上下文，TUI packages/interaction又有一套局部检查。TUI01A的无效HTTP200回执清除intent问题揭示协议规则重复和漏校验风险。不是要求重写所有client API。

| Module | 唯一责任 / Interface | 不拥有的状态 |
| --- | --- | --- |
| packages/client 内窄receipt模块（拟） | decodeConversationCreated(raw, frozenCreation) / decodeConversationTurnAccepted(raw, conversationId, frozenAdmission)：核已知必需shape、归属、revision/turn号、原文、profile/project/有序知识tuple，返回现typed receipt；追加未知字段兼容 | 不保存key、不重试、不合并当前历史、不选择新模型 |
| FlowClient 两写方法 | JSON body仅序列化一次；将与实际发送字节一致的请求快照交解码器，成功HTTP但JSON/shape/身份不可确认抛专用unknown ACK错误 | 不把回执无效伪成确定4xx，不删除调用方intent |
| Web / TUI controller | 先持久/冻结原key/body；收到已验证回执才能完成intent；unknown保持原请求供显式同key恢复 | Web保留当前快照/历史合并、capability呈现与epoch；TUI不import Web私有projection |

错误不得携带原始正文/token或将FlowApiError的4xx确定拒绝混入unknown。已有合法4xx处理保持。create的稳定重放回执只确认原创建请求；turn回执确认受理身份，不证明回复完成。旧受理回执可能晚于新GET返回，任何消费者不能因此降级当前final或revision。冻结知识的完整有序citation、digest、版本、区间、byteLength和freeze观察一致性必须保留；queue现有专用匹配留原模块，本片不扩大到queue API。

## 实施和验证

1. 首片修复及Mika增量审查完成后，由Execution Lead协调packages/client与packages/interaction精确scope，Web lead交回当前projection/receipt重复部分或在其独立树消费固定共享输入。每feature独立WT/原子take；本设计不授予他人当前writer路径。
2. 共享模块局部表驱动用例覆盖缺字段/坏JSON/身份冲突/未知追加字段、重放旧ACK、mutable caller input以及知识冻结；不引入全API框架。
3. 两真实消费者的HTTP用例：成功状态坏ACK→intent仍在→原key/body恢复；合法旧受理回执不覆盖新执行状态。复用既有HTTP/PG证据，只跑实际直接影响检查，0模型。
4. 固定source/证据独审并成套接收，更新TUI001-09；不把首局部修复当已经DRY。架构影响是Web和TUI共同消费client解码器，中心仍唯一持久权威。

方法：本地find-skills已发现codebase-design/clean-code；以两个真实消费者驱动小Interface，区分协议不变量与展示策略，有限字段/引用数沿既有DTO，无额外详情读取或全历史扫描。性能不主张提速，记录额外校验只处理已收到的有界回执。
