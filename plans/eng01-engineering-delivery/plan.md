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
- [x] **ENG001-02** 固定工程受理/profile、工作区租用与监督检查的小合同，确认可复用接缝、模型门槛及精确scope。
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

## 当前原生前置接收与下一步（2026-10-06 11:51:15 UTC）

ENG01D真实assignment身份与普通Codex turn复用已main。ENG01E独立有限源码语言与host断言模块已独审：只处理一份完整ASCII/2KiB calculator文件、保留完整index/worktree绑定，不import/eval，不接收stdout断言。其Interface只验证调用方提供的集合，真实文件来源和native writer全体停止仍须宿主证明。下一有界片由原worker只读设计完整snapshot→checker→独立版本收据，保留旧fixture v1；之后才接一个显式工程native writer/profile，SDK循环复用且合格模型/预算另定。此顺序与O11公共目标读口并行，不等待完整Web。

## 当前可复用基线与原生写入组合（2026-10-06T12:13:55.672556+00:00）

ENG01D/E/F均已受控main；E只解释完整受限源码，不执行被测JS；F负责受管工作区完整内容集前后绑定与独立flow.calculator-workspace-check.v1收据，writerSettlement明确not-attested。工程fixture profile不自动变native；既有正文/v1校验不扩权。

下一子片ENG01G由native_center_owner在独立engineering-native-writer树领取：ordinary与工程复用一个Codex receive/close pump，受限fileChange策略及EngineeringWriter为两个真实消费者，不复制agent loop。身份来自宿主assignment。缺真实写权限/模型资格/完整撤销依据在transport之前拒绝，注入authority仅证明组合，不证明OS/native已停。file-only为首片有限策略，不是所有工程能力永禁终端的永久规则；后继可以明确受控shell边界，仍须真实停止后检查。Mika持有原生诊断，无重复实验/新增provider许可。真实部署准备独立SVC05，不把已main当个人预览已更新。

参考原生接口输入的权威位置：claude-codex-capabilities/docs/evidence/wpf-mature-02/native-engineering-boundaries.md。实际本机原生能力、>=Sol与真实工程语义验证仍属04/05，不能用mock/关闭的cap结束大task。

## ENG01G接收后的实际接通（2026-10-06 12:29:32 UTC）

ENG01G已main557397；唯一receive/close pump、finite file策略、真实assignment和authority生命周期的0模型组合已独审。它未注册生产authority，不能把小模块通过当原生写入已交付。原ENG001-04下一项为显式versioned工程purpose/profile与可信host授权接入，保持fixture/readonly旧canonical和恢复语义；与Mika唯一Codex诊断共享qualification/settlement事实，不另开重复probe。权限来源缺失仍拒绝执行，但中心合同、入参绑定与公开受理可独立准备。实际>=Sol模型来源、真实所有writer撤销、固定检查及独立actor接受属于05，不用注入revoked标记替代。

## 当前实施接缝（2026-10-06 12:40:26 UTC）

[ENG01H](../../../engineering-native-contract/plans/eng01h-native-engineering-contract/status.md) 承接ENG001-04，唯一writer native_center_owner；15个已领取literal见其权威status，不在父计划复制另一份范围账本。它新增有限原生engineering v2用途、独立profile catalog与受信runner检查收据关联，旧fixture v1和普通只读canonical不变。真实host授权、所有writer撤销证明、>=Sol真实执行与独立actor接受仍归05/06，不以这个0模型中心片完成替代。

## ENG01H接收与宿主编排（2026-10-06 12:59 UTC）

中心v2用途/独立catalog/固定pin及native收据关联已main280289，旧fixture和readonly保持。下一ENG01I在独立树组合G writer→停止/同authority撤销事实→F完整snapshot检查→A receipt→原outbox；不另造loop或资格签发。真实Node/Codex强制权限、>=Sol/no-fallback与全部writer撤销仍消费Mika固定预检，缺失不启用个人服务；本模块先0provider证明组合与未知恢复，真实验收05仍开放。

## 13:03 UTC 当前顺序

ENG01I [唯一准备合同](../../../engineering-native-host/plans/eng01i-native-engineering-host/plan.md)已固定为docs-only候选并释放旧claim，尚无adapter产品改动。该暂停是2026-10-06历史安排。2026-10-07 Connection核心与SVC08限定片已交付后，原worker已fresh领取原六范围恢复宿主组合，独立局部/PG旅程先0provider验证；具体authority/模型/全部writer停止依据仍为ENG001-05真实执行门槛，不作为整个零模型组合前置。Mika唯一资格核验并行，SVC06后继另位推进；不新增资格probe或模型预算、不取消ENG真实写改与独立接受目标。

## I接收后的真实授权宿主（2026-10-07）

ENG01I四产品及两条公开HTTP/PG旅程已mainef3a6de8；它消费可注入NativeWriteAuthority，尚无真实host实现。下一ENG001-04实施owner明确为本队native_center_owner，co-lead负责与Mika冻结输入和最终工程验收。I原四产品先按mainreceipt交回，新宿主在独立worktree/fresh精确scope推进；不因目录出现gpt-6-astra/gpt-5.6-sol就认定实际执行资格，也不把整个实现挂成等待Mika。

最小职责保持R06通信/生命周期、G写入策略、I编排、F完整内容检查和中心收据单一来源。真实authority.open/close须绑定同一task/attempt/runner/profile/lease与有限工作区；选择实际可强制的写入边界，并证明撤销后剩余进程不能继续修改本次内容集。workspaceWrite/requested model、模型自报和直接child close均不是这项证明。受信检查基线/监督器仍不归执行模型写；未知保留workspace/journal、不得重投或签发revoked。不能为绕过缺口新增第二执行器/SDK loop或任意字符串资格。

并行输入与解除条件：Mika只提供其现有固定native身份/能力与来源观察、当前真实缺口；本队负责host实现与OS/sandbox接缝选择，并先完成0provider强制范围/取消/撤销/残留writer及恢复的直接消费者验证。公开目录只作配置候选。需要真实provider证明的实际model/no-fallback与真实源码修改另固定单合成repo、预算和新场景；没有新许可前不query、不改个人profile/服务，不复用旧封存额度。最终ENG001-05仍要求真实合格native改源码、停止后同内容集受信检查、固定diff/证据和独立actor接受；机械绿、注入authority或计划交付不关闭它。

## 本机受信工具路线（2026-10-07）

[J固定比较](../../../engineering-native-authority/docs/evidence/eng01j/helper-host/host-tool-comparison.md)选择原生工作区只读、受信host唯一单文件写FD的最小后继；[K唯一Interface](../../../engineering-trusted-tool-writer/docs/evidence/eng01k/interface.md)已实现取消封门、真实在途I/O收束及同R06 pump异步响应，限定源码42905d01独审通过，非stock工具回调或完整工程成功。下一组合仍由native_center_owner准备精确scope：固定真实只读native factory、单文件host gate、现有snapshot/checker和unknown保留；不加第二执行器，不把直属child close称所有writer撤销。旧fileChange recipe不变；新route必须明确作为受托host写入语义，不能冒充原生fileChange已验。

模型资格的唯一问题已由GO提交用户，见[J状态](../../../engineering-native-authority/plans/eng01j-native-write-authority/status.md)。答复前不签旧locked-no-fallback grant、不启动provider；provider接受配置或目录不证明实际模型身份。Linux/cgroup v2可访问仅环境事实，不意味着专域控制、Linux binary或撤销保证已备齐，保留为替代候选。原ENG001-05真实合格模型、全部写入者收束、固定检查与独立语义接受仍开放。
