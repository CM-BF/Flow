# 技能与 clean-code

2026-10-06 03:08 UTC：按 find-skills 本地优先发现并读取 `/Users/citrine/.agents/skills/find-skills/SKILL.md`、`vercel-react-best-practices/SKILL.md`（含 content-visibility / defer-reads 规则）、`webapp-testing/SKILL.md`、`clean-code/SKILL.md`。已有本地适用技能，不重新安装。clean-code 固定来源 sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，保持已有基线；其他本地 skill 版本未通过新联网安装推算。

应用：生产性能先采样后建议；content-visibility 不当 DOM/heap 上限；Playwright 做真实页面动作/截图/异常收集，沿仓库 TypeScript 工具，不因 Python 示例改栈。clean-code 检查 fixture 只负责合成契约，probe 只负责运行/采样/报告；错误不隐藏，不以庞大测试框架替代两份有界脚本。

启动检查：固定 M02 基线与新 claim 4 个 literal scope 已核，无原有改动可覆盖。本段无生产优化，不把已批准方向再次送设计审批。每段完成/约30分钟安全停点/交付追加实际发现与修复。
