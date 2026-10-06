# SVC05H01 — 固定后台附件历史兼容候选

状态：in-progress；创建 / 最近更新：2026-10-06 15:34 UTC。所属大 task：[FLOW-001](../../../plan-status-review/plans/flow-001-architecture/plan.md)，REQ19 / SVC05 发布后继；co-lead：Execution Lead。

## 目标与边界

在已用固定后台 362af3bac77541e5a60979326bcf4d4b8c947915 上仅接收已审 cde6646dbd4bcb4f42b7ef24f49f3a0cd6c714fd 两个精确 blob，形成附件历史兼容候选。唯一生产差异为 store.ts 的三行 templateVersion 2 分支：保留 executionInputDigest，材料清单未知，materialRevisionDigest=null。不修改冻结附件、旧 v1 规则、SQL、公开 DTO、锁文件或依赖。

复用 [统一模块规则](../../AGENTS.md#modular-design)。Module 仍为 context-transparency；Interface/事务所有者仍是 reportEvents 与 owner history 读口。没有新调度器、状态账本或运行资源。后续测试与真实 Web A/B 绑定候选完整 SHA、原锁摘要、固定 App artifact、脚本 hash 与累计预算；旧失败不回写。

## TODO

- [x] SVC05H01-01：合法领取后固定两源码与同源证据。
- [x] SVC05H01-02：固定依赖复用、直接消费者与新 A/B tuple 方案。
- [x] SVC05H01-03：有资源/执行许可后验证新 tuple；独立 review 后确定可兼容结论。
- [ ] SVC05H01-04：固定同一d629产物的受控搬运源码，完成tiny纯文件检查与独审。
- [ ] SVC05H01-05：准确retained报告/源/依赖/身份具备后，经显式窗口执行受管后台和Web发布；保留原会话。

当前只授权源码与小 metadata；不安装、不运行 typecheck/PG/tests/build/Chrome/provider，不操作个人服务。RELEASE03 已花 3874ms，余 176126ms 仅为既有累计账本事实，不能以新树重新获得 180s。后继执行由 Lead/Web owner 协调，当前 free 未满足历史启动余量。

## 完成条件

01/02 为可独立交付候选；03 保持 open，直到实际同源直接消费者与 Web A/B 证据、清理、独立审查明确。源候选不是部署许可或兼容通过。

2026-10-06 18:01 UTC：03由RELEASE03 A/B同tuple证据及Root独审完成；个人发布是REQ19后续操作，尚未授权，不等于完整发布完成。原准备/预算数字为历史；本轮只读检查和[最小发布步骤](../../docs/evidence/svc05-history-compatibility/release-preparation/README.md)，无新试验或服务动作。

2026-10-06 18:07 UTC：04已授权源码准备，脚本与6项tiny方案固定但未运行；05无操作许可。使用已有host锁/marker，无新产品部署入口，详见[artifact-transfer](../../docs/evidence/svc05-history-compatibility/artifact-transfer/README.md)。
