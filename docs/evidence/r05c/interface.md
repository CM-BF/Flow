# R05C Interface

输入固定：main3418fe682944145494463dca9e09f89c8b9c2295含R05B native profile/source与R06 main e785；R05B源target4944d1e795326ad9d437c8d6a4ea88f52db619d9；Mika固定0.154.0 stable schema归档与interface（读取25d0889d7f1fbb9db839062a5f160c396bb0a98f）。

## C0 结算错误

本地受信adapter通过NativeExecutionError(settlement: 'settled' | 'unknown')表达失败的结算证据。settled仅在未派发外部动作或已得到相应原生终态证据时使用；它不表示成功。普通Error保持原failed/cancelled语义，不自动变unknown。unknown表示外部执行或终态不能确认：已发送请求的timeout/EOF、取消只有ACK、本地进程退出都不足以证明远端已停。类不接受原生错误正文/凭据。

Runtime唯一拥有Flow lifecycle。unknown接入既有lost中断、关闭heartbeat与settle outbox，且不发completed、不complete admission journal。取消已先发生时也不能覆盖unknown为cancelled；不修改AttemptControl理由的先到优先规则。其他已在运行slot正常结算，已有admission恢复栅栏阻止新claim和重启重执行。没有新scheduler、lease或outbox循环。

## C1普通adapter预定接口

configureCodexHarness({publicProfile,createTransport})返回现ConfiguredNativeHarness；native union/codec/digest/pin共用，Codex ports为空。createTransport显式注入R06受信本地依赖，无默认Codex executable、无production env入口。R06独占initialize/ID/JSONL/背压/计时器/child关闭；adapter仅await ready并解释thread/start、turn/start与有界receive。

只有同thread/turn的已完成唯一agentMessage(final_answer、delivery null、无questions)与turn completed/error null共同满足才是普通final候选；完整terminal.items必须交叉核对并筛工具。宿主公开emit/outbox、verifier、completed规则不复制。普通final不证明外部工具隔离。

逐项deny：command/file approval decline；permissions空grant/turn；dynamic tool false；MCP elicitation decline；user-input/auth-refresh/attestation固定unsupported；legacy exec/apply abort；未知method -32601。观察到工具或白名单外item拒绝final并保留不确定副作用。需覆盖item/started、completed及terminal.items。access:none是Flow意图，never/readOnly不证明无工具；actual保留unknown。

ID128 UTF8 bytes、正文1MiB、host wallTime≤90s；R06默认wire frame1MiB含转义/envelope，不与正文上限混同，越界拒绝不截断。requested nullable显式字段不伪装missing；非null目录能力与原生实际运行单独验证。无Claude USD/maxTurns假限。stream/resume/steer/goal/context均unsupported。

Mika final投影需受控移交提升为唯一生产源、实验改消费同源；许可前不改其文件，不复制出长期双实现。0真实app-server/auth/provider，首纵向仅Node JSONL peer→真实公开HTTP/PG。
