# COST01A 方法与质量记录

2026-10-06 13:56–14:00 UTC，assignment_review / gpt-6-astra。

- stack：Node24、TypeScript、PostgreSQL、Fastify。按 find-skills 先本地发现，复用 `/Users/citrine/.agents/skills/{find-skills,codebase-design,clean-code,tdd,brainstorming}/SKILL.md` 并实际读取；已有匹配技能，无重复安装。
- clean-code 安装来源固定 `sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5`；文件内部 attribution 为 ClawForge，不能把内部归属和安装仓库混称。应用命名/单一职责/错误和 unknown 明确/不重复累计规则。
- codebase-design：一个公共读口隐藏累计与覆盖解释，传入 Pool，生命周期仍归 server；写账本保持唯一。tdd 走已授权公开 HTTP/真实 PG seam，定向 red→green，不新增批准流程。
- brainstorming：本片属于已授权有界既有数据投影，设计与取舍先固定；用户/Lead 明确授权实现，无需再询问普通方案。
- 当前发现：samples 有缓存原值但旧 totals 无缓存；需要共享基线 seam 防止重复规则。readout 不读取正文以追溯 SDK 版本，未存版本就 unknown。Codex authoritativeSources 为空，不能借模型名扩权。
- 尚未实现/测试；0 provider、0网络安装。官方网页只对照当前文档，固定 SDK 声明优先；不以估价作账单。
