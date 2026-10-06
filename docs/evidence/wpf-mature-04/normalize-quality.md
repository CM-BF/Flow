# Claude summary 纯归一化交付自查

2026-10-06 11:20:53 UTC；owner architecture_read / gpt-6-astra，四源起点 `9f9bb00e263b8517a036822f74ae65ce94b86200`，v6 COMMITTED 后实施。独立批准待新固定 target，不沿用旧 3ab approval。

按 [统一模块化规则](../../../AGENTS.md#modular-design) 与本地 find-skills 方法选择 `/Users/citrine/.agents/skills/{find-skills,codebase-design,clean-code,brainstorming}/SKILL.md`。clean-code 固定 sickn33/agentic-awesome-skills `bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5`，本地 SHA256 `3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317` 已复核；无安装。brainstorming 采用已获 Mika 明确批准的有界提取设计，不扩展授权。codebase-design 用单一小 Interface 隐藏数值与类别验证；clean-code 检查职责、名称、错误次序、重复和公开行为。

`normalizeClaudeSummary(response, expectedResolvedModel)` 是唯一 SDK summary 数值归一化 Module。SDK 仅 type import；expected 是 host resolved model，不能传 requested alias。先验证 model、totalTokens、rawMaxTokens、categories，再按 null identity 丢弃测量；已知 model 不符抛原错误。返回 detached 的 resolvedModel/used/compactionWindow/kind totals，null 情况全未知且 categories 空；无 refs、host identity、provenance、全文或 IO。最多 32 输入行、4 个固定 kind，总和保持安全整数；O(rows)，没有持久状态或资源。类别合计不替代 totalTokens，rawMaxTokens 只代表 policy window。

旧 mapper 继续先校验 host、attempt/nativeSession/summary，再调用 helper；保持 `claude-summary-*` ID、顺序、SDK estimate provenance、hard-limit unknown、compression not-observed、unknown 原因和拒绝行为。旧 26 项断言逐字保留，新增一项 null-host 非法响应回归；新 helper 8 项、mapper 27 项、直接 projection 23 项，共 58 不同用例。初轮与末轮重叠不累计；初轮 strict 因合成响应漏 SDK 必填 apiUsage 字段 exit2，补齐实际类型字段后末轮 exit0，未放宽根 strict/ES2023/noUnchecked。首次 raw 保留供审查，不算最终源码通过证据。

末轮 Node v24.20.0 / pnpm9.15.4 / Vitest4.0.18，3 个显式路径58/58；6根文件及import闭包的严格noEmit0。纯getter负面测试确认未读取私有字段；固定fixture输出<512B，不以此声称整体吞吐/容量。0 SDK运行/采样/emit/provider/PG/auth/新service。未改claude.ts、union、events、index或server算法。

9ac domain 的10源及历史raw/support/manifest和history-integration-ready.json不变，仍供Lead按固定9ac接收。旧3ab的mapper批准及旧manifest绑定历史Git；本次两个mapper源码已改变，不能再把它们称为现场等于3ab或新源码已批。新target只接受本4源独审；完整producer、current/remaining/cut与Web仍开放。无自查剩余阻断，独审待执行。
