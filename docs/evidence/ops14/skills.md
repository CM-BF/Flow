# 2026-10-06 技能与设计应用

Stack：Python 标准库 / POSIX process、signals、nonblocking pipes。按 find-skills 方法优先采用已装本地版本；未安装或联网刷新。

- `/Users/citrine/.agents/skills/find-skills/SKILL.md`：领域发现；已有设计/质量技能足够。
- `/Users/citrine/.agents/skills/codebase-design/SKILL.md`：一个深 Module 隐藏期限、有限输出、停止与错误收束；两真实 caller 支持此 seam，暂不迁移冻结文件。
- `/Users/citrine/.agents/skills/clean-code/SKILL.md`：固定 baseline 方法；命名、单一职责、首失败保留、小 Interface，按实际行为验证。源来源沿 Execution Lead 已固定技能基线，不重复安装。
- brainstorming：本片是已批准的有界提取方向，用户/Lead 普通实施授权优先；不再引入重复确认。

首合同复核：没有把数据库/原始证据/个人服务状态塞入模块；新增一个 ownership 行为需明确有限 enum / tests，不做任意 registry。检查尚未执行。

2026-10-06 21:32:07 UTC 完成交付前 clean-code 复核：Module 仍单一职责，三个 DTO / 两个 private 实现 helper；无 callback / 持久 I/O / DB 责任泄漏。两故障红暴露真实 Darwin zombie 观察语义与测试对 signal / ownedState 混淆，已分别修复；未知观察只阻信号，不能伪造 absent。原 Source / stderr 与两个受控 wrapper 形状分别保存；真实 consumer 迁移仍 open。
