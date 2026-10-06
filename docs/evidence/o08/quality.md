# O08 方法与质量

2026-10-06 06:39 UTC，gpt-6-astra / assignment_review。find-skills本地优先，同Node/PG/SDK stack复用实际读过的 /Users/citrine/.agents/skills/{find-skills,codebase-design,clean-code,tdd,brainstorming}/SKILL.md。clean-code固定sickn33来源bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，不重装。任务是已批准现O07链的有界验收准备；brainstorming确认窄设计/限制后实施，不为普通方案重复索取许可。真实query未授权，不执行。

已读生产claude.ts/runtime.ts/profile/policy/graph MCP与合同、O07 native/integration测试；只复用现runRunner与adapter，不构造新agent loop。guard与隔离生命周期是本实验Interface，单测其拒绝行为及0query真MCP→HTTP→PG行为。交付前检查命名/异常清理/不记录credential/分清native broker与注入。

2026-10-06 06:49 UTC：交付前逐读5生产实验mjs+2tests，检查许可前置、once marker/source/worktree绑定、native环境分支不在0query路径、query计数与effective观察拒绝、任务/actor/final因果、PG/PID/tmp清理与错误脱敏。修复实测移动permit绕marker位置；收紧实际mcp.source缺失/未知extensions failclosed；停止进程的ESRCH竞态有界处理。7Node+1演练共8不同、syntax通过。未新增agent loop/生产依赖/SDK版本；native超时和强杀未验、权限记录是可信operator转录而非加密授权证明。源码已冻结，独立review待Root。
