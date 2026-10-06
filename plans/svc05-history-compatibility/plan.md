# SVC05H01 — 固定后台附件历史兼容候选

状态：in-progress；创建 / 最近更新：2026-10-06 15:34 UTC。所属大 task：[FLOW-001](../../../plan-status-review/plans/flow-001-architecture/plan.md)，REQ19 / SVC05 发布后继；co-lead：Execution Lead。

## 目标与边界

在已用固定后台 362af3bac77541e5a60979326bcf4d4b8c947915 上仅接收已审 cde6646dbd4bcb4f42b7ef24f49f3a0cd6c714fd 两个精确 blob，形成附件历史兼容候选。唯一生产差异为 store.ts 的三行 templateVersion 2 分支：保留 executionInputDigest，材料清单未知，materialRevisionDigest=null。不修改冻结附件、旧 v1 规则、SQL、公开 DTO、锁文件或依赖。

复用 [统一模块规则](../../AGENTS.md#modular-design)。Module 仍为 context-transparency；Interface/事务所有者仍是 reportEvents 与 owner history 读口。没有新调度器、状态账本或运行资源。后续测试与真实 Web A/B 绑定候选完整 SHA、原锁摘要、固定 App artifact、脚本 hash 与累计预算；旧失败不回写。

## TODO

- [x] SVC05H01-01：合法领取后固定两源码与同源证据。
- [x] SVC05H01-02：固定依赖复用、直接消费者与新 A/B tuple 方案。
- [x] SVC05H01-03：有资源/执行许可后验证新 tuple；独立 review 后确定可兼容结论。
- [x] SVC05H01-04：固定同一d629产物的受控搬运源码，完成tiny纯文件检查与独审。
- [x] SVC05H01-06：原版本中心缺失时，独立审查并经固定窗口单次center-only恢复；保留其余角色/数据。
- [ ] SVC05H01-05：准确retained报告/源/依赖/身份具备后，经显式窗口执行受管后台和Web发布；保留原会话。

15:34历史准备边界仅源码与metadata；下列追加授权与执行单独记录，不回写历史。禁止未授权安装/产品typecheck/PG/build/Chrome/provider及个人服务操作。RELEASE03 已花 3874ms，余 176126ms 仅为既有累计账本事实，不能以新树重新获得 180s。后继执行由 Lead/Web owner 协调，当前 free 未满足历史启动余量。

## 完成条件

01/02 为可独立交付候选；03 保持 open，直到实际同源直接消费者与 Web A/B 证据、清理、独立审查明确。源候选不是部署许可或兼容通过。

2026-10-06 18:01 UTC：03由RELEASE03 A/B同tuple证据及Root独审完成；个人发布是REQ19后续操作，尚未授权，不等于完整发布完成。原准备/预算数字为历史；本轮只读检查和[最小发布步骤](../../docs/evidence/svc05-history-compatibility/release-preparation/README.md)，无新试验或服务动作。

2026-10-06 18:07 UTC：04已授权源码准备，脚本与6项tiny方案固定但未运行；05无操作许可。使用已有host锁/marker，无新产品部署入口，详见[artifact-transfer](../../docs/evidence/svc05-history-compatibility/artifact-transfer/README.md)。

2026-10-06 18:14 UTC：Lead授权≤128KiB/≤15s tiny纯文件检查，2边界red→8green已完成，04仅待独立review；05仍无个人操作窗口。上限是本机小检查，不扩到PG/host搬运/浏览器。

2026-10-06 18:16 UTC：04获Execution Lead独立APPROVED；05保留open。获准只读分析固定static-web/Vite/Node连接生命周期并提出隔离复现预算，本轮不启动loopback实验或个人HTTP。

2026-10-06 18:37 UTC：GO新增同版本Web恢复由Lead在固定362窗口授权并完成：既有bootstrap一次，仅新Web23534/23631，页面仍caa1/v2、后台362/v15。此操作解决现网页恢复，不勾选05新后台/新页面发布；原版本事实与新af51兼容缺口分开。

2026-10-06 19:38 UTC：Lead派同版本362中心恢复准备，复用原私有host/owned helper，仅允许新的center记录；当前未执行，不勾新版本发布。见center-recovery证据。

2026-10-06 19:47 UTC：06单次center-only恢复完成，Lead独立比对原数据/身份/检查，窗口关闭。05新版本发布仍open。

2026-10-06 20:04 UTC：R01两retained报告独审通过，05发布前置兼容缺口解除；[固定分阶段操作方案](../../docs/evidence/svc05-history-compatibility/release-operation/README.md)已备，仍只准备/未执行。新窗口由Lead协调，后台目标af51、新页面d629、旧pointer/三产物保留明确；不新造部署模块。

2026-10-06 20:16 UTC：05推进到可审执行输入：复用原SVC05观察方法和既有host，仅适配目标af51及维护变化。新源码未运行，需独审后由Lead固定原checkout并分配一次窗口；不新增普通GO确认门槛。

2026-10-06 21:27 UTC：05已在唯一授权2125窗口执行成功，个人后台af51/accepting18与Web d629/v3，24步骤/25保留gate成立；旧80B未知intent严格退役，原ACK未知保持，历史原件在个人私有备份。当前仅结果独审/记录接收尚待完成，原失败不回写，不重跑产品或模型。
