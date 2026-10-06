# SVC05 方法与质量

2026-10-06 12:16 UTC：按find-skills本地优先读取 `/Users/citrine/.agents/skills/find-skills/SKILL.md`、`codebase-design/SKILL.md`、`clean-code/SKILL.md`、`webapp-testing/SKILL.md`。Node/PG/Playwright/本机发布任务已有匹配方法，不安装技能。clean-code沿固定sickn33来源bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5。

实际应用：发布权威留在现有工具；实验只观测固定组合和受控fault。读取/构建/HTTP/浏览器/证据清理分职责，既有纯模块复用。networkidle替换应用ready locator，不在SSE上等待网络空闲。证据先checkpoint后不可恢复清理；秘密只允许合成值进入wire。首段范围/命名/依赖检查完成，暂未工程验证。

2026-10-06 12:21 UTC：本段为已授权有界兼容实验，复核brainstorming的方法；沿既定设计/Lead确认继续，不为普通方案另造审批。发现并修正实验namespace长度（第1次在建库前失败）和异步claim需等待真实受理（第2次失败）；原stdout/checkpoint保留，均自有资源清理完成。不是产品缺陷。当前只跑固定组合，不扩未完成附件App交付。

2026-10-06 12:24 UTC 交付前clean-code/codebase-design复核：四私有模块分别负责只读inventory、HTTP观测、隔离生命周期、真实App旅程；发布/数据库/runner权威仍复用生产模块。检查0provider入口、合成凭据不进wire、请求/响应收集界限、checkpoint先于不可恢复清理、自有资源清理和原key/body断言。没有新增公共框架/依赖。第3次排序比较修成全部旧字段匹配，第4次修正project公开receipt的snapshot层；原失败均保留。最终源hash与run-5完全一致；4模块语法检查及diff-check exit0，未跑无关全集。未解决范围：真实个人部署、用户数据fresh gates、后继App附件、窄屏全面布局均未验收。
