# 技能与质量

2026-10-06 05:02 UTC，本任务Node24/ESM聚合与Git子进程。按find-skills方法本地优先读 `/Users/citrine/.agents/skills/find-skills/SKILL.md`、`clean-code/SKILL.md`，复用已读codebase-design与brainstorming的有界设计方法。用户/GoalOwner已批准最小方案，无重复审批/新技能安装。clean-code来源sickn33/agentic-awesome-skills固定bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，本地SHA256 3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317。

应用：现有结果在同task/snapshot里直接复用，不为去重制造cache framework；测试走公开aggregate接口并用临时Git观测真实命令，避免为测量注入生产参数。错误unknown不能变green；不同target不能复用。

官方[Git Trace2](https://git-scm.com/docs/api-trace2)已只读核：GIT_TRACE2_EVENT启用JSON事件，start带argv。只临时子进程env和绝对文件，不改global config/真实服务。主指标为重复命令数与语义，而非少量抖动时间推算速度。

启动clean-code停点：保留observeGit已有单快照目录观察；本片不扩大到tree/main dirty缓存，也不新增跨快照失效逻辑。实际验证待执行。
