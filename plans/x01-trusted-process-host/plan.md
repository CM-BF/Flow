# X01-TRUSTED-PROCESS-HOST01 — 受信插件进程生命周期

创建/更新：2026-10-07。状态：in-progress（首产品局部已验，待独审）。父任务：[X01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plugin-enable-binding/plans/x01-plugin-management/plan.md)，追溯 X01-04/05/07；co-lead Mika；owner db_transaction_owner / gpt-6-astra。唯一状态见 [status.md](status.md)，独审见 [review.md](review.md)。

## 结果与范围

为真实 `executePluginTool` consumer 设计 opt-in、每 invocation 新进程的受信 host。保留父授权/ownership/outbox唯一权威，并能准确区分 child 终止与业务未知。完整 Interface、合法 byte cap、取消/发布/平台语义在 [interface.md](../../docs/evidence/x01-trusted-process-host/interface.md)。原设计阶段无工程运行；Mika随后授首片，当前产品/验证范围见末节。

固定base4fdd；现main产品默认in-process不变。新模式不是第三方安全沙箱；不完成全X01隔离/升级/卸载目标。原来的受信材料与公开能力只作固定源码输入，不继承为新模式执行证据。

## 稳定 TODO

- [x] **X01TP-01** 固定真实consumer、Node24.20、release闭包与当前scope owners，记录现有证据和未知。
- [x] **X01TP-02** 固定最小Interface、身份/双phase/未知与资源语义、产品候选literal及验收预算。
- [x] **X01TP-03** 独立只读计划review无P1/P2，交Mika决定实现及跨owner手回；本TODO不意味着产品已实现。

## 原设计候选产品范围（12:39历史观察）

以下保留原设计候选；12:58本claim已v2/14正式接回七leaf并领取五newleaf，release test不在领取范围。

| exact literal | 职责 / 2026-10-07T12:39:21.334Z owner观察 |
| --- | --- |
| apps/runner/src/plugins/process-host.ts | 新父端，单 invocation 生命周期/消息/资源 receipt；新leaf需fresh核冲突。 |
| apps/runner/src/plugins/process-worker.ts | 新固定动态入口，只调用现host与有限桥接；新leaf。 |
| apps/runner/src/plugins/process-protocol.ts | 两端共用strict frame/identity编解码，避免两套协议；新leaf。 |
| apps/runner/src/plugins/process-host.test.ts | 新真实child行为与codec边界；不造另一fake执行器。 |
| apps/runner/src/plugins/execution.ts | 真实consumer内部选择；现 architecture_read / X01 v27持有。 |
| apps/runner/src/plugins/execution.test.ts | consumer错误/provenance/outbox交界；同owner。 |
| apps/runner/src/runtime.ts | 受信mode选择与资源上下文，保token/key；同owner。 |
| apps/runner/src/plugins/runtime.test.ts | ownership/shutdown/unsettled直接consumer；同owner。 |
| apps/runner/src/configuration.ts | 私有可选mode与unsupported拒绝；同owner。 |
| apps/runner/src/configuration.test.ts | 原配置兼容与显式mode；同owner。 |
| apps/runner/src/main-concurrency.test.ts | main到RunnerOptions接线/并发不变；同owner。 |
| tools/personal-preview/backend-release/artifact.test.mjs | 动态worker与relocated artifact闭包；需Original release owner协调；当前观察没有匹配active claim不等于写权。 |

`host.ts`、package-store、AttemptControl、journal/outbox、shared OPS14、server/contracts/client默认不改。resource receipt作为process-host私有资源记录，关联既有assignment，不新增业务权威；若实际接线必须修改journal或release builder其他leaf，先提出具体必要性并fresh原子amend，不能此表无限授权。X01现owner必须明确STOP→当前version amend→本owner take成功后才可写共享leaf。当前已发owner协调消息，不假定收到交权。

## 验收矩阵与分段

| ID | 必需证明 | 最小入口 / 边界 |
| --- | --- | --- |
| T1 | 默认旧mode缓存/结果不变；新mode两次顶层counter均从1开始 | 现host直消费者+新真实worker两次；不用随机URL清cache。 |
| T2 | import hang、同步无限invoke loop分别被期限终止，parent仍能响应，原effect为unknown | process-host.test真实own Node child；观察exit/各EOF/身份，不能只assert reject。 |
| T3 | load ACK后撤grant、lease loss或abort禁止invoke；未知load/invoke ACK不能重复 | 真实worker+原parent authorization closure；后续专库才证明server权限。 |
| T4 | oversized/partial frame、坏UTF8/身份/phase/重复result、stdout/stderr overflow与backpressure；console含输入/配置不落任何诊断正文 | 同Interface有限child fixtures；cap先于parse，只drain/计bytes/安全code，错误/cleanup保真。 |
| T5 | parent graceful shutdown/ownership loss取消自己的child且outbox仍unknown；硬崩溃残留不冒closed | runtime直接consumer+resource receipt；parent SIGKILL恢复作为后继，不自动重试。 |
| T6 | 环境无token/NODE_OPTIONS/不相关secret；固定cwd/material；不支持平台/缺入口拒绝新mode | 私有config/main与child实际看到的allowlist；不回传secret值。 |
| T8 | 32槽/count/总bytes拒绝入场，满额仍能停止清理复用；unknown全root HOLD；symlink/hardlink/身份漂移/坏receipt/重启有界读取 | process-host私有FS反例；无递归清理/旧PID探测，不把resource receipt当业务terminal。 |
| T7 | exact runtime artifact内worker/tsx依赖可在脱离仓库cwd加载并完成一次调用 | Original受控release闭包验证，不能以dev-tsx绿替代。 |

建议最小实施先做 T1–T6及T8 所需单 Module +真实 consumer/private opt-in，并将 T7 作为发布准入必要条件；未完成T7只能局部已验、不能宣称可部署。实现普通local候选20min、单child≤60s/累计≤120s、TMP16MiB/raw512KiB/source-meta2MiB，插件worker串行最多1个；实际测试supervisor/driver/worker进程树另在准入列明，不能把top-level child数当全进程数；每invocation10+1+1+1s策略须在选例数量内分配。fresh资源floor/配对取当时经理更高完整sum，不复用旧窗口。0PG/Chrome/provider；类型只本模块及直接consumer。任何实际child都需后续明确普通段授权，此设计段不运行。

真实中心最小后继单case复用现公开runner/授权与专库生命周期，只核phase revoke +原pin/unknown不重放，不重跑所有旧plugin PG。release/PG需要分别取得实际窗口与所属owner，预算待固定源码/闭包确定，不在本计划猜测已预约。

## 证据、技能与完成判定

输入清单 [source-inputs.json](../../docs/evidence/x01-trusted-process-host/source-inputs.json)、claim/provision/owner原件在同目录。find-skills本地匹配Node/TS/进程Interface；应用brainstorming比较独立进程/OS沙箱、codebase-design将实现集中一个Module、clean-code核命名/错误权威/重复与资源释放。路径和实际复核见 quality.md；无新技能安装。

本design交付条件仅为三TODO有固定输入和独立review。产品/main/部署均未发生，计划通过不勾父X01-04/05/07。架构变更候选是 runner→process host→worker→既有host，实施接收后由相应owner更新已核架构视图；当前仅planned。

## Mika授权首实施（2026-10-07）

设计e870两P2已独审关闭。首片追加稳定TODO：

- [x] **X01TP-04** 在正式scope移交后实现process host/worker、资源receipt和真实executePluginTool/private opt-in纵向接线；T1–T6/T8按本段边界验证。
- [ ] **X01TP-05** 固定产品+真实局部结果，独立实现审查并交主线；T7仍交Original release owner后继，不冒可部署全验。

为落实已审32槽FS身份与回收单一职责，最大候选追加一个私有leaf `apps/runner/src/plugins/process-resources.ts`，须先amend成功。它不提供一般文件/进程恢复平台；资源factory需要明确close（runner finally调用）以清除正常owner marker，原invoke Interface仍不变。

- [ ] X01TP-06：同一受信进程Host新增显式invokeVerifier，严格kind配对、真实材料验证、取消/UNKNOWN与旧tool兼容；不扩中心/公开producer/runtime分派，T7仍独立。
