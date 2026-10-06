# WPF-MATURE-02 Claude与Codex能力贯通

状态：in-progress。创建/更新：2026-10-06 09:01:08 UTC。阶段M2。单一owner chatui01_owner / gpt-6-astra；co-lead mika。

## 完整目标

Claude与Codex可被发现、选择和运行；model/thinking/fast/access从中心、runner到Web同一真实语义贯通。账号状态、native续接、错误/取消/恢复明确；requested、actual、unsupported、unknown分别呈现，不能把low effort当fast或model目录当账号可用证明。FLOW-001/002及full-plan-matrix为原验收基线，不把首个fixture当完整交付。

## 既有能力与缺口

现有Claude SDK0.3.290与R05-A ConfiguredNativeHarness/descriptor已存在；共享host/中心合同由ExecutionLead/assignment_review在native-harness-host树维护，禁止本任务另造宿主或修改其main/config/contracts。Codex0.154.0默认stable schema已在E02归档；尚无本任务真实app-server运行、账号验证、native模型执行或跨端接线证据。Web子任务由d01维护并关联本大task。

## 已确认方案与首个独立片段

先在独立实验scope实现有界RPC consumer、模型目录归一化与普通final事件conformance，通过注入本地确定性transport跨同一Interface验证，不启动真实Codex、不读个人CODEX_HOME/凭据、不发网络/模型请求。固定schema而非latest文档决定本机字段；ReasoningEffort保留返回字符串，serviceTiers/id保持公开目录值，不发明fast枚举。serviceTier持续thread覆盖与serviceTierForTurn本turn覆盖分别记录，默认/继承不混淆。

首片Interface：初始化握手、限页数/字节/并发/超时的model/list消费；正常final与failed/interrupted分开；EOF、未知id、坏JSON和超界fail-closed。transport seam由外部注入，实验不拥有host lifecycle、auth或生产profile发布。目录的accountAvailability固定unknown/unverified，实际配置需后继执行证据。

## TODO与验收

- [x] WPF-MATURE-02-01：独立树/领取、完整计划、固定schema与技能来源登记。
- [ ] WPF-MATURE-02-02：零模型bounded RPC、目录/effort/service-tier归一化和ordinary final合规片段；确定性故障检查与固定manifest。
- [ ] WPF-MATURE-02-03：提交隔离真实app-server initialize/model-list方案，Mika审运行路径后才执行0query探针；不得turn/start/auth/login。
- [ ] WPF-MATURE-02-04：对齐R05共享合同，贯通中心/runner模型consumer；需要正式scope与稳定合同后实施。
- [ ] WPF-MATURE-02-05：d01 Web选择、requested/actual/unsupported/unknown透明，thinking/fast/access独立语义验收。
- [ ] WPF-MATURE-02-06：账号状态、Claude/Codex续接、错误/取消/恢复，真实边界证据；执行许可另定。
- [ ] WPF-MATURE-02-07：独立review、每个小target及时commit/push/main集成与架构基线更新。
- [ ] WPF-MATURE-02-08：按完整跨端验收矩阵验收；不以目录或fixture替代真正模型运行。

## 依赖与交接

跨lead唯一需求文档：[interface](../../docs/evidence/wpf-mature-02/interface.md)。R05输入[共享接口](../../docs/evidence/r05/interface.md)，生产宿主/中心schema归其owner；Web d01读取本task状态与接口，不复制TODO。需明确harness声明、目录来源/有效期、能力枚举与unknown、requested/effective执行回执、失败分类和取消结束语义；本owner不抢公共路径。

## 授权与运行边界

当前只许local schema/确定性本地fixture。真实app-server启动先给Mika审隔离方案：专用空state directory、无个人凭据/配置、禁止网络、限定 initialize/initialized/model/list、总时限/输出上限/子进程清理，无用户服务影响。不得turn/start真实provider、auth/login、升级/安装或付费query。Pi不是Codex前置。

## 模块职责与设计规则

统一遵循[仓库modular-design](/Users/citrine/Projects/AgentHarness/Flow/AGENTS.md#modular-design)，不复制独立规则。目录归一Module隐藏raw catalogue语义；RPC Module只管bounded framing/关联/顺序/释放；普通final Module只管同thread/turn/item完成证据，不管任务调度/权限/进程。生产transport/adapter由ExecutionLead的runner worker实现；R05 owner负责中心profile/policy/session/final，Web d01消费正式合同。本实验不持有上述状态。

## 验证与架构

Node24/pnpm9.15.4固定；优先Node行为测试，源码/fixture绑定schema哈希，0测试不算通过。当前实验不改产品Interface/FSM/数据库；后继生产合同/依赖接线会影响架构，target/owner由Mika/ExecutionLead登记，不能把planned画成main事实。
