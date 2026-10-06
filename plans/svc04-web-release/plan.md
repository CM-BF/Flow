# SVC04 独立发布 Web 产物

状态 in-progress；2026-10-06。所属大task [FLOW-001](../../../plan-status-review/plans/flow-001-architecture/plan.md)，co-lead Execution Lead，唯一owner runner_owner/gpt-6-astra。沿[统一模块规则](../../AGENTS.md#modular-design)。

用户结果：仅发布/回退Web时center、runner与活动任务继续；不自动reload旧tab，不丢浏览器草稿/未知请求。基于SVC03固定产物和自有进程持有，不建立部署平台。当前只0provider自有fixture，不操作个人安装。

- [x] SVC04-01 独立scope/首Interface与保留/兼容边界。
- [x] SVC04-02 固定release命名空间、完整文件集、版本指针/CAS/同operation锁、路径与保留预算。
- [x] SVC04-03 真实静态HTTP旧/新资源、同源auth/SSE；Web-only初始化与发布/回退、后台任务持续。
- [x] SVC04-04 局部边界检查/固定证据/独立review/main。
- [ ] SVC04-05 已审生产部署与真实旧页面验证（后续窗口，不在本片自动执行）。

设计见[Interface](../../docs/evidence/svc04/interface.md)。保留满额拒绝；无TTL自动删除。兼容绑定实际已加载backend source与明确公共API合同输入，不用main祖先/health代替；未知拒绝。首次旧Web升级到发布协议需只替换Web进程一次，可能短暂观察断连，任何启动失败保留旧artifact/source事实并报告Web unknown，center/runner不停止。后续原子指针发布/回退无需进程重启。

依赖：现有prepare/verifyWebArtifact、operation锁、私有配置与owned process模块；只用已安装依赖。技能复用本地find-skills/codebase-design/clean-code/tdd/brainstorming已读版本，实际按职责/状态所有权/公开行为验收应用，见quality。TUI已集成收口；SVC04已完成自己的随机数据库、临时进程与真实浏览器检查，固定实现已通过独立review并进入main41315b；个人服务未变，不使用个人安装。

下一实际交付（SVC04-05）：当前产品Web固定artifact + 个人b1c2e39837c2208e6fc2c59a80e16797f26448b5 backend的0provider兼容证据与可看发布候选，覆盖读取/发送/原key恢复/协商。不得复用合成声明签真实组合；准备与切换分开，当前不实施个人操作。工具源码已停写移出claim，仅保留本plan/evidence。
