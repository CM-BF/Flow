# 单次真实逐段正文界面验收候选（未授权调用）

准备 owner：Execution Lead。本片只准备，当前无 permit、0 query；R02、两轮聊天、队列与O08原预算全部封存。候选产品固定 main `32c371d389a913f8dd71c3bd8b98dd0697411256`，含独审 CHAT06/旧新兼容、Web App `9dafff7702f700e8b89f8ccee1992bce9ccb63d1`。必须先等 SVC02 本次更新窗口关闭，再核实际 center/runner source、Web实际源码与协议协商；不能把main或健康检查当已加载/模型能力。

## 范围、资源和预算候选

最多 **1 SDK query / 最多2 turns / SDK估算上限 USD 0.20 / adapter 60秒**，观察至有界收口，不重试、不换模型、不追加任务补证。固定个人已登记 `claude-sonnet-5-5`、access none、tools请求为空、原身份/profile/digest/限额，steering仍关闭。底层provider请求数量unknown，不能把SDK query数当provider请求数；完整modelUsage含辅助模型，usage未知如实停止。请求配置、实际init声明plugins/skills、实际工具与thinking分别记录，不能称零扩展或安全沙箱。

使用已保留个人中心61227及产品Web61228，新建仅本次的合成conversation/单turn。只开专属隔离Chrome进程，不控制用户IAB或已有四个tabs；token只在内存送认证，不存URL/日志/截图。仅用户正文/只读观察，0工程文件/工具/终端写入。中心保留该合成历史，不清DB、不删除旧记录、不停止个人服务；退出只自己的浏览器进程。

拟提示：用四句短中文说明如何叠一只纸风筝，每句以序号开头，最后另起一行原样输出本次随机 `FLOW_STREAM_<nonce>`。不用工具。该nonce只绑定本次结果，不做未泄漏答案的记忆/推理主张；不靠特别长提示拖时间。

## 调用前硬条件

- GO绑定固定driver/sourceDigest、实际三端source/config与一次新预算窗口；一次性reservation先持久，缺许可预检拒绝发送。
- 同一driver先0模型演练严格DOM定位及draft→final判别，不重复Web作者8项浏览器矩阵；实际运行按钮/面板locator从固定Web说明取，不能事后放宽。
- 个人runner accepting、没有未知/未完成尝试/待晋升queue；已有profile仍none/原pin，单次任务绑定该profile，不能改host开关。
- 只有专属browser当前focused、visible pane的 `assistant-content`可作正文证据；typed GET `patch-v1`协商和该task/attempt stream元数据只是身份/时序旁证，不替代DOM。

## 成立条件与有限结论

1. 发送一次真实Web消息，保存durable receipt及唯一task/attempt/session映射；有running事实后在当前可见pane采到至少一个非空draft文本，且该时点final未完成，随后采到同一block/attempt内容增长或更高revision。若provider合并得太快、没有delta或观察没赶上，流式UI为NOT_PROVEN，不追加query/动画/fixture冒充。
2. 最终typed正文出现，非空且最后一行精确nonce。Flow presentation policy的retain/replace集合与最后可见消息相符；最终替换后旧draft没有继续出现在runtime repository，可见UI无虚假2/2 branch。保留真实原始patch/settlement引用与时序，工具前正文若未发生就明确未覆盖。
3. 断言严格局限专属focused pane的assistant正文，排除user prompt/隐藏pane/节点总数；保存实际截图和观察时间。只读HTTP终态、artifact、usage不能替代UI通过。
4. 任何失败/超时/未知先封存已收集事实，再只关闭本次browser。后台task若仍未终态仅只读观察到adapter既有限时，不自动cancel/retry/再送一条。保留真实清理状态与全部已发生模型成本，预算封存1/1。

## 仍待准备

Web管理回固定locator/启用流程后形成最小driver与0模型演练证据，再交GO审一次具体新窗口。目前无新模型许可，也未承诺provider一定发partial或完整U11通过。
