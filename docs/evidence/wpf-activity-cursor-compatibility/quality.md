# 技能与质量记录

2026-10-06 07:01 UTC：按 find-skills 方法确认本任务为已有 TypeScript reader 的有界行为修补，本地已有适用技能，优先读取，不安装/联网找重复技能。

- find-skills: /Users/citrine/.agents/skills/find-skills/SKILL.md，SHA256 `c00eeea0e13e74fe4a9d84ba0a8542205a1b736d65f13134fe1a6647eb14976f`。
- codebase-design: /Users/citrine/.agents/skills/codebase-design/SKILL.md，SHA256 `2c20617f87ec8af6a434859f381b2f061a69b530444e74eb39e78bb016a6d1e2`。
- clean-code: /Users/citrine/.agents/skills/clean-code/SKILL.md，SHA256 `3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317`。
- brainstorming: /Users/citrine/.agents/skills/brainstorming/SKILL.md，SHA256 `74edf03ea6d24ef53db48677b93558d14a979bdf052ca3f57ecdca0c66791608`。

应用：codebase-design 复用 ActivityPort seam，测试真实 reader 不另抽复制校验器；clean-code 保持局部验证职责、明确 scan cursor 与 returned cursor 区别，先行为红再绿。brainstorming bounded 设计已由 GO/root/Lead 明确授权且领取，不重复询问。clean-code固定安装来源 sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5；现文件内部来源标记为ClawForge，与安装仓来源分别记录。

开段发现：旧 nextCursor=max(after,last returned) 与已确认的过滤协议冲突；旧reset仅after非零仍不足，需after>watermark。计划局部修正，其余冲突保护保留。交付前再核单一职责、边界与实际失败/修复证据。
