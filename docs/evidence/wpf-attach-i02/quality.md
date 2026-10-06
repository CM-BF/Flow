# 技能与 clean-code

## 启动 2026-10-06 12:08 UTC

任务 stack：React19.3、assistant-ui0.15.23/core0.3.22、TypeScript、P01/FlowClient。按 find-skills 先核本地已安装技能，路径与内容 hash 见 [skills.json](skills.json)。已有相似本地版本，未联网重装；clean-code 来源 sickn33/agentic-awesome-skills，沿全局既有固定安装记录。实际重读 find-skills、assistant-ui、codebase-design、clean-code；复用前段已读 brainstorming（已批准设计）、React best practices 与 webapp-testing 方法。

应用：将材料不可变规则集中一处，由真实 Outbox/Queue 调用；binding 隐藏 private client/授权/取消，P01 是唯一生命周期。错误不吞成 unsupported，未知回执不换 key。分段测真实消费者，不复制 decoder、不改 protected 模块。约30分钟安全点以及交付前复核命名、单责、接口、重复、错误和资源释放。

官方参考：[attachments](https://www.assistant-ui.com/docs/guides/attachments)；官网可能新于安装版本，实际 API 以固定0.15.23/0.3.22源码为准，不升级。官方 composer async preparation 风险通过同步 submission capture 和 local receipt handoff 验证，而非修改 runtime。

本段 clean-code：计划边界/状态所有权与受控 scope 核对完成；尚未编写或测试产品源。未解决：完整 App 路径须下一阶段 amend，后续必须实际 HTTP/生产 App 验证，不把首段当完成。
