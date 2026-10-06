# P03 技能/结构与质量

2026-10-06T03:52Z：任务stack为TypeScript/Node24、A2A1.0 JSONRPC、固定SDK1.3.0、Vitest4.0.18和PostgreSQL consumer。按find-skills方法优先发现本地适用技能，未安装无关技能/未重复安装clean-code。

- /Users/citrine/.agents/skills/find-skills/SKILL.md：前段已完整读取；本段匹配本地codebase-design/clean-code/tdd，记录应用。
- clean-code：/Users/citrine/.agents/skills/clean-code/SKILL.md，指定sickn33/agentic-awesome-skills来源bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，沿用全局固定版本。检查命名、接口最小变化、错误与资源清理、重复和行为测试。
- codebase-design：/Users/citrine/.agents/skills/codebase-design/SKILL.md，保留snapshot小Interface和RequestOptions，显式selection表达协议字段，不新增抽象Adapter。
- tdd：/Users/citrine/.agents/skills/tdd/SKILL.md，已读tests.md/mocking.md；已授权Seam为官方SDK HTTP与真实runner/center。每片先红后绿，内部不mock，保留真实失败/退出码。
- brainstorming本地方法已用于有界方向确认，正式派工已授权设计，不重复索权。

官方语义核验：[A2A1.0 §3.2.4](https://a2a-protocol.org/v1.0.0/specification/#324-history-length-semantics)，查询日期2026-10-06。不设/0/正数严格区分；SDK源码optional0序列化不能替代实际wire证据。无本地GLOSSARY/额外AGENTS；遵守根及plans约定。

2026-10-06T03:59Z 完成段复核：六个精确领取文件，生产只增加兼容snapshot选择与Runner两处协议字段；保留RequestOptions、默认observe、permit/cancel/lease/material边界，不制造适配层。测试通过公开HTTP与真实进程/PG验证；新fixture采样器和version断言两次错误已修正且保留失败。命名/职责/错误处理/重复/复杂度复核无待处理项。独占DB名称为进程号与随机UUID，创建成功才清schema，finally关闭admin连接。21不同用例、局部类型检查已过；独立review见任务review。
