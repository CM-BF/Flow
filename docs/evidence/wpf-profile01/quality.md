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


## 04:43 UTC 段末 clean-code

范围：7新实现/测试文件。发现并修复：回执schema默认值会补齐缺字段，因此核对时额外比较raw requested/harness/title，避免把缺字段当合法默认；刷新失败保留旧cursor时分页按钮可能可点但无动作，增加由catalog导出的canLoadMore；测试不能用违反readonly类型的赋值模拟突变，改Reflect.set验证冻结；HTTP fixture HTML须经Vite变换、textarea须明确accessible name。保留错误为snapshot、无unhandled Promise，渲染模块不掌握FlowClient/key。

实际13局部tests+typecheck+5HTTP浏览器+隔离生产编译已过。未增加cmdk/状态库或修改原Thread/App。首安装`pnpm install --frozen-lockfile --ignore-scripts`复用449包，根锁未变；@flow/client/contracts解析到本树packages。

本地技能文件SHA256：find-skills c00eeea0e13e74fe4a9d84ba0a8542205a1b736d65f13134fe1a6647eb14976f；codebase-design 2c20617f87ec8af6a434859f381b2f061a69b530444e74eb39e78bb016a6d1e2；clean-code 3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317；AI Elements model-selector reference b483b684512abf2dea82e5867f0a575f7124531925c83a9eefe99e12ceaf1e1b。未重新安装/更新技能。


04:46 UTC review补充停点：GoalOwner明确未来goal/tools类profile不能当普通chat选项，正式合同尚未冻结。未猜测新字段，只给未知占位access做消费者测试：合法none/configured-readonly精确保持，未知由共享schema拒绝、整页原子失败。a28仅增1测试，14/14通过；production与b2零diff。界面与bundle沿用b2证据，不无关重测。缺点保留：未知access导致整页错误而非逐项分类；未来受控合同另片。
