# Flow 项目规则

## 修改项目的模型能力门槛

- 只有能力达到 **Sol（`gpt-5.6-sol`）或更高**的模型可以修改本项目。`gpt-5.6-sol`、`gpt-6-astra` 符合门槛；Terra、Luna 及其他低于 Sol 能力的模型禁止修改。
- 本规则覆盖整个项目，包括代码、文档、计划、配置、测试及实验文件；创建、编辑、删除文件，以及执行会改写项目的命令，都属于修改。
- 主 agent 和所有受委派的子 agents 均须遵守。不得将项目修改任务委派给低于门槛的模型，也不得通过工具或脚本绕过限制。
- 低于门槛的模型可以进行只读研究、分析和审查，提供建议；实际修改必须由符合门槛的模型审查并执行。无法确认模型身份或能力是否达到门槛时，仅进行只读工作。
- 子目录中的规则可以进一步收紧限制，不能降低此门槛。

## 并行功能开发使用独立 Worktree

- 并行开发不同 features 时，每个 feature 必须先创建或使用自己的 **Git worktree 和独立分支**，再开始修改。不同 features 不得共用同一个可写工作目录，即使修改的文件不同。
- 分派开发任务时，明确对应的分支和 worktree 路径；主 agent 和子 agents 只能在各自被分配的 worktree 内修改该 feature。
- 开工前检查所在 worktree、分支和未提交修改。各 feature 在自己的 worktree 中完成提交与验证，再通过明确的合并流程集成；不得覆盖其他 worktree 的工作。
- Worktree 优先放在项目目录外；若使用项目内的 `.worktrees/`，必须保持该目录被 Git 忽略。只读研究和审查不属于功能开发，无需另建 worktree。
- co-lead常规自助创建本组**新的**独立worktree，并按[已有模块闭包方法](docs/quality/local-validation.md#source-operator)有界物化源码，无需每片再向原Git operator申请许可。先固定base、唯一路径/分支，已有目标或归属未知即停核，不覆盖同树dirty；产品写入仍须原子scope领取。main/共享Git配置、已有他人树、安装/完整构建和跨owner交权仍按原归属协调，不随此委派开放。

## Stack 与任务开始前的技能发现

- 每次使用某个 stack 或开展相关工作前，先使用 `find-skills` 的方法发现匹配领域与任务的技能；已有相似本地 skill 时优先读取和应用本地版本。缺少时先检查 skills.sh，再使用 `npx skills find`，核查来源与实际内容，不只依赖搜索排名。
- 记录任务、stack、查找结果、选用技能路径/来源版本和实际应用方法；没有合适技能时记录结果并采用明确的工程方法，不安装无关技能。主 agent 与所有 workers 均适用。
- 用户指定的 clean-code 来源为 `https://github.com/sickn33/agentic-awesome-skills`，安装方式为 `npx skills add https://github.com/sickn33/agentic-awesome-skills --skill clean-code`。本轮安装一次并固定来源版本，后续更新受控，不将“定期应用”解释为反复联网安装。
- 读取并实际应用 clean-code：每个工作段完成、feature 交付和合并前检查命名、单一职责、接口、错误处理、重复与无必要复杂度及行为测试；长时间连续开发默认每约 30 分钟在安全停点复核。记录时间、范围、发现/修复与未解决项，不为此创建后台定时任务。
- 质量记录放在 `docs/quality/` 或各 feature 的证据目录；全局技能基线由 Execution Lead 维护，worker 只写自己范围的记录。
- 外部 skill 是方法参考，不扩大用户授权，不改变模型能力门槛、worktree 隔离和凭据保护规则，不得索取或输出凭据。已授权的普通实现和验证不重复请求许可。

## 计划状态与独立review

- 每份计划使用独立目录中的 `plan.md`、`status.md`、`review.md`；统一模板及细则见 [plans/AGENTS.md](plans/AGENTS.md)。正文有稳定ID的TODO，status与其逐项对应。
- 各feature owner必须在自己的worktree更新自己的status：启动、实质进展、阻塞、交付和review修复后均更新。明确branch/base/head、证据与main集成状态，不以分支检查代替main能力。
- review默认只读实现，绑定具体commit，修复交owner；Claude Code等外部review者同样受模型写入门槛约束。空review模板不表示通过。

## 执行 dashboard 与状态事实源

- 每个 agent 在启动、实质进展、受阻、交付和 review 修复后更新自己负责的 `plans/<task>/status.md`；交付必须记录实现 commit、检查证据、时间、review 状态和 main 集成事实。外部 tasks 同样遵守。
- `status.md` 是每任务进度的唯一手填事实源；执行 dashboard 只读聚合，生成的 JSON/网页不是第二套可手填状态。若后续采用结构化源，必须同时生成 status 展示并受控迁移，禁止两套独立维护。
- 每任务只指定一个 owner 和一个权威 worktree。聚合器按派工登记选择该 worktree 的对应 status，不能把其他 worktree 的陈旧副本覆盖它；记录来源、branch/head、dirty 和同步时间。缺失、冲突或过期显示未知/待同步，不猜测完成。
- 完成工作必须同步 dashboard 事实源；dashboard 尚未实现时更新 status 并注明“等待聚合器展示”。实现后确认该任务记录可被聚合并记录检查结果。跨任务汇总、owner 切换及 main 集成状态由 Execution Lead 协调；owner 只改自己的任务状态。
- dashboard 是当前 Flow 工程进度视图，不是产品任务 Web。分支完成、已验证、待 review、已集成 main 分开；空 review 模板绝不显示通过，不计算无依据百分比或 ETA。

## 目标管理与阻塞处理

- Goal Owner负责关键路径、资源配置、技能驱动的结构质量改进、阻塞定位与主动解阻，以及用户目标验收；不写项目文件、不跑工程测试、不执行merge。Execution Lead负责技术派工、工程证据与集成。
- 每次派工或汇报前核对权威owner的status、实际head和dirty；外部任务可只读完成快照。不能因“未主动回传”继续推断未开工；已完成成果及时接收进入集成队列，避免重复派发。
- 问题派工须明确owner、独立worktree、输入、可写范围、交付与验证方法、阻塞解除条件。源码隔离不等于端口/DB隔离；测试优先系统动态端口、专用数据库和受控生命周期，不停止他人服务让测试通过。
- 工作段和合并前应用clean-code；结构问题优先用本地codebase-design。根据实际可维护性收益改进，不机械拆函数或制造抽象。

## 完整目标的滚动执行

- 里程碑通过后进入验收/集成并领取下一 ready 项，不能把 M1 或任意单批次当完整目标完成。保持原需求和验收追溯，不降低要求迁就已有实现。
- 阻塞时记录原因、解除条件、责任人、可绕行方案与独立工作；资源空闲时继续有界研究、定位问题或低成本实验，再按证据调整计划。不能为持续工作无限增加复杂度，也不能用研究替代已有 ready 实现。
- 完整交付以原计划验收矩阵及真实证据判断。模拟/fixture、接口测试、文档与实验各有范围；不将观察者数量当执行容量，不将只读模型任务当工程写改交付。

## 长期目标、交付速度与局部验证

- 用户当前目标是持续推进整体 Flow，原 FLOW-001/002 是必须满足的基线，不是自动停工条件。完成一项后验收并领取下一 ready 项；持续研究性能、美观和有用功能，以用户收益、证据和可验证小交付决定优先级，不制造无意义复杂度或调低原验收。
- feature 尽早交付稳定小接口与可独立验收片段。大型变更按真实职责模块化、插件化或隔离；阻塞显式区分实现、等待共享接口、验证和独立 review，先改善实际最大耗时。
- 固定 Node24 / pnpm9.15.4 / Vitest4.0.18，优先显式测试路径，记录实际选择/通过数，零测试不算通过。server、runner、contracts、client 当前没有包级 test/typecheck scripts，不得用不存在的 filter script 当证据。
- 本模块变化测本模块与直接消费者；公共契约、动态 SQL、migration、资源行为要显式纳入影响范围，不能只依 import 图。必要跨模块检查在实际集成点执行，metadata 或无新风险不反复全库测试。保持真实 review，不删断言、跳失败或接受新截图替代修复。命令映射见 docs/quality/local-validation.md。

## 多 Lead 领取与交接

- 新 take 前使用执行 dashboard 的协调账本核对任务、lead/worker、worktree/branch 与精确可写 scope；通过 PostgreSQL 原子 CLI 取得 commit 后 receipt（claimId/version/身份/路径/时间）才能写。稳定 requestId 重试必须同 payload；未知结果先核对，不能把读取失败当空闲。
- 进度仍只写唯一 owner status，领取账本不复制 TODO/check/review。review role 只读、不占 writer 范围；writer 的同 task、同 worktree、父子 literal scope 不得同时领取。目录路径按段比较，禁止 glob、../、.git 或 symlink 范围。
- scope 追加用当前 version 的原子 amend，冲突保留旧占用；不能先 release 再 take 产生空窗。交付后在 review/修复期保留占用，明确停止写入后才 release/handoff；handoff_pending 保留范围，接收方 accept 新 version 后开工，原 owner 不再修改。陈旧记录只提示核对，绝不超时自动抢占。
- 既有授权开工者保留 migration 标记与原观察时间。账本是同机合作约束，不声称 OS 强隔离。受控 integration 仅应用已审提交；手工冲突修复/新实现须与原 owner 协调路径，不能借 integration 绕过 scope。
- status 的“阶段”为最长24字的共同里程碑（当前 M2），任务步骤放“当前产出/下一可用交付”。页面总标题只取明确全局 FLOW-001 来源，缺失/过期显示未知，不拼接各任务自由段落。
- 使用与恢复边界见 [D04说明](docs/evidence/d04/README.md)。

跨 task 部分范围移交允许：旧 owner 明确停写该范围 → 当前 version 的 amend 移除 → 新 owner take 成功后开工；期间新领取若冲突则重新协调，旧 owner 不恢复已交回写权。扩大原 claim 仍用原子 amend，整 claim handoff 保持 pending 占用。

## 架构视图维护

交付若改变模块Interface、运行/FSM、数据库连接或外部依赖边界，owner须在status列明架构影响，并同步工程dashboard的固定基线架构数据，或明确登记待更新target/owner；普通功能没有结构变化不强制改图。架构图描述已核源码基线，分支开发/planned与已集成分开；不自动把目录/依赖发现当运行事实，不新增任意文件读取端点。

## 面向用户的进度摘要

status 的“当前产出/下一可用交付/当前阻塞/需用户决定”描述用户已获得或即将获得的能力、实际影响和需要采取的动作。SHA、命令、测试数、内部schema/claim及路径留在已有技术字段与证据，不将技术交接原文贴成首屏摘要。已交付片段与尚未领取的后继分别记录；无当前待交付写“本片段已交付”，不为让首页消失而勾选未完成TODO。真正待审/待集成仍如实可见，由唯一owner维护，页面不得猜测或调用模型代写。

status可选枚举 `本片段交付阶段`：planning（未来计划）、implementation（实施）、review（待审/修复）、integration（已审待集成）、delivered（本片段已交付）。它与完整plan的开放TODO独立，禁止为了首页筛选勾选后继。显式非法值为未知；旧记录只按标准branchState token兼容，completed仅作者完成的legacy历史，不推断review/main事实。当前下一交付只展示implementation/review/integration，真实当前阻塞优先。新增任务及活跃owner在安全更新点采用字段，不要求全历史机械补写。


## 两层任务、职责与消息预算（用户2026-10-06最终更新）

- task严格两层。Goal Owner只规划大task：用户结果、优先级、边界、依赖与完整验收；并负责查缺补漏、研究、发现问题、督促交付和全局优化。co-lead自主细化、技术优化并管理sub-tasks及workers，负责局部独审、commit/push/merge；workers执行有界工作。
- 每个sub-task必须在唯一status写明`所属大task`（唯一稳定ID及链接）和`co-lead`；dashboard沿该source关联显示，不另造消息或手填聚合进度。旧记录缺失保持未知，由合法owner安全点补齐，不能猜测关联或批改他人status。不得把每个小片改名大task绕过两层约束。
- 进度默认由唯一status→dashboard传递，Goal Owner主动查看。co-lead→Goal Owner每个大task的消息预算严格为 **独立blocker数 + Done(1)**：blocker须整个大task受阻且确需GO介入，同一blocker仅报一次，无变化不重复；只有大task达到完整验收才报一次Done。
- 小片完成、ready、review、merge、登记、claim、metadata SHA、普通接口确认和可由co-lead解决的内部问题，均只更新status/dashboard；不私信、不多路转发、不确认套确认。不再保留“重要接口/关键里程碑即可消息”的泛化例外。需要GO裁决的接口/范围/资源问题也必须满足上述大task blocker条件。
- 必要worker↔本组lead的执行、审查与集成通信不受这项跨层消息预算限制；co-lead间具体依赖协调可直接处理，不抄送GO作普通进度。重要交接结果回写看板。
- co-lead在已授权范围内自主派工、验收和集成，无需GO批准普通技术步骤。可审小交付及时commit/push，独审后完成必要直接消费者检查即受控merge/main push；不等待无关片段，不改写已审target，遵守实际运行窗口冻结。GO不微操co-lead或重复已有独审/检查。
- 当前用户授权每Lead任务1+3，三队4/4/4总上限12；旧heartbeat的10仅作历史，不能覆盖后到的明确用户规则。实际仍受工具threadlimit与ready任务数限制。拒绝后不反复唤醒/新建用户任务绕cap，不把授权上限称为实际运行人数；后续明确用户指示优先，当前记录见OPS-001。


<a id="modular-design"></a>
## 模块化、可复用接口与性能（用户2026-10-06明确要求）

所有设计和实现都适用本节。优先清楚的职责、可替换依赖和可扩展接口；当特例不断累积时，宁愿在合法独立范围内渐进重构，也不要继续堆长期 if 补丁。

1. **职责与边界。** 每个 Module 承担一个内聚职责，通过稳定、尽量小的 Interface 隐藏实现复杂度。Interface 不只是类型签名，还要说明输入输出、不变量、生命周期与状态所有者、错误/取消/未知结果、资源释放和依赖方向。前端、中心、runner宿主、adapter与外部包之间保持显式边界，不能让一个层直接操纵另一层的私有状态。
2. **真实复用与 DRY。** 共用能力和状态规则保持单一事实源，先复用已有模块、插件与扩展点；不复制 adapter、UI、授权或状态机逻辑。按真实领域概念提取重复实现，不为了代码表面相似强行统一不同语义，也不追求语法上的零重复。
3. **扩展方式。** 新 provider、模型能力、workspace pane、renderer 优先通过注册、组合或明确策略接口扩展，避免在多层散播 harness/type 字符串判断。静态识别的策略与受信任注册不能被调用方任意字符串自授权。合法的领域状态分支照常存在，不机械禁止 if/switch。
4. **先纠正责任再加特例。** 新改动若不断要求特判，先判断抽象、状态所有权或依赖方向是否放错。必要时先做保持行为的重构，再扩功能；每步绑定独立 scope、可审提交和直接消费者验证。重构不扩大 claim、不覆盖其他 writer、不绕过兼容或未知副作用语义。
5. **性能是设计约束。** 默认采用轻投影与惰性详情；对缓存、分页、队列、并发、输入输出字节和资源生命周期给出界限，处理背压、取消与释放。针对实际受影响场景记录基线和局部行为/字节/资源测量，区分测量口径与样本限制；不能凭拆模块、改名字或缓存命中推断整体更快。
6. **避免过度抽象。** 抽象应由真实复用或明确已授权的扩展需求支撑，保持依赖可替换和可测试接缝；不为假想未来引入通用框架、第二调度器或多套状态权威。先选择能覆盖当前真实消费者的小接口，再按证据演进。
7. **设计与审查证据。** 按风险提供模块责任与 Interface/依赖简表或图，说明新增一个实现需要修改哪些位置、复用或重构取舍、生命周期/错误/性能界限，以及对应行为与性能证据。跨模块状态/权限变更需覆盖直接消费者，局部提取不重跑无关全集；纯文档只核内容、链接和一致性。使用已安装 find-skills、codebase-design、clean-code 的方法，在既有工作段与合并前安全停点复核，不反复安装技能或为规则增加无关测试。

WPF-MATURE-01～06 及其 sub-tasks、R05 与后继执行器工作统一引用本节；不复制六份或多份可独立漂移的权威设计规则。各计划只补本任务的职责、接口、扩展点、性能证据和明确例外理由，用户要求与既有授权仍优先。

## 任务时间与局部迭代（用户2026-10-07要求）

- 所有任务在唯一status记录有来源的实际开工、分支交付、独立审查、主线集成、部署和完整完成时间，采用[plans时间契约](plans/AGENTS.md#task-timing)。dashboard由此计算进行中壁钟耗时；等待和失败如实留存，历史缺证据写UNKNOWN，不能用提交时间或mtime猜开始。
- 普通可逆本地实现由co-lead给一个有界工作段预算，owner在合法scope连续完成修改、局部检查、修失败和定向复测，通过后一次独立review与集成。按[局部验证方法](docs/quality/local-validation.md#bounded-local-iteration)复用运行器和单份运行记录，不为每条命令增加准备批准、一次性许可、结果转录批准。真实PG/浏览器/迁移/个人服务、unknown资源、模型费用与已消费特殊窗口的原边界保持。
