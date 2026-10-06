# 技能与质量

2026-10-06 08:48 UTC 启动：按 find-skills 方法优先发现已有本地技能，无新增安装。使用 `/Users/citrine/.agents/skills/` 下 find-skills、brainstorming（采用已经批准的二十范围方案，不重复审批）、assistant-ui、codebase-design、clean-code、vercel-react-best-practices、webapp-testing；此前相同 stack 的 frontend-design/ai-elements 记录复用。clean-code 安装来源固定 sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，未重复安装。模型由派发指定 Astra Ultra，未声称额外运行时型号 API 证明。

实际方法：保留官方 Thread 与 ExternalStoreRuntime；同一 outbox 创建键 / P01 host 为权威；深模块封装绑定与选中代际，不向插件公开 FlowClient。测试跨公开接口，真实 App fixture / 原始日志与独立审查分列。约三十分钟或工作段安全停点再复核命名、职责、错误、重复、无必要复杂度。

启动 clean-code：已发现旧 onNew 异步 MessageNotSentError 可 prepend 旧稿；设计改为确认同步新 receipt 后由独立 receipt 呈现网络失败，不在旧 ACK 清新稿。create-only 使用显式判别类型，不以 null 假 turn 充数。当前尚未写产品或运行检查。
