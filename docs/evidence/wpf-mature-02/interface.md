# WPF-MATURE-02 Interface请求与交接

Owner chatui01_owner；co-lead mika；大task [WPF-MATURE-02](../../plans/wpf-mature-02-harness-capabilities/plan.md)。当前仅实验consumer，不另造R05宿主。

## 首片可独立实现

固定codex-cli0.154.0 stable schema，注入一个只传JSON行的transport；consumer负责有界请求/响应关联、initialize→initialized顺序、model/list分页与public目录归一、ordinary final/failed/interrupted事件判别。没有spawn/auth/provider/账户文件读取。

## 共享合同需求（待R05 owner固定）

- NativeHarness descriptor保持R05唯一来源；需要Codex publicProfile/配置声明的正式入口，现有harness枚举、model/thinking/fast/access字段不可由consumer私自扩展。
- 目录/配置/实际证据分别：provider catalogue不是account entitlement，supported/unsupported/unknown应显式表达；账号查询机制及secret ownership单独定义。
- ReasoningEffort是固定schema中的string，由supportedReasoningEfforts目录约束。serviceTiers保留{id,name,description}/defaultServiceTier，不将deprecated additionalSpeedTiers当首选，不将effort低档当fast。
- TurnStart.serviceTier（thread持续override）与serviceTierForTurn（本turn-only，default表示标准速度、省略/null继承）语义分开。ProviderCapabilitiesRead的namespaceTools/imageGeneration/webSearch不是速度或账户证明。
- 已请求配置、实际init/turn结果与unsupported/unknown需持久关联task/attempt/native session；ordinary final不自动等于host安全结束，R05已有run/terminal Interface由其owner固定。
- 生产错误/取消/恢复、中心目录HTTP DTO及Web选择需明确owner和精确路径take。本scope不写packages/contracts、apps/runner/main/config或中心schema。

Web owner d01按本大task对接model/thinking/fast/access与账号/实际状态展示；请从本status/interface读取，不新增第二大task或手填事实源。
