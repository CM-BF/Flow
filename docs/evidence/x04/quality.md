# X04 方法与质量

2026-10-06 06:07 UTC，assignment_review / gpt-6-astra。Node/TypeScript 文件流与npm包元数据。按find-skills本地优先实际读 /Users/citrine/.agents/skills/{find-skills,codebase-design,clean-code,tdd,brainstorming}/SKILL.md；本地工程技能匹配，未安装无关技能。clean-code沿固定sickn33来源 bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5。

已授权方案来自runner_owner只读proposal（native-activity/docs/evidence/chat05/quality.md）与Lead具体派工。应用：一个小Interface隐藏来源限制、重试staging与发布；公开模块行为红→绿，真实pacote loopback作独立适配器验证；先try/finally资源生命周期，错误不返原始URL/堆栈/凭据。交付前复核命名/单责/接口/错误/重复与不必要复杂度。

官方固定来源已实际浏览：https://raw.githubusercontent.com/npm/pacote/v21.5.1/README.md 、https://raw.githubusercontent.com/npm/ssri/v13.0.1/README.md；并只读本机npm bundled pacote21.5.1/lib/{fetcher,remote,registry}.js，不作为产品运行依赖。确认tarball.stream callback可因内部损坏重试重入，fetchRetries:0不能禁止这一重试，必须每次独立file/hash；拒绝所有redirect以避免跨来源。共享依赖请求已发Lead。
