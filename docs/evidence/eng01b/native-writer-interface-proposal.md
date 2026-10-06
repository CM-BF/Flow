# ENG native writer 最小 Interface 与候选 scope

2026-10-06；native_center_owner / gpt-6-astra。仅设计与只读源码观察，0 provider / 0 app-server / 0 子进程诊断；没有领取或修改下列候选生产范围，不是第二份总计划。大task仍为 ENG-001；后继实现由 Execution Lead 单独分派、独立 worktree/fresh claim。

## 已核输入和能力缺口

ENG01B 固定 a750dbaa482ddd54aedd08495c66e73cc1458e53 已独审；main/origin 2e71fabc218df28f6ccb78a927432ae1101c17c5 精确接收，组合 root types 的独立 RELEASE01 tuple 错误待原 owner 修复，不能写成全局已绿。本设计读取当前 owner WT 63206486c4aaa42812ec622158fc10f3dbed674a，产品源码未变。fixture 只证明 calculator-v1 同 UID 合成工作区、受信检查、pin/fence、outbox/恢复，不证明原生模型可写。

Mika 权威输入为 claude-codex-capabilities WT HEAD 6d1d97581efa9d66019bc30c05fabaed8e672ba0 的 `docs/evidence/wpf-mature-02/interface.md` 与 `plans/wpf-mature-02-harness-capabilities/status.md`：固定 0.154.0；实际诊断 STOPPED，C 窗口 1 编译/0 目标，不能借此推断 launch recipe 已可用。0.154 thread/start 的配置回报不是实际 turn model/effort/tier/tool 的证明；>=Sol、模型回退/重路由与实际 sandbox/网络/凭据隔离保持未知。后继只消费其固定独审 recipe/transport，不占其诊断范围、不启动新窗口。

当前 `createEngineeringFixtureAdapter` 已有唯一 acquire→execute→snapshot→checker→snapshot→artifact/verification 路径，旧 runtime 拥有 claim/lease/admission journal/outbox/terminal。`EngineeringFixture.execute` 仅 Promise<void>，是可信确定性写入的假设；直接塞 native Promise 会把未分类异常当可释放资源，必须先把“写入是否已停止”移入明确 Interface。

当前普通 Codex adapter 的 `collectFinal` 私有持有唯一 transport receive pump、ID 绑定和关闭；`OrdinaryTurnEvidence`/`assertOrdinaryItem` 拒绝所有工具，wire 固定 readOnly/access none。不能用更换 cwd、放宽 profile 一个字符串、或把 tool final 伪装 ordinary final 接工程；也不能把 `createCodexAdapter.run` 包在工程 adapter 内，因为它会先发普通 text artifact/flow.text verification，造成两个结算权威。

## 建议：三个 Module，先冻结内部 writer seam

| Module | 唯一责任与 Interface | 可并行性 / 所有权 |
| --- | --- | --- |
| 工程执行与监督 | 现工程 adapter 独占 workspace、writer 调用、停止判定、snapshot/checker/receipt；writer 只得到一次本 attempt 的固定输入和 worktree 使用权 | A 可先独立实现，用确定性 writer 和未知写入注入验证；无需真实 Codex |
| Native writer | 固定 provider/launch policy→一次 native turn→写入停止证据；复用 R06 process transport 和 R05 一个 turn lifecycle，隐藏请求/通知/deny/关闭细节 | B 在稳定 writer Interface 后可做 JSONL peer 注入；真实 factory/自然通知矩阵与模型资格依赖 Mika，未知仍 unsupported |
| 工程 purpose 与验收绑定 | 显式 v2 purpose/profile，中心受理与 claim 前双重核对；固定 receipt 把 native 写入身份、checker 和 artifact 关联给独立 reviewer | C 的 codec/PG 可与 B 注入并行；公共 export/client/mount 仍由 Lead 持有 |

最小外部 Interface（概念合同，非已落地类型）：

`EngineeringWriter.execute({ taskId, attemptId, workspaceLeaseId, directory, baseCommit, prompt, signal, assertOwnership }) -> Promise<WriterReceipt>`。

- `directory` 只来自 host acquire 的 EngineeringWorkspace；task 不提供路径、命令、argv/env、checker source 或许可。writer 不收到 checker 路径、expectedChecks、workspace.release、context.emit、claim/outbox/client；禁止跨层写 terminal 或 verification。
- writer 配置由受信 factory 创建并与不可变工程 profile 绑定，不接受任意字符串 registry。Interface 只含这一方法；需要的 transport/launch factory 是其私有可替换依赖。现固定 writer 与 native writer 是两个真实实现，不做通用 Git/工具框架。
- `WriterReceipt` 区分 `completion=completed|failed` 和 `settlement=stopped|unknown`，并绑定 attempt/lease、provider 原生 thread/turn、固定 policy/launch recipe digest、requested 配置及实际观察证据。它不是模型的“完成”文本，也不是付费账单。日志/诊断有字节上限且不携带 credential/raw SDK 错误。
- **只有 stopped 才能释放 workspace 或进入 host checker**。completed+stopped 才运行既有 checker；failed+stopped 保留有界失败产物且不伪造 passed；unknown 不启动 checker，不重新 acquire，不释放原租用，转 `NativeExecutionError('unknown')` 复用现 lost/journal 路径。未知时最多保存明确标记的非权威诊断，不能称固定最终 diff。
- writer 未 dispatch 的受信本地失败可明确 stopped；一旦 dispatch，普通异常、timeout、abort、EOF、孤立 turn/interrupt ACK 均默认 unknown，直到拥有可审核的停止证据。主进程退出、turn completed 或 final 单独一个都不能证明所有写入已停；若允许 command 工具，必须覆盖其子进程/后台写入生命周期，否则该工具策略不准进入本首片。
- signal 表示停止请求，不能被转换成已停止。生产 native 未提供上述证据前只允许注入测试，不把 peer confirmed exit 当真实 native conformance。

## Purpose / profile / receipt 版本

保持 `flow.engineering-profile.v1` / `engineering-fixture` 的 canonical JSON/hash 与旧 recipe、旧 Native 只读目录不变。新候选 `flow.engineering-profile.v2` / `engineering-native` 只识别单个已选 Codex engineering adapter；第一次仍限 calculator-v1 合成 repo。公开模型字段只允许固定资格来源认可的模型选择；实际可用/实际模型保持 unknown 直到有相应证据，不按名字或用户可填字符串自授权。Claude 等价能力不猜测。

v2 pin 绑定 project/base/checker、native writer policy、launch recipe 版本/hash、requested model/effort/tier 及 host 限额。新 runner identity 发布同表不可变配置，复用原 requirePublishedProfile/revoke/pin；配置升级不得重写 v1 row/hash。工程 list 可在自身版本化 DTO 中返回 v2，但旧 Native/Claude catalog 的筛选与 codec 不扩为工程目录。

已核必须修改的直接约束有：`tasks.ts` 当前只接受 fixture engineering，同时 Codex 强制 ordinary executionProfile；`engineering/profile.ts` 与 `runners.ts` 是 fixture-only；`publication.ts` 当前按 harness==='fixture' 选择 engineering codec。后继以有限 protocol/purpose 判别选择领域 codec，不能用另一个长期 harness 特判掩盖版本，也不能把一个 v2 pin 同时当普通 executionProfile。ordinary conversation/goal、错误 target/project/base/checker、无资格 policy、revoked/missing/mismatched pin，均在受理和 claim 前拒绝。只做 schema 放宽不够。

`flow.engineering.receipt.v2` 候选在旧受管内容集与 checker 事实外增加 WriterReceipt/写入停止证据摘要及其 digest。中心只校验当前 attempt、最新精确 artifact/version、intent/profile 和停止/检查判定关联，不能宣称重跑 native 或 checker。旧 v1 receipt 保持可读。两个版本共享真正相同的内容集和 checker 判定，不能复制整个 verifier。

## 精确候选 scope（未领取）

A，建议首个独立小片，生产/直接验证仅：

- `apps/runner/src/engineering/writer.ts`（新）
- `apps/runner/src/engineering/writer.test.ts`（新）
- `apps/runner/src/engineering/adapter.ts`
- `apps/runner/src/engineering/setup.ts`
- `apps/runner/src/engineering/integration.test.ts`

此片保持 v1 产品格式与现 fixture 行为；先用 internal typed stopped/unknown seam 接固定 writer，证实 unknown 不释放/不 checker/不另起 claim。workspace/checker/resources/runtime/outbox 不改。native metadata 的公共 v2 receipt 在 C 单写；A 不抢其 contracts。

B，writer 与复用 native lifecycle 的最小候选：

- `apps/runner/src/native-harness/codex/adapter.ts`
- `apps/runner/src/native-harness/codex/turn.ts`（从 collectFinal 提取唯一生命周期）
- `apps/runner/src/native-harness/codex/engineering-writer.ts`（新）
- `apps/runner/src/native-harness/codex/engineering-policy.ts`（新）
- `apps/runner/src/native-harness/codex/engineering-writer.test.ts`（新，真实 JSONL peer）
- `apps/runner/src/native-harness/codex/evidence.ts`
- `apps/runner/src/native-harness/codex/policy.ts`
- `apps/runner/src/native-harness/codex/wire.ts`
- `apps/runner/src/native-harness.test.ts`（旧 ordinary 直接消费者）

原 ordinary policy 必须保留 exact 默认，工程 policy 是受信有限实现；不开放调用方注入任意 server-request responder。允许工具/观察 item/未知通知矩阵必须逐项固定：未经授权的请求 deny 且 fail closed，已观察副作用按未知保留。Mika 当前 transport、实验、诊断、安装/凭据都不在此候选 scope；若其固定 recipe 仍缺能力证据，此片只交注入 ready，不启动真实进程。

C，purpose/receipt 与中心门禁候选：

- `packages/contracts/src/engineering-profile.ts`
- `packages/contracts/src/engineering.ts`
- `packages/contracts/src/tasks.ts`
- `packages/contracts/src/engineering-native.test.ts`（新）
- `apps/server/src/engineering/profile.ts`
- `apps/server/src/engineering/profile.test.ts`
- `apps/server/src/engineering/verification.ts`
- `apps/server/src/engineering/verification.test.ts`
- `apps/server/src/runners.ts`
- `apps/server/src/execution-profiles/publication.ts`

C 不改 Native store/catalog 或 shared index。现 engineering route/client 已基于领域 codec，若新 DTO 必须新增薄方法/export，由 Lead 单写。main/launch 与持久 native setup 组合在 A/B/C 固定后单独分派，不能抢 A 的 setup.ts：候选仅 `apps/runner/src/engineering/native-setup.ts`、同名测试、`apps/runner/src/engineering/launch.ts`、同名测试、`apps/runner/src/main.ts`、`apps/runner/src/main-concurrency.test.ts`。这是后续串行组合，不是第四个同时占目录的 writer；每片只申请 literal 文件，避免工程目录父 scope 抵触。

## 验证与真实运行前置

A：现 fixture 直接消费者 + writer stopped/unknown（取消与普通异常、后台仍写入） + 现 PG restart/outbox 路径。C：v1 JSON/hash 零差、purpose/target/普通任务误用/revoke/claim SQL、v2 receipt 旧 attempt/错 artifact/无 stopped/failed/合法 passed；动态 SQL 需要真实独立 PG。B：真实 JSONL peer 绑定的同 attempt/turn，完整工具请求与 terminal item 矩阵，unknown 保留 workspace；旧普通 adapter 直接消费者只验证受影响 seam。资源界限沿用 128 文件/每文件 64KiB/总 512KiB/diff 256KiB/最多 8 worktree、检查 stdout/stderr 各 64KiB；新的 writer walltime/frame/output 限额单独固定，不凭旧 SDK USD 预算假装 Codex 硬上限。

首真实窗口之前还需固定：>=Sol 身份依据和实际 model 回退政策；可证明写入停止的 native 工具/子进程策略；可验证文件/网络/凭据控制及其限制；固定 binary/recipe、一次调用/总时间/成本记账与 unknown 规则；独立场景批准和清理记录。当前这些均未满足，不复用已封存诊断预算。模型身份无法在允许写入前确认时不能先写再事后降级；“requested gpt-6-astra”或 thread/start 配置不能自动填成 actual 合格模型。

真实验收顺序固定为：同一受管合成 repo → 合格 native writer → writer 已停止的 host 证据 → before snapshot → 原受信 checker → after snapshot 同内容集 → v2 receipt/artifact → 独立 actor 读取固定 diff、版本、原始检查和实际模型证据，明确接受或拒绝。checker passed 只是机械条件，不能替代独立语义结论。同 UID 受信实验不是对抗性 OS sandbox；模型输出中的任意可执行代码也会影响 checker 进程，必须继续做固定源码 diff 语义复核，不能把模式 0400 或外置 checker 目录称为模型绝对不可改。

首个受控 native 验收的独立 actor 结论可以是绑定 artifact/version/digest 的固定 review 回执；现 `/decision` 只处理 running/waiting attempt，不是终态工程产物接受接口，不能借它伪造业务接受。日用的持久接受/拒绝与 Web/TUI 是 ENG001-06 后继，不在 native writer 首片 scope。

## 取舍与技能应用

推荐先 A 内部 seam + C 有限合同/PG，再 B 注入和稳定 factory 接口；三个 Module 复用同一运行与工程验证路径。备选“把 ordinary adapter 包进 fixture execute”会制造 text 与 engineering 双 verification 且错误释放风险，拒绝。备选“复制工程/SDK loop”会分叉 lease/停止/最终结算，拒绝。不为等待原生真实能力另外发明通用文件工具框架或更名 fixture 成模型执行。

使用已安装 find-skills 本地优先方法：本任务是现 TypeScript/Node/PostgreSQL 执行协议的有界架构准备，选 codebase-design、clean-code（既有 sickn33 固定版本）与 brainstorming；未安装新技能。按根用户授权，当前只有设计文件，不新增实现/审批流程；采用 Module/Interface/Seam、单一状态所有权、错误/取消与性能界限检查。设计自查：A/B/C 写范围互不相交；与共享挂载/transport/诊断明确隔离；实际 native 能力/预算/模型未知逐项保留；没有第二 plan/status、没有产品代码或测试执行。
