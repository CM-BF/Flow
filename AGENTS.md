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
