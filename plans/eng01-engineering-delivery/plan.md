# ENG-001 真实工程任务交付

状态：in-progress / ENG001-02与ENG001-03由唯一ENG01A子片实施。创建2026-10-06。承接FLOW-001 REQ-06与FLOW-002-T07，唯一生产大task；E01保留harness公平对照与合成研究，不复制本实现计划。Goal Owner定义用户结果，Execution Lead自主拆分sub-tasks。统一遵循[模块与性能规则](../../AGENTS.md#modular-design)。

## 用户结果和优先级

用户在Web或TUI为明确项目提交工程请求，中心持久保存目标、工作区、权限和执行配置。runner复用已认可native harness，在独立分支/worktree实际修改源码并运行局部检查；界面退出后工作继续。交付显示实际diff、固定版本、runner监督得到的检查结果及独立验收依据，明确失败、未验、取消、未知和待接受，不以模型文字或fixture的success代替。

顺序：TUI首片与R05/Codex基础接通之后、COST观测扩展之前；不等待所有Web视觉/语音完成。先一条真实纵向旅程，再扩第二harness/复杂工具。2026-10-06 mainf181d84已接收TUI01A和R05C/C1，原基础依赖满足。ENG001-02/03进入ready：不再等待Mika真实Codex诊断、完整capability或全部Web。上述为10:02的ready记录。当前native_center_owner已在独立engineering-workspace-pipeline工作树、claim 7830846a v2领取ENG01A；[唯一子片计划](../../../engineering-workspace-pipeline/plans/eng01a-workspace-pipeline/plan.md)细化E0合同/关联与E1真实工作区通路。E0局部独审通过，E1未完成；SVC04保持独立。

## 当前已核事实与边界

固定main3418fe682944145494463dca9e09f89c8b9c2295：Claude默认仅显式材料Read或受限goal工具，禁Bash/Write/Edit；现profile是只读/goal工具的小预算，flow.text仅nonempty/contains。O10真实单文本child不能当工程交付。R05/025已增加有限来源识别，R06只有有界transport，尚无可用工程adapter。源码观察与技能记录见[research.md](../../docs/evidence/eng01/research.md)。

保留现只读profile；不能全局解除工具限制或静默改变个人预览、旧profile、预算。工程能力以显式目的/工作区/pin授权，规划工具grant不自动获得工程执行权。现4turn/90s/1USD是旧小片限制，不是产品永久上限；新工程profile限制需可配置、有来源、并发/累计/unknown边界明确。

Flow项目写入只允许确认>=Sol的模型，优先本机可确认gpt-6-astra/gpt-5.6-sol；Claude能力等价不得猜测。0模型受控写改/检查通路可推进；真实provider必须另有固定场景、调用数、预算与许可，不复用封存额度。worktree只隔离Git写入，不冒称OS sandbox或秘密隔离。

## 小Interface和状态所有权

| Module | Interface及权威 | 复用/边界 |
| --- | --- | --- |
| 工程受理 | 显式project/workspace/revision、profile/purpose、稳定key和验收基线引用；中心持久 | 复用公开typed command、claim/lease/decision，不建第二调度器；Web/TUI/CLI共用 |
| 工作区租用 | 可信host将授权repo/ref映射到唯一worktree/branch，校验归属、初始dirty/固定base，释放只操作自有资源 | 不接受模型任意路径/凭据；同workspace并发有明确占用和未知恢复；不递归扫删其他工作树 |
| native执行 | 现R05 descriptor/有限ports及具体adapter；输入为固定执行上下文，输出事件和settled/unknown | 复用SDK循环、lease/outbox/fence；工程工具策略是显式可替换策略，不各层散播harness字符串或复制runtime |
| 监督检查与产物 | 受信验收定义→外部命令执行→退出/有界日志→tree/diff/artifact digest绑定 | 模型不能修改验收基线、期待结果或监督器；检查前后tree必须固定或重新判定过期；结果由host观察，模型自报仅附文 |
| 交付读取与接受 | 固定base/head/diff、验证输入/输出digest和真实actor、接受/拒绝 | 沿G01/O01/K03版本规则，机械通过与业务语义独立；失败仍保留diff和诊断，详情按需分页 |

首次只选择现接口真正需要的seam；新增一个harness应替换adapter/策略而非复制工程受理、工作区和验证逻辑。权限、错误、取消、生命周期与依赖方向先固定；遇到不断增加的特判先局部重构。不得为本计划创建通用执行框架、第二账本或第二agent loop。

## 最小纵向子片与验收

首实施候选：固定合成Git repo和不可由模型写入的验收目录；一个小代码缺陷、一个明确project/workspace和合格profile。0模型fixture executor实际修改受管worktree，host运行已固定局部检查，保存base/head/diff/log/version，中心公开接口读回；退出观察不cancel。该片只证明工程通路，不称模型工程能力。

在同一通路固定、独审且预检满足后，再给一个单次有界native候选，写明实际模型来源与>=Sol验证、合成材料、允许的工具/目录/网络、调用数/总时间/成本边界、清理及失败即停。真实验收需实际代码diff、不能被执行模型改写的检查基线、host退出记录和独立语义审查。没有许可不运行；不用重复对照研究挡住生产通路准备。

必要局部矩阵：稳定key丢ACK；lease失联/重启后未知不重跑副作用；取消请求与真实停止分离；工作区身份/dirty/跨任务拒绝；secret/session不越界；检查失败仍能回看版本；日志过大分页/截断可见、资源有界和取消清理；模型修改测试不能改变受信基线；产物变化使旧验证过期。真实部署不动当前61227/61228，独立操作窗口另定。

## 稳定TODO

- [x] **ENG001-01** 建立唯一生产目标、当前源码缺口、职责和优先级；此项不是产品交付。
- [ ] **ENG001-02** 固定工程受理/profile、工作区租用与监督检查的小合同，确认可复用接缝、模型门槛及精确scope。
- [x] **ENG001-03** 0模型真实PG+Git/worktree+检查命令+产物的纵向片，公开headless/TUI可复跑验收。
- [ ] **ENG001-04** 固定版本的工程执行profile/adapter和恢复、取消、unknown、日志/资源边界；只读旧链回归。
- [ ] **ENG001-05** 首真实合格native工程旅程：具体一次预算、预检、实际源码改动、监督检查和独立语义验收。
- [ ] **ENG001-06** Web/TUI交付展示与明确接受、错误诊断、浏览器退出持续、持久重连。
- [ ] **ENG001-07** 第二harness与较复杂工程任务按真实差异扩展，不降低首旅程/质量/权限要求。
- [ ] **ENG001-08** 完整日用验收、文档与已审部署；全部完成才向GO发送唯一Done。

## 完成和非目标

完整完成依赖上述用户旅程全部可用与真实证据；单个模拟、read-only回复、类型通过、计划或CLI薄壳均不足。E01保留公平比较，COST复用usage账本提供成本解释，不是本纵向片必须等待的工程实现。优先保存已受影响局部检查；不为文档重跑产品全集。

## ENG001-02 受信检查与Git固定内容集补充

当前runner verifier/server evidence/runner合同仍限flow.text的nonempty/contains。工程通路需独立的受信检查来源、版本、退出结果与产物收据；不能把日志非空当工程验证通过，中心只验证收据/产物关联，不声称重跑远端命令，旧text验证保持兼容。

受管worktree共享Git refs及默认config；worktree lock只防移动/清理，不是并发写锁。交付内容集须覆盖新增未跟踪、已暂存/未暂存、删除、文件类型/模式；首片可明确拒绝binary/submodule，不可漏掉仍称完整。受信检查前后必须绑定同一内容集，禁外部diff与textconv，只读Git用GIT_OPTIONAL_LOCKS=0；不为这些约束造通用Git框架。来源：[Git worktree](https://git-scm.com/docs/git-worktree)、[Git diff](https://git-scm.com/docs/git-diff)，GO于2026-10-06提供的已核研究输入，实施owner仍核实际固定工具行为。

当前片段映射：ENG01A已完成上述0模型真实工程通路并进入mainc5；ENG01B在独立worktree接专用profile/用途授权与持久启动。真实合格模型写改、业务接受和完整日用仍未完成，固定fixture成功不扩为该结论。


## 当前宿主之后的原生工程执行（2026-10-06 11:15）

ENG01B固定a750及已审shared client/mount现已main2e71，123不同局部证据只证明同UID固定calculator fixture的profile/purpose/pin/lease/持久setup/检查/产物关联。原ENG001-04/05/06立即进入下一执行方向，不等待完整Web或完整Codex能力；native_center_owner在现安全点只读准备独立native writer Interface与精确scope，生产实现仍需独立WT/原子claim。

复用 engineering/adapter.ts 的 execute 接缝、现workspace/checker/receipt/runtime；下一片收敛显式工程profile/purpose与一个可替换native writer。写入必须可确定已停止后检查同一内容集；执行模型不能改验收基线或监督器。现tasks/profile fixture-only限制需有受控版本化扩展，旧readonly profile保持。权限许可不等OS隔离，先核现harness/可用sandbox能力和本场景边界，不借抽象造新循环或通用沙箱项目；Mika仍是Codex实际诊断唯一owner。

真实下一用户结果是>=Sol来源在同一受管合成repo修复缺陷，host检查，固定diff/证据，再由独立actor沿goals/commands的固定产物版本接受/拒绝。机械收据passed不是业务接受；模型自报不构成检查。若首合格来源有阻碍，0模型合同/adapter与FLOW/O01/M02统一读口可并行，只有固定可审候选/新预算后才运行provider，旧额度不复用。

## ENG01C 与真实 native 前的两个边界（2026-10-06 11:22）

[ENG01C](../../../engineering-writer-settlement/plans/eng01c-writer-settlement/plan.md)当前只提取内部 writer 的 stopped/unknown 生命周期，复用原 workspace/checker，旧固定 fixture 的 JSON、hash 和行为保持。独立执行身份必须来自宿主真实 assignment：现 HarnessContext 没有 taskId/attemptId，后继需明确 readonly 身份 Interface 及 contracts/runtime 直接消费者 scope；本片不得从目录推断或生成替代身份。

现 checker 在断言进程 import 被测源码并读取同进程 stdout JSON，resources 仅观察直接子进程 close；固定受信 fixture 的既有证据成立，但不能扩成不受信 native 代码的检查真实性或全体写入已停。native 前须选择并验证最小方案：执行前明确可审的源码限制，或隔离被测执行并由宿主独占断言、报告与完整停止判定。定向验收覆盖伪造 JSON/提前退出和残留写入；基线 hash、事后 diff 不能单独代替来源与停止证明。按独立子scope渐进处理，不把通用 OS 沙箱工程当所有工作的前置。

## ENG01D 已实施的下一接缝（11:32:04）

[唯一子计划](../../../engineering-native-seams/plans/eng01d-native-writer-seams/plan.md)在ENG01C已main53ce后，以真实assignment冻结身份及一个Codex ordinary turn生命周期提取解决两个已识别依赖；不复制SDK循环，不从目录生成执行身份。旧profile/hash/readonly和S01多个attempt语义保持。host-applied有限代码仅可作明确中间验证候选，不自动替代用户要求的native工程写改。完整停止、受信检查及实际>=Sol模型来源仍需后继定向证明。
