# R05B 实施证据

B1仅中心普通task/final。来源输入为R05文档8a148c5f4288d3f3075bf4bde78504b5214c87f3与Mika固定schema/interface b88016914c1e880669db7cb39b73f19980489a2e；本机Codex0.154.0。无app-server/auth/provider运行。

技能发现：按find-skills先检查本地，选用 `/Users/citrine/.agents/skills/find-skills/SKILL.md`、`codebase-design/SKILL.md`、`clean-code/SKILL.md`；brainstorming用于已有授权架构片的职责/取舍核查，用户授权普通实现不重复审批。clean-code来源沿[全局固定基线](../../quality/skills.md)：sickn33/agentic-awesome-skills bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，文件SHA256 3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317，不重复安装。

实际方法：把中心来源/身份规则收敛到小静态Module；通过严格schema和事务Interface测试，旧Claude codec作为稳定兼容面。无任意string注册、第二调度器、额外runtime loop。

| 时间 | 检查范围 | 发现/处理 | 未解决 |
| --- | --- | --- | --- |
| 2026-10-06 09:08 UTC | 初始设计/读取 | runner schema的extend与会话settings是实际消费者接缝；已纳入精确范围。默认目录需SQL前置Claude过滤 | 实现/测试/独审未完成 |

依赖bootstrap：Node v24.20.0 / pnpm9.15.4，独立WT执行`pnpm install --offline --frozen-lockfile`退出0，540本地复用、0下载，manifest/lock无改动。本WT的workspace解析不指向main合同。

2026-10-06 09:13 UTC：首接口与中心代码完成，4个显式文件共11/11（contracts assistant/profile/harnesses与server native policy），tsc退出0。此时PG迁移与旧消费者未验，shared server mount尚未接入。clean-code复核：身份规则只由静态policy维护；Claude保既有会话接受语义，Codex新增精确版本/配置/session绑定；profile目录在SQL前置过滤；已用source窄化旧会话测试，原断言保留。
