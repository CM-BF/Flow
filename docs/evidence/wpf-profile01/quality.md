# 技能与质量记录

2026-10-06 04:37 UTC。任务由 gpt-6-astra / ultra 派发，运行上下文 GPT-6；仅已领取独占工作树。按 find-skills 先查本地：本任务 React/TypeScript、现有 FlowClient HTTP 目录、受控表单；已有相似技能，无新增安装。

- `/Users/citrine/.agents/skills/find-skills/SKILL.md`：本地优先发现。
- `brainstorming/SKILL.md`：复核已由 GoalOwner/manager 批准的有界模块设计，不重复索取批准；项目指定 plan 位置及 scope 优先。
- `codebase-design/SKILL.md`：把分页/中止/错误集中在目录接口，把冻结与 ACK 核对集中在输入模块；Picker 无网络/命令副作用。
- `clean-code/SKILL.md`：来源 https://github.com/sickn33/agentic-awesome-skills 固定 bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5；每段与交付查命名、职责、错误、重复和可观察行为。
- `ai-elements/SKILL.md` 与 `references/model-selector.md`：来源 vercel/ai-elements 6a9d5b1822ffb10bba4bd97175f01edd7d8651cd；读过 cmdk palette，但本合同选整份配置、分页无全局搜索且4e无cmdk，因此使用已有 Dialog/Button+native radio，避免虚构 model controls、依赖/remote logo。不声称复制该 ModelSelector。
- `assistant-ui/SKILL.md`（之前同任务上下文已读，固定 assistant-ui/skills 139674dc888ee076982b6726e8e6f5d0fe0b5f67）：本模块不替换官方 Thread/composer，留窄接口给原 owner。
- `vercel-react-best-practices/SKILL.md`、`frontend-design/SKILL.md`：稳定订阅/不可变snapshot、无新增全局状态库，延用 Flow 主题与克制对话框；双主题390键盘证据待执行。
- `webapp-testing/SKILL.md`：DOM先观察再操作、独立HTTPfixture、记录错误/截图。采用仓库已有 TypeScript Playwright 栈与动态端口生命周期，不增加 Python/额外配置文件。

首次 clean-code 停点：设计避免同名 model 去重丢 runner、unknown ACK 依赖不存在 summary、通过可变 catalog 重建 receipt payload 三类风险；尚无实现/测试结论。
