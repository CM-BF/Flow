# C02-04 真实两轮连续性：待审提案，未开放执行

本片只固定可复用输入与验收边界，不是可直接运行的窗口。当前实际模型调用额度为0；未启动binary、PG、runner或服务。来源逐文件绑定见[native-two-turn-input-facts.json](native-two-turn-input-facts.json)。完整C02/native/UI目标仍未完成。

## 已有证据与缺项

固定main `9f314e89b9d4b1b944cca96df0a9fea5a26a51d0` 已有公开conversation、typed final、流读取、生产loader与唯一R06/exchange。原真实PG使用注入transport，证明中心协议和持久接线，不证明真实Codex恢复。旧conversation运行仍分别为5/6 FAIL与sentinel 1/1（5未选）；不改成一次6/6。

父证据 `07341d46` 引用实际 `9b9c1182` / seal `6dfbb213`：固定历史Codex 0.154.0 binary（222655232B、SHA4f859826…afcc）仅initialize和一次model/list，6条/5203B。目录、C/Node OS许可实验都不证明账号实际资格、请求模型一定被执行、无fallback或工程写权限。旧窗口已消费，不能复用。当前main turn仍把actualExecution.model等写为null/evidence=unknown。

未来必须分别固定请求model、实际返回可观察model及证据来源；没有权威实际值就保持UNKNOWN。账号、认证存储来源、推理/tier、费用计量与硬费用上限均未核。不得读取/复制个人auth/config或索取凭据来填空；可信operator须提供已授权recipe和存储生命周期。工程写模型≥Sol及no-fallback的资格没有因本提案获得，拟两轮仅普通只读对话。

## 最小职责与执行顺序

复用main的严格public profile与operator recipe → publishNativeExecutionProfile确认ACK（runnerId/configDigest）→ opaque host-owned storage → guardExecutionProfile → runRunner → 唯一createCodexTransport/exchange。任务JSON不能授予raw path/env/args，不能绕publisher或复制harness、FSM、auth、监督器。配置/主入口现归X01，exchange归ENG；未来固定执行前须同合法owner核实际main与recipe，C02不重新占其写权。

1. 开窗前冻结一个只读host-owned Codex profile/pin、同一runner身份、durable CODEX_HOME与HOME/TMP的私有目录identity/0700、exact executable hash、唯一两条输入和请求model。账户/launch authority未知、字段错配或ACK未知时0native。首次directory须新建且有正式归属，不能借换目录绕过旧unknown journal/attempt。
2. 第一轮通过现公开conversation API创建并提交含一次性短nonce的记忆请求。记录已确认conversation/task/attempt/session/native thread绑定；首输出后断开观察客户端只停止观察，后台runner继续。等待真实typed final和中心ACK；记录真实正文UTF-8/hash、公开reasoning仅有则记录。不要将缓冲delta或客户端断开伪作完成。
3. 由现R06关闭第一个native过程，确认exit/EOF/owned group与writer事实。保留同identity的durable storage，第二轮使用不同attempt cwd、同runner/profile/session。第二输入不包含nonce，要求从上下文给出它；精确prompt与nonce在未来输入固定阶段确定，本文不执行。
4. 第二个独立native过程必须走thread/resume（excludeTurns=true），returned thread ID必须等于已确认session ID，在turn/start前核验；禁止fallback thread/start、自动重播或unknown后新key。两轮各只有一次turn/start，第二轮应产生正确nonce与typed final，ID/source/pin不得串线。 不能只核用户prompt未含nonce：还须沿既有transport证据接缝核第二轮实际turn/start输入，确认中心没有重放/拼回nonce或首轮正文，同时保留实际thread/resume及同thread ID的关联。只记录必要布尔、结构/字节界与受控测试输入核对，不记录凭据或扩大日志。若该边界无法观察，应明确只能证明公开输入/会话结果，不能据此认定native持久续接；不新增wrapper或模型调用补证。
5. 记录每个过程独立身份、同CODEX_HOME/different cwd、首进程已关闭后才起第二个、请求vs实际模型、文本/可观察reasoning/终态和目录清理结果。这些同时成立才可称真实两轮功能已观察；UI、工程隔离/模型授权与费用事实各自验收。

## 新预算提案（尚未授权）

拟总300s（准备40s + 两过程各90s + 收尾60s + 外层20s），每turn工作≤60s/正文≤64KiB；最多2native、1thread/start、1thread/resume、2turn/start。没有额外model/list、account/auth/login/refresh、工具调用、文件编辑或自动第三轮。现有profile上限仍须满足，提案不把profile上限当可花预算。

拟累计safe/raw≤1MiB，临时目录≤32MiB、durable存储末样本≤32MiB；末样本不等活动峰值或OS硬配额。中心专库如需启用，单独固定连接/HTTP/task界及128MiB DB/WAL保留、1GiB不可支出余量，并加全部实际并行声明；不得沿用旧120s PG窗口。金额上限、计费token、模型价格/账号计量能力均UNKNOWN：必须有新的明确模型调用/费用额度及可执行停止边界后才能ACTUAL OPEN，字节限额不能冒充费用硬限。

只清理本次可确认identity、已确认writer结束的自有临时根；durable根两轮之间KEEP，结束后的KEEP/删除策略在输入中固定。未知exit/EOF/副作用/身份则UNKNOWN+KEEP，不follow symlink、不扫旧R1/unknown根、不强DROP。取消/失权不补final、不借完成flush绕授权。计时须外部开始至工具真实退出，与内部/持久化前时间分开。

## 准备解除条件与下一交付

当前不是工程实现阻塞，而是等待固定operator/auth来源、exact输入/model、费用和共享资源新额度以及独立准备审。先由合法owner提供可复用的真实launch能力与受控目录方案；无法观测实际model时可验证有限功能，但不能签工程模型grant。审批只面对最终具体输入，不创建新wrapper来掩盖这些缺项。下一片完成上述固定后才能排真实两轮窗口；本次0工程检查、0PG、0native/provider，旧sealed raw/manifest不变。
