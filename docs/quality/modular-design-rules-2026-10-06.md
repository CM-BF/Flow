# 模块化、复用与性能规则交付

观察时间：2026-10-06 09:00:25 UTC。Owner/co-lead：Execution Lead / gpt-6-astra。所属大task：用户明确的全局设计规则更新；执行追踪 OPS-001-10，沿既有唯一管理来源，不另造总计划。

规则源：[根AGENTS](../../AGENTS.md#modular-design)；计划与独审门槛：[plans/AGENTS](../../plans/AGENTS.md)。固定规则提交 `1d36a7a4532bbd2f29300c220d5451f755bd756c`；本文件是交付/方法证据，不是第二份规则权威。

本次本地技能发现确认已有匹配方法，不联网重装。应用 codebase-design 的小 Interface、信息隐藏、依赖接缝与真实消费者，clean-code 的内聚职责、明确命名、无不必要重复及错误处理；用户要求与既有合法scope优先，不机械套20行、参数个数或拒绝null等偏好。

| 已读取本地技能 | SHA256 |
| --- | --- |
| /Users/citrine/.agents/skills/find-skills/SKILL.md | c00eeea0e13e74fe4a9d84ba0a8542205a1b736d65f13134fe1a6647eb14976f |
| /Users/citrine/.agents/skills/codebase-design/SKILL.md | 2c20617f87ec8af6a434859f381b2f061a69b530444e74eb39e78bb016a6d1e2 |
| /Users/citrine/.agents/skills/clean-code/SKILL.md | 3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317 |

对应验收：七条根规则覆盖 Module/Interface/状态与生命周期、DRY的真实概念、注册/组合扩展、渐进重构与claim边界、轻投影/惰性/有界缓存队列并发与背压释放、避免过度抽象、风险相称的设计与独审证据。合法领域状态分支允许，不以if/switch计数评判；拆模块不当性能收益；纯文档不重复工程检查。六个WPF-MATURE计划统一引用根锚点。

校验范围：仅Markdown内容/链接/职责一致性和git diff --check。独立文档review由runner_owner完成：APPROVED固定1d36a7a4532bbd2f29300c220d5451f755bd756c，相对734e97e仅两AGENTS新增23行，七项用户要求与唯一引用均覆盖，无finding。Reviewer未写文件/运行产品测试或模型。本文随受控主线发布；实际发布以Git祖先与唯一status为准。
