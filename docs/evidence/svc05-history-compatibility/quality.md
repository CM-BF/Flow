# 方法与质量记录

2026-10-06 15:36 UTC，assignment_review / gpt-6-astra。Stack：Node24/TypeScript/固定 Fastify-PG 历史投影；本次 source-only 接收已审改动。

采用已安装本地 find-skills → codebase-design → clean-code，无安装/联网搜索。技能路径分别 /Users/citrine/.agents/skills/find-skills/SKILL.md、codebase-design/SKILL.md、clean-code/SKILL.md；既有 clean-code 来源 sickn33/agentic-awesome-skills 固定 bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，沿原来源记录，不更新。技能实际文件 hash 见 manifest。

实际应用：保持深模块现 Interface 与事务所有者，三行分支不另造材料 DTO/状态机；不能把未支持的 v2 材料子集伪称完整；精确复用已审测试，不复制新 runner/浏览器循环；区分输入固定与行为验证、内容逻辑字节与资源余量。已核两源码/18直接输入及原 10 raw 绑定，锁和所有其他产品源零差。发现 Web 新绑定 guard 与两文件候选不一致，已给 Lead 协调原 owner，不越范围修其代码。

未解决：候选未运行（授权/资源限制）；Vitest 入口未核；依赖闭包只读取16 manifest，不冒 import/启动；Web新guard与新tuple待其独立冻结。无新性能收益声明，未触个人配置/秘密/服务。

2026-10-06 15:39 UTC 收口复核：独立预审原文/hash已归档，无产品写入；复用 server manifest 声明的八个第三方运行依赖 + root tsx，省略与候选 factory 无关的七个 dev/浏览器入口；唯一 workspace alias 本候选 contracts。写入前确认目标 package.json/hash，拒绝已有 node_modules/既存链接；写后只核 lstat/readlink/realpath/hash，未 import。10 链接清理职责与 unknown 保留条件明确。未安装、未复制包、未增业务状态，A/B 保持未验。
